import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadCertificateFromBase64,
  validateCertificate,
} from "./certificate-utils.ts";
import { SefazClient } from "./sefaz-client.ts";
import { getSefazEndpoint } from "./sefaz-endpoints.ts";
import { getQRCodeBaseUrl } from "./qrcode-generator.ts";
import { resolveStoreUserId } from "../_shared/multi-store.ts";
import {
  buildIcmsXml as buildIcmsGroupXml,
  calculateIcmsTotals,
  NORMAL_CST,
  normalizeIcmsCode,
  SIMPLES_CSOSN,
  validateIcmsItem,
} from "./icms-engine.ts";
import {
  buildRtcItemXml,
  buildRtcTotalsXml,
  validateRtcItem,
} from "./rtc-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-diagnostic-key",
};

type Ambiente = "producao" | "homologacao";

const NFE_TIMEZONES: Partial<Record<string, string>> = {
  AC: "America/Rio_Branco",
  AM: "America/Manaus",
  RR: "America/Boa_Vista",
  RO: "America/Porto_Velho",
  MT: "America/Cuiaba",
  MS: "America/Campo_Grande",
};
const MUNICIPALITY_CODE_OVERRIDES: Record<string, string> = {
  "CE|FORTALEZA": "2304400",
};

interface NFCeData {
  operation:
    | "emitir"
    | "retomar_pendente"
    | "reenviar_rejeitado"
    | "consultar"
    | "cancelar"
    | "download_xml"
    | "testar_conexao"
    | "validar_config"
    | "politica_emissao"
    | "diagnosticar_cadastro_email";
  order_id?: string;
  cupom_id?: string;
  model_code?: "55" | "65";
  consumer_data?: {
    nome?: string;
    cpf_cnpj?: string;
    email?: string;
    state_registration?: string;
    state_registration_indicator?: number;
    address?: string;
    address_number?: string;
    address_complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    city_code?: string;
    country_code?: string;
    country_name?: string;
    foreign_id?: string;
    final_consumer?: boolean;
    presence_indicator?: number;
  };
  observacoes?: string;
  motivo?: string;
  _storeId?: string;
}

export async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const requestData: NFCeData = await req.json();

    if (requestData.operation === "diagnosticar_cadastro_email") {
      return await diagnosticarCadastroPorEmail(req, supabase, requestData);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header is required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );
    if (authError || !user) throw new Error("Invalid authorization token");
    const storeUserId = await resolveStoreUserId(
      supabase,
      user.id,
      requestData._storeId,
    );

    switch (requestData.operation) {
      case "emitir":
        return await emitirNFCe(supabase, storeUserId, requestData);
      case "retomar_pendente":
        return await retomarDocumentoPendente(
          supabase,
          storeUserId,
          required(requestData.cupom_id, "cupom_id"),
        );
      case "reenviar_rejeitado":
        return await reenviarDocumentoRejeitado(
          supabase,
          storeUserId,
          required(requestData.cupom_id, "cupom_id"),
        );
      case "consultar":
        return await consultarNFCe(
          supabase,
          storeUserId,
          required(requestData.cupom_id, "cupom_id"),
        );
      case "cancelar":
        return await cancelarNFCe(
          supabase,
          storeUserId,
          required(requestData.cupom_id, "cupom_id"),
          requestData.motivo || "Cancelamento solicitado pelo usuario",
        );
      case "download_xml":
        return await downloadXML(
          supabase,
          storeUserId,
          required(requestData.cupom_id, "cupom_id"),
        );
      case "testar_conexao":
        return await testarConexaoSefaz(supabase, storeUserId);
      case "validar_config":
        return await validarConfiguracaoFiscal(supabase, storeUserId);
      case "politica_emissao":
        return await obterPoliticaEmissao(
          supabase,
          storeUserId,
          requestData.model_code,
        );
      default:
        throw new Error("Operacao nao suportada");
    }
  } catch (error) {
    console.error("Error in nfce-operations:", error);
    return json(
      { error: getErrorMessage(error) || "Erro interno do servidor" },
      400,
    );
  }
}

async function obterPoliticaEmissao(
  supabase: any,
  userId: string,
  requestedModel?: "55" | "65",
) {
  const modelCode = requestedModel === "55" ? "55" : "65";
  const { data: model, error: modelError } = await supabase
    .from("fiscal_document_models")
    .select("enabled,automatic_emission,model_code,environment")
    .eq("user_id", userId)
    .eq("model_code", modelCode)
    .maybeSingle();

  if (modelError) {
    throw new Error(
      `Erro ao consultar a política fiscal: ${modelError.message}`,
    );
  }

  if (model) {
    return json({
      success: true,
      enabled: model.enabled === true &&
        (modelCode === "55" || model.automatic_emission === true),
      model_code: modelCode,
      environment: model.environment || null,
      source: "fiscal_document_models",
    });
  }

  if (modelCode === "55") {
    return json({
      success: true,
      enabled: false,
      model_code: "55",
      environment: null,
      source: "not_configured",
    });
  }
  // Compatibilidade com contas que ainda não possuem a linha do modelo 65.
  const { data: legacy, error: legacyError } = await supabase
    .from("fiscal_settings")
    .select("ativo,ambiente")
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyError) {
    throw new Error(
      `Erro ao consultar a configuração fiscal: ${legacyError.message}`,
    );
  }

  return json({
    success: true,
    enabled: legacy?.ativo === true,
    model_code: "65",
    environment: legacy?.ambiente || null,
    source: legacy ? "fiscal_settings" : "not_configured",
  });
}

if (import.meta.main) serve(handleRequest);

async function emitirNFCe(supabase: any, userId: string, data: NFCeData) {
  const modelCode: "55" | "65" = data.model_code === "55" ? "55" : "65";
  const fiscalSettings = await loadFiscalSettings(
    supabase,
    userId,
    modelCode === "65",
  );
  const modelSettings = await loadFiscalModel(supabase, userId, modelCode);
  if (!modelSettings?.enabled) {
    throw new Error(
      `${
        modelCode === "55" ? "NF-e modelo 55" : "NFC-e modelo 65"
      } não está habilitada nas Configurações fiscais`,
    );
  }
  fiscalSettings.ambiente = modelSettings.environment;
  fiscalSettings.nfce_serie = modelSettings.series;
  fiscalSettings.nfce_numero_atual = modelSettings.next_number;
  fiscalSettings.operation_nature = modelSettings.operation_nature ||
    "Venda de mercadoria";
  validateFiscalSettingsForEmission(fiscalSettings, modelCode);
  if (modelCode === "55") validateNFeRecipient(data.consumer_data);
  const { certInfo, sefazClient } = loadSefazClient(fiscalSettings);

  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", required(data.order_id, "order_id"))
      .eq("user_id", userId)
      .single();
    if (orderError || !order) throw new Error("Pedido nao encontrado");

    // Emissao fiscal precisa ser idempotente por venda e modelo. Se a chamada
    // anterior caiu depois de reservar a numeracao, retomamos o mesmo documento
    // em vez de criar outra NF-e/NFC-e para o mesmo pedido.
    const { data: existingDocuments, error: existingDocumentError } =
      await supabase
        .from("nfce_cupons")
        .select("*")
        .eq("user_id", userId)
        .eq("order_id", order.id)
        .eq("model_code", modelCode)
        .in("status", ["pendente", "autorizado", "rejeitado"])
        .order("created_at", { ascending: false })
        .limit(1);
    if (existingDocumentError) {
      throw new Error(
        `Erro ao verificar documento fiscal da venda: ${existingDocumentError.message}`,
      );
    }

    const existingDocument = existingDocuments?.[0];
    if (existingDocument?.status === "autorizado") {
      return json({
        success: true,
        cupom_id: existingDocument.id,
        numero: existingDocument.numero,
        serie: existingDocument.serie,
        chave_acesso: existingDocument.chave_acesso,
        qr_code_url: existingDocument.qr_code_url || "",
        model_code: modelCode,
        ambiente: fiscalSettings.ambiente,
        status: "autorizado",
        protocolo: existingDocument.protocolo_autorizacao,
        recovered: true,
      });
    }
    if (existingDocument?.status === "pendente") {
      return await retomarDocumentoPendente(
        supabase,
        userId,
        existingDocument.id,
      );
    }
    if (existingDocument?.status === "rejeitado") {
      return json({
        success: false,
        cupom_id: existingDocument.id,
        numero: existingDocument.numero,
        serie: existingDocument.serie,
        chave_acesso: existingDocument.chave_acesso,
        model_code: modelCode,
        ambiente: fiscalSettings.ambiente,
        status: "rejeitado",
        motivo: existingDocument.motivo_rejeicao ||
          "Documento rejeitado pela SEFAZ",
        error:
          "Esta venda ja possui um documento rejeitado. Corrija os dados e use Reenviar nota.",
      }, 409);
    }

    const orderItems = normalizeOrderItems(order.items);
    if (orderItems.length === 0) {
      throw new Error("Pedido sem itens para emissao fiscal");
    }

    const productIds = Array.from(
      new Set(
        orderItems.map((item) => String(item.product_id || "").trim()).filter(
          Boolean,
        ),
      ),
    );
    const productFiscalById = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: productFiscalRows, error: productFiscalError } =
        await supabase
          .from("products")
          .select(
            "id,internal_code,fiscal_ncm,fiscal_cfop,fiscal_csosn,fiscal_icms_cst,fiscal_icms_config,fiscal_cst_pis,fiscal_cst_cofins,fiscal_origem,fiscal_cest,fiscal_beneficio,fiscal_observacao,fiscal_ibs_cbs_cst,fiscal_cclass_trib,fiscal_ibs_cbs_config,fiscal_is_cst,fiscal_is_cclass_trib,fiscal_is_config,fiscal_reducao_ibs,fiscal_reducao_cbs,fiscal_icms_st_base_ret_unit,fiscal_icms_st_aliquota,fiscal_icms_substituto_unit,fiscal_icms_st_ret_unit,fiscal_icms_efetivo_reducao,fiscal_icms_efetivo_aliquota",
          )
          .in("id", productIds)
          .eq("user_id", userId);
      if (productFiscalError) {
        throw new Error(
          `Erro ao carregar tributacao dos produtos: ${productFiscalError.message}`,
        );
      }
      for (const row of productFiscalRows || []) {
        productFiscalById.set(String(row.id), row);
      }
    }

    const numeroNFCe = await getNextFiscalDocumentNumber(
      supabase,
      userId,
      modelCode,
    );
    const dataEmissao = new Date();
    const chaveAcesso = await generateAccessKey(
      supabase,
      fiscalSettings,
      numeroNFCe,
      dataEmissao,
      modelCode,
    );
    const operationDestination = resolveOperationDestination(
      fiscalSettings,
      data.consumer_data,
      modelCode,
    );
    if (operationDestination === 3) {
      throw new Error(
        "Operação com destino ao exterior bloqueada: complete a homologação fiscal de exportação (país, idEstrangeiro, endereço e tributação) antes de transmitir. O sistema não emitirá uma NF-e internacional com dados incompletos.",
      );
    }
    const resolvedOrderItems = await applyApprovedFiscalRules(
      supabase,
      userId,
      modelCode,
      fiscalSettings,
      data.consumer_data,
      operationDestination,
      orderItems,
      productFiscalById,
    );
    const fiscalItems = buildFiscalItems(
      resolvedOrderItems,
      fiscalSettings,
      productFiscalById,
      operationDestination,
    );
    validateFiscalItemsForEmission(
      fiscalItems,
      fiscalSettings,
      operationDestination,
    );
    const deliveryFee = money(order.delivery_fee || 0);
    const totalProdutos = money(
      fiscalItems.reduce((sum, item) => sum + item.valor_total, 0),
    );
    const valorTotal = money(order.total || totalProdutos + deliveryFee);
    const valorDesconto = money(order.discount || 0);
    const valorTributos = money((totalProdutos + deliveryFee) * 0.0765);

    const { data: cupom, error: cupomError } = await supabase
      .from("nfce_cupons")
      .insert([{
        user_id: userId,
        order_id: order.id,
        numero: numeroNFCe,
        serie: fiscalSettings.nfce_serie,
        chave_acesso: chaveAcesso,
        valor_total: valorTotal,
        valor_desconto: valorDesconto,
        valor_tributos: valorTributos,
        consumidor_nome: data.consumer_data?.nome || null,
        consumidor_cpf_cnpj: onlyDigits(data.consumer_data?.cpf_cnpj) || null,
        model_code: modelCode,
        status: "pendente",
        contingencia: false,
        data_hora_emissao: dataEmissao.toISOString(),
      }])
      .select()
      .single();
    if (cupomError) {
      throw new Error(`Erro ao criar cupom: ${cupomError.message}`);
    }

    const items = fiscalItems.map((item) => ({ ...item, cupom_id: cupom.id }));
    const { error: itemsError } = await supabase.from("nfce_items").insert(
      items,
    );
    if (itemsError) {
      // Nenhum XML foi gerado ou transmitido neste ponto. Removemos apenas o
      // rascunho incompleto para que uma nova tentativa não fique presa para
      // sempre em "pendente". A numeração reservada continua consumida, como
      // exige a rastreabilidade fiscal, evitando qualquer reutilização.
      await supabase.from("nfce_items").delete().eq("cupom_id", cupom.id);
      await supabase.from("nfce_cupons").delete().eq("id", cupom.id).eq(
        "user_id",
        userId,
      );
      throw new Error(`Erro ao criar itens do cupom: ${itemsError.message}`);
    }

    const xmlContent = generateNFCeXML({
      fiscalSettings,
      cupom,
      order,
      items,
      consumerData: data.consumer_data,
      observacoes: data.observacoes,
      paymentMethod: order.payment_method,
      deliveryFee,
      totalProdutos,
      valorDesconto,
      valorTotal,
      valorTributos,
      modelCode,
    });

    const transmissionResult = await sefazClient.enviarNFCe(
      xmlContent,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      modelCode === "65"
        ? {
          chaveAcesso,
          dataEmissao: cupom.data_hora_emissao,
          valorTotal,
          cpfCnpjConsumidor: data.consumer_data?.cpf_cnpj,
          cscId: fiscalSettings.csc_id,
          cscToken: fiscalSettings.csc_token,
        }
        : undefined,
      modelCode,
    );

    const authorized = transmissionResult.success &&
      ["100", "150"].includes(transmissionResult.cStat);
    const communicationUncertain = transmissionResult.cStat === "999";
    const qrCodeUrl = transmissionResult.qrCodeUrl || "";

    const updateData: any = {
      xml_content: transmissionResult.xmlEnviado || xmlContent,
      // Falha/timeout de rede nao e rejeicao fiscal. Mantemos pendente para
      // consultar a mesma chave antes de qualquer retransmissao.
      status: authorized
        ? "autorizado"
        : communicationUncertain
        ? "pendente"
        : "rejeitado",
      motivo_rejeicao: authorized
        ? null
        : `${transmissionResult.cStat} - ${transmissionResult.xMotivo}`,
      updated_at: new Date().toISOString(),
    };
    if (authorized) {
      updateData.protocolo_autorizacao = transmissionResult.protocolo;
      updateData.data_hora_autorizacao = new Date().toISOString();
      updateData.xml_autorizado = transmissionResult.xmlRetorno;
      try {
        updateData.xml_processado = buildProcessedNFeXml(
          transmissionResult.xmlEnviado || xmlContent,
          transmissionResult.xmlRetorno,
        );
      } catch (processedXmlError) {
        // Nunca perde uma autorizacao valida por falha de composicao local.
        // O download tentara reconstruir novamente usando os XMLs preservados.
        console.error(
          "Falha ao montar nfeProc apos autorizacao:",
          processedXmlError,
        );
      }
      updateData.qr_code_url = qrCodeUrl;
    }

    await supabase.from("nfce_cupons").update(updateData).eq("id", cupom.id);
    await supabase.from("nfce_transmissions").insert([{
      cupom_id: cupom.id,
      tipo_operacao: "emissao",
      xml_enviado: transmissionResult.xmlEnviado || xmlContent,
      xml_retorno: transmissionResult.xmlRetorno,
      codigo_status: transmissionResult.cStat,
      motivo: transmissionResult.xMotivo,
      protocolo: transmissionResult.protocolo,
      sucesso: authorized,
    }]);

    return json({
      success: authorized,
      cupom_id: cupom.id,
      numero: numeroNFCe,
      serie: fiscalSettings.nfce_serie,
      chave_acesso: chaveAcesso,
      qr_code_url: qrCodeUrl,
      model_code: modelCode,
      xml_content: transmissionResult.xmlEnviado || xmlContent,
      ambiente: fiscalSettings.ambiente,
      status: updateData.status,
      protocolo: transmissionResult.protocolo,
      motivo: transmissionResult.xMotivo,
      certificado_cnpj: certInfo.cnpj,
    });
  } finally {
    sefazClient.close();
  }
}

async function consultarNFCe(supabase: any, userId: string, cupomId: string) {
  const { data: cupom, error: cupomError } = await supabase
    .from("nfce_cupons")
    .select("*")
    .eq("id", cupomId)
    .eq("user_id", userId)
    .single();
  if (cupomError || !cupom) throw new Error("Cupom nao encontrado");

  // Todo documento pendente e retomado de forma segura. A retomada consulta a
  // chave na SEFAZ primeiro e so retransmite quando ela ainda nao foi autorizada,
  // sempre preservando chave, numero e serie.
  if (cupom.status === "pendente") {
    return await retomarDocumentoPendente(supabase, userId, cupomId);
  }

  const modelCode: "55" | "65" = cupom.model_code === "55" ? "55" : "65";
  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const modelSettings = await loadFiscalModel(supabase, userId, modelCode);
  if (modelSettings?.environment) {
    fiscalSettings.ambiente = modelSettings.environment;
  }
  const { sefazClient } = loadSefazClient(fiscalSettings);
  try {
    const result = await sefazClient.consultarNFCe(
      cupom.chave_acesso,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      modelCode,
    );

    const status = ["100", "150"].includes(result.cStat)
      ? "autorizado"
      : cupom.status;
    await supabase.from("nfce_cupons").update({
      status,
      protocolo_autorizacao: result.protocolo || cupom.protocolo_autorizacao,
      motivo_rejeicao: result.success
        ? null
        : `${result.cStat} - ${result.xMotivo}`,
      updated_at: new Date().toISOString(),
    }).eq("id", cupomId);

    await supabase.from("nfce_transmissions").insert([{
      cupom_id: cupomId,
      tipo_operacao: "consulta",
      xml_retorno: result.xmlRetorno,
      codigo_status: result.cStat,
      motivo: result.xMotivo,
      protocolo: result.protocolo,
      sucesso: result.success,
    }]);

    return json({
      success: result.success,
      status,
      protocolo: result.protocolo,
      motivo: result.xMotivo,
    });
  } finally {
    sefazClient.close();
  }
}

async function retomarDocumentoPendente(
  supabase: any,
  userId: string,
  cupomId: string,
) {
  const { data: cupom, error: cupomError } = await supabase
    .from("nfce_cupons")
    .select("*")
    .eq("id", cupomId)
    .eq("user_id", userId)
    .single();
  if (cupomError || !cupom) throw new Error("Documento fiscal não encontrado");
  if (cupom.status !== "pendente") {
    throw new Error(
      "Somente documentos pendentes podem ter a emissão retomada",
    );
  }
  if (!cupom.order_id || !cupom.chave_acesso) {
    throw new Error(
      "Documento pendente sem pedido ou chave de acesso preservada",
    );
  }

  const modelCode: "55" | "65" = cupom.model_code === "55" ? "55" : "65";
  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const modelSettings = await loadFiscalModel(supabase, userId, modelCode);
  if (!modelSettings?.enabled) {
    throw new Error(
      `${
        modelCode === "55" ? "NF-e modelo 55" : "NFC-e modelo 65"
      } não está habilitada nas Configurações fiscais`,
    );
  }
  fiscalSettings.ambiente = modelSettings.environment;
  fiscalSettings.nfce_serie = cupom.serie;
  fiscalSettings.nfce_numero_atual = cupom.numero;
  fiscalSettings.operation_nature = modelSettings.operation_nature ||
    "Venda de mercadoria";
  validateFiscalSettingsForEmission(fiscalSettings, modelCode);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", cupom.order_id)
    .eq("user_id", userId)
    .single();
  if (orderError || !order) {
    throw new Error(
      "Pedido relacionado ao documento pendente não foi encontrado",
    );
  }

  const variations = normalizeRecord(order.variations);
  const consumerData = normalizeRecord(
    variations.fiscal_recipient,
  ) as NFCeData["consumer_data"];
  if (modelCode === "55") validateNFeRecipient(consumerData);

  const orderItems = normalizeOrderItems(order.items);
  if (orderItems.length === 0) {
    throw new Error("Pedido sem itens para retomar a emissão fiscal");
  }

  const productIds = Array.from(
    new Set(
      orderItems.map((item) => String(item.product_id || "").trim()).filter(
        Boolean,
      ),
    ),
  );
  const productFiscalById = new Map<string, any>();
  if (productIds.length > 0) {
    const { data: productFiscalRows, error: productFiscalError } =
      await supabase
        .from("products")
        .select(
          "id,internal_code,fiscal_ncm,fiscal_cfop,fiscal_csosn,fiscal_icms_cst,fiscal_icms_config,fiscal_cst_pis,fiscal_cst_cofins,fiscal_origem,fiscal_cest,fiscal_beneficio,fiscal_observacao,fiscal_ibs_cbs_cst,fiscal_cclass_trib,fiscal_ibs_cbs_config,fiscal_is_cst,fiscal_is_cclass_trib,fiscal_is_config,fiscal_reducao_ibs,fiscal_reducao_cbs,fiscal_icms_st_base_ret_unit,fiscal_icms_st_aliquota,fiscal_icms_substituto_unit,fiscal_icms_st_ret_unit,fiscal_icms_efetivo_reducao,fiscal_icms_efetivo_aliquota",
        )
        .in("id", productIds)
        .eq("user_id", userId);
    if (productFiscalError) {
      throw new Error(
        `Erro ao carregar tributação dos produtos: ${productFiscalError.message}`,
      );
    }
    for (const row of productFiscalRows || []) {
      productFiscalById.set(String(row.id), row);
    }
  }

  const operationDestination = resolveOperationDestination(
    fiscalSettings,
    consumerData,
    modelCode,
  );
  if (operationDestination === 3) {
    throw new Error(
      "Operação com destino ao exterior bloqueada: complete a homologação fiscal de exportação antes de transmitir.",
    );
  }
  const resolvedOrderItems = await applyApprovedFiscalRules(
    supabase,
    userId,
    modelCode,
    fiscalSettings,
    consumerData,
    operationDestination,
    orderItems,
    productFiscalById,
  );
  const fiscalItems = buildFiscalItems(
    resolvedOrderItems,
    fiscalSettings,
    productFiscalById,
    operationDestination,
  );
  validateFiscalItemsForEmission(
    fiscalItems,
    fiscalSettings,
    operationDestination,
  );
  const deliveryFee = money(order.delivery_fee || 0);
  const totalProdutos = money(
    fiscalItems.reduce((sum, item) => sum + item.valor_total, 0),
  );
  const valorTotal = money(order.total || totalProdutos + deliveryFee);
  const valorDesconto = money(order.discount || 0);
  const valorTributos = money((totalProdutos + deliveryFee) * 0.0765);
  const items = fiscalItems.map((item) => ({ ...item, cupom_id: cupom.id }));

  // Um registro pendente pode ter sido criado antes de qualquer envio (por
  // exemplo, quando a gravação dos itens falhou) ou pode ter sido transmitido
  // e perdido a resposta. Só consultamos a SEFAZ no segundo caso. Isso evita
  // uma consulta demorada e, principalmente, uma retransmissão cega.
  const { data: transmissionRows, error: transmissionLookupError } =
    await supabase
      .from("nfce_transmissions")
      .select("xml_enviado,codigo_status,sucesso,created_at")
      .eq("cupom_id", cupom.id)
      .in("tipo_operacao", ["emissao", "reenvio"])
      .order("created_at", { ascending: false })
      .limit(1);
  if (transmissionLookupError) {
    throw new Error(
      `Erro ao verificar a transmissão anterior: ${transmissionLookupError.message}`,
    );
  }
  const previousTransmission = transmissionRows?.[0] || null;
  const previousXml = String(
    cupom.xml_content || previousTransmission?.xml_enviado || "",
  ).trim();
  // A presenca do XML assinado e a evidencia necessaria para considerar que
  // houve transmissao. Um registro incompleto de auditoria sem XML nao pode
  // forcar consulta/reenvio de conteudo vazio.
  const wasPreviouslyTransmitted = Boolean(previousXml);

  const { certInfo, sefazClient } = loadSefazClient(fiscalSettings);
  try {
    if (wasPreviouslyTransmitted) {
      // Se a resposta original se perdeu depois da autorização, a consulta
      // encontra o documento sem criar uma segunda nota para a mesma venda.
      const consultation = await sefazClient.consultarNFCe(
        cupom.chave_acesso,
        fiscalSettings.endereco_uf,
        fiscalSettings.ambiente as Ambiente,
        modelCode,
      );
      await supabase.from("nfce_transmissions").insert([{
        cupom_id: cupom.id,
        tipo_operacao: "consulta",
        xml_retorno: consultation.xmlRetorno,
        codigo_status: consultation.cStat,
        motivo: consultation.xMotivo,
        protocolo: consultation.protocolo,
        sucesso: ["100", "150"].includes(consultation.cStat),
      }]);

      if (["100", "150"].includes(consultation.cStat)) {
        await supabase.from("nfce_cupons").update({
          status: "autorizado",
          protocolo_autorizacao: consultation.protocolo ||
            cupom.protocolo_autorizacao,
          motivo_rejeicao: null,
          data_hora_autorizacao: cupom.data_hora_autorizacao ||
            new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", cupomId).eq("user_id", userId);
        return json({
          success: true,
          recovered: true,
          status: "autorizado",
          model_code: modelCode,
          motivo: "Documento já constava como autorizado na SEFAZ.",
        });
      }

      // Falha de rede deixa o estado desconhecido. Nunca retransmitimos nessa
      // situação; uma nova consulta poderá confirmar a autorização depois.
      if (consultation.cStat === "999") {
        await supabase.from("nfce_cupons").update({
          status: "pendente",
          motivo_rejeicao: `999 - ${consultation.xMotivo}`,
          updated_at: new Date().toISOString(),
        }).eq("id", cupomId).eq("user_id", userId);
        return json({
          success: false,
          recovered: false,
          status: "pendente",
          model_code: modelCode,
          motivo:
            "A SEFAZ não respondeu à consulta. O documento continua pendente e não foi retransmitido para evitar duplicidade.",
        });
      }

      // 217 confirma que a chave não está na base da SEFAZ. Só então é seguro
      // reenviar exatamente o XML assinado que já havia sido transmitido.
      if (consultation.cStat !== "217") {
        await supabase.from("nfce_cupons").update({
          status: "pendente",
          motivo_rejeicao: `${consultation.cStat} - ${consultation.xMotivo}`,
          updated_at: new Date().toISOString(),
        }).eq("id", cupomId).eq("user_id", userId);
        return json({
          success: false,
          recovered: false,
          status: "pendente",
          model_code: modelCode,
          motivo:
            `A SEFAZ retornou ${consultation.cStat} - ${consultation.xMotivo}. O documento foi mantido pendente sem retransmissão automática.`,
        });
      }

      const retransmissionResult = await sefazClient.reenviarNFeAssinada(
        previousXml,
        fiscalSettings.endereco_uf,
        fiscalSettings.ambiente as Ambiente,
        modelCode,
      );
      const retransmissionAuthorized = retransmissionResult.success &&
        ["100", "150"].includes(retransmissionResult.cStat);
      const retransmissionUncertain = retransmissionResult.cStat === "999";
      const retransmissionUpdate: Record<string, unknown> = {
        status: retransmissionAuthorized
          ? "autorizado"
          : retransmissionUncertain
          ? "pendente"
          : "rejeitado",
        motivo_rejeicao: retransmissionAuthorized
          ? null
          : `${retransmissionResult.cStat} - ${retransmissionResult.xMotivo}`,
        updated_at: new Date().toISOString(),
      };
      if (retransmissionAuthorized) {
        retransmissionUpdate.protocolo_autorizacao =
          retransmissionResult.protocolo;
        retransmissionUpdate.data_hora_autorizacao = new Date().toISOString();
        retransmissionUpdate.xml_autorizado = retransmissionResult.xmlRetorno;
        try {
          retransmissionUpdate.xml_processado = buildProcessedNFeXml(
            previousXml,
            retransmissionResult.xmlRetorno,
          );
        } catch (processedXmlError) {
          console.error(
            "Falha ao montar nfeProc ao retransmitir pendência:",
            processedXmlError,
          );
        }
      }
      await supabase.from("nfce_cupons").update(retransmissionUpdate).eq(
        "id",
        cupom.id,
      ).eq("user_id", userId);
      await supabase.from("nfce_transmissions").insert([{
        cupom_id: cupom.id,
        tipo_operacao: "reenvio",
        xml_enviado: previousXml,
        xml_retorno: retransmissionResult.xmlRetorno,
        codigo_status: retransmissionResult.cStat,
        motivo: retransmissionResult.xMotivo,
        protocolo: retransmissionResult.protocolo,
        sucesso: retransmissionAuthorized,
      }]);
      return json({
        success: retransmissionAuthorized,
        recovered: retransmissionAuthorized,
        cupom_id: cupom.id,
        numero: cupom.numero,
        serie: cupom.serie,
        chave_acesso: cupom.chave_acesso,
        model_code: modelCode,
        status: retransmissionAuthorized
          ? "autorizado"
          : retransmissionUncertain
          ? "pendente"
          : "rejeitado",
        protocolo: retransmissionResult.protocolo,
        motivo: retransmissionResult.xMotivo,
        certificado_cnpj: certInfo.cnpj,
      });
    }

    // Sem XML nem tentativa anterior, o documento nunca chegou à SEFAZ. A
    // emissão pode continuar imediatamente com a numeração e chave reservadas.
    const { error: deleteItemsError } = await supabase.from("nfce_items")
      .delete().eq("cupom_id", cupom.id);
    if (deleteItemsError) {
      throw new Error(
        `Erro ao preparar os itens da nota pendente: ${deleteItemsError.message}`,
      );
    }
    const { error: itemsError } = await supabase.from("nfce_items").insert(
      items,
    );
    if (itemsError) {
      throw new Error(
        `Erro ao reconstruir os itens da nota pendente: ${itemsError.message}`,
      );
    }

    const xmlContent = generateNFCeXML({
      fiscalSettings,
      cupom,
      order,
      items,
      consumerData,
      observacoes: "",
      paymentMethod: order.payment_method,
      deliveryFee,
      totalProdutos,
      valorDesconto,
      valorTotal,
      valorTributos,
      modelCode,
    });
    const transmissionResult = await sefazClient.enviarNFCe(
      xmlContent,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      modelCode === "65"
        ? {
          chaveAcesso: cupom.chave_acesso,
          dataEmissao: cupom.data_hora_emissao,
          valorTotal,
          cpfCnpjConsumidor: consumerData?.cpf_cnpj,
          cscId: fiscalSettings.csc_id,
          cscToken: fiscalSettings.csc_token,
        }
        : undefined,
      modelCode,
    );

    const authorized = transmissionResult.success &&
      ["100", "150"].includes(transmissionResult.cStat);
    const communicationUncertain = transmissionResult.cStat === "999";
    const updateData: Record<string, unknown> = {
      xml_content: transmissionResult.xmlEnviado || xmlContent,
      status: authorized
        ? "autorizado"
        : communicationUncertain
        ? "pendente"
        : "rejeitado",
      motivo_rejeicao: authorized
        ? null
        : `${transmissionResult.cStat} - ${transmissionResult.xMotivo}`,
      updated_at: new Date().toISOString(),
    };
    if (authorized) {
      updateData.protocolo_autorizacao = transmissionResult.protocolo;
      updateData.data_hora_autorizacao = new Date().toISOString();
      updateData.xml_autorizado = transmissionResult.xmlRetorno;
      updateData.qr_code_url = transmissionResult.qrCodeUrl || "";
      try {
        updateData.xml_processado = buildProcessedNFeXml(
          transmissionResult.xmlEnviado || xmlContent,
          transmissionResult.xmlRetorno,
        );
      } catch (processedXmlError) {
        console.error(
          "Falha ao montar nfeProc ao retomar pendência:",
          processedXmlError,
        );
      }
    }
    await supabase.from("nfce_cupons").update(updateData).eq("id", cupom.id).eq(
      "user_id",
      userId,
    );
    await supabase.from("nfce_transmissions").insert([{
      cupom_id: cupom.id,
      tipo_operacao: "emissao",
      xml_enviado: transmissionResult.xmlEnviado || xmlContent,
      xml_retorno: transmissionResult.xmlRetorno,
      codigo_status: transmissionResult.cStat,
      motivo: transmissionResult.xMotivo,
      protocolo: transmissionResult.protocolo,
      sucesso: authorized,
    }]);

    return json({
      success: authorized,
      recovered: false,
      cupom_id: cupom.id,
      numero: cupom.numero,
      serie: cupom.serie,
      chave_acesso: cupom.chave_acesso,
      model_code: modelCode,
      status: authorized
        ? "autorizado"
        : communicationUncertain
        ? "pendente"
        : "rejeitado",
      protocolo: transmissionResult.protocolo,
      motivo: transmissionResult.xMotivo,
      certificado_cnpj: certInfo.cnpj,
    });
  } finally {
    sefazClient.close();
  }
}

async function reenviarDocumentoRejeitado(
  supabase: any,
  userId: string,
  cupomId: string,
) {
  const { data: cupom, error: cupomError } = await supabase
    .from("nfce_cupons")
    .select("*")
    .eq("id", cupomId)
    .eq("user_id", userId)
    .single();
  if (cupomError || !cupom) throw new Error("Documento fiscal não encontrado");
  if (cupom.status !== "rejeitado") {
    throw new Error("Somente documentos rejeitados podem ser reenviados");
  }
  if (!cupom.chave_acesso || !cupom.xml_content) {
    throw new Error(
      "O documento rejeitado não possui XML e chave preservados para reenvio",
    );
  }

  const modelCode: "55" | "65" = cupom.model_code === "55" ? "55" : "65";
  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const modelSettings = await loadFiscalModel(supabase, userId, modelCode);
  if (modelSettings?.environment) {
    fiscalSettings.ambiente = modelSettings.environment;
  }
  const { sefazClient } = loadSefazClient(fiscalSettings);

  try {
    // Evita duplicidade quando a autorizacao ocorreu, mas a resposta original se perdeu.
    const consultation = await sefazClient.consultarNFCe(
      cupom.chave_acesso,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      modelCode,
    );
    if (["100", "150"].includes(consultation.cStat)) {
      await supabase.from("nfce_cupons").update({
        status: "autorizado",
        protocolo_autorizacao: consultation.protocolo ||
          cupom.protocolo_autorizacao,
        motivo_rejeicao: null,
        data_hora_autorizacao: cupom.data_hora_autorizacao ||
          new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", cupomId).eq("user_id", userId);
      return json({
        success: true,
        recovered: true,
        status: "autorizado",
        motivo: "Documento já constava como autorizado na SEFAZ.",
      });
    }

    const result = await sefazClient.reenviarNFeAssinada(
      cupom.xml_content,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      modelCode,
    );
    const authorized = result.success && ["100", "150"].includes(result.cStat);
    const updateData: Record<string, unknown> = {
      status: authorized ? "autorizado" : "rejeitado",
      motivo_rejeicao: authorized
        ? null
        : `${result.cStat} - ${result.xMotivo}`,
      updated_at: new Date().toISOString(),
    };
    if (authorized) {
      updateData.protocolo_autorizacao = result.protocolo;
      updateData.data_hora_autorizacao = new Date().toISOString();
      updateData.xml_autorizado = result.xmlRetorno;
      try {
        updateData.xml_processado = buildProcessedNFeXml(
          cupom.xml_content,
          result.xmlRetorno,
        );
      } catch (processedXmlError) {
        // A autorizacao e o protocolo prevalecem; o XML processado pode ser reconstruido no download.
        console.error(
          "Falha ao montar nfeProc apos reenvio:",
          processedXmlError,
        );
      }
    }
    await supabase.from("nfce_cupons").update(updateData).eq("id", cupomId).eq(
      "user_id",
      userId,
    );
    await supabase.from("nfce_transmissions").insert([{
      cupom_id: cupomId,
      tipo_operacao: "reenvio",
      xml_enviado: cupom.xml_content,
      xml_retorno: result.xmlRetorno,
      codigo_status: result.cStat,
      motivo: result.xMotivo,
      protocolo: result.protocolo,
      sucesso: authorized,
    }]);
    return json({
      success: authorized,
      status: authorized ? "autorizado" : "rejeitado",
      motivo: result.xMotivo,
      codigo_status: result.cStat,
    });
  } finally {
    sefazClient.close();
  }
}

async function cancelarNFCe(
  supabase: any,
  userId: string,
  cupomId: string,
  motivo: string,
) {
  const { data: cupom, error: cupomError } = await supabase
    .from("nfce_cupons")
    .select("*")
    .eq("id", cupomId)
    .eq("user_id", userId)
    .single();
  if (cupomError || !cupom) throw new Error("Cupom nao encontrado");
  if (cupom.status !== "autorizado") {
    throw new Error("Apenas cupons autorizados podem ser cancelados");
  }
  if (!cupom.protocolo_autorizacao) {
    throw new Error("Cupom autorizado sem protocolo salvo");
  }

  const modelCode: "55" | "65" = cupom.model_code === "55" ? "55" : "65";
  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const modelSettings = await loadFiscalModel(supabase, userId, modelCode);
  if (modelSettings?.environment) {
    fiscalSettings.ambiente = modelSettings.environment;
  }
  const { sefazClient } = loadSefazClient(fiscalSettings);
  try {
    const result = await sefazClient.cancelarNFCe(
      cupom.chave_acesso,
      cupom.protocolo_autorizacao,
      motivo,
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
      fiscalSettings.cnpj,
      modelCode,
    );

    if (result.success) {
      await supabase.from("nfce_cupons").update({
        status: "cancelado",
        updated_at: new Date().toISOString(),
      }).eq("id", cupomId);
    }
    await supabase.from("nfce_transmissions").insert([{
      cupom_id: cupomId,
      tipo_operacao: "cancelamento",
      xml_retorno: result.xmlRetorno,
      codigo_status: result.cStat,
      motivo: result.xMotivo || motivo,
      protocolo: result.protocolo,
      sucesso: result.success,
    }]);

    return json({
      success: result.success,
      motivo: result.success ? "Cancelado com sucesso" : result.xMotivo,
    });
  } finally {
    sefazClient.close();
  }
}

async function testarConexaoSefaz(supabase: any, userId: string) {
  const fiscalSettings = await loadFiscalSettings(supabase, userId, true);
  validateFiscalSettingsForEmission(fiscalSettings);
  const { certInfo, sefazClient } = loadSefazClient(fiscalSettings);
  try {
    const result = await sefazClient.consultarStatusServico(
      fiscalSettings.endereco_uf,
      fiscalSettings.ambiente as Ambiente,
    );
    return json({
      success: result.success,
      cStat: result.cStat,
      motivo: result.xMotivo,
      ambiente: fiscalSettings.ambiente,
      uf: fiscalSettings.endereco_uf,
      certificado_cnpj: certInfo.cnpj,
    });
  } finally {
    sefazClient.close();
  }
}

async function validarConfiguracaoFiscal(supabase: any, userId: string) {
  const fiscalSettings = await loadFiscalSettings(supabase, userId, false);
  const checklist = buildFiscalReadiness(fiscalSettings);
  let certificate: any = null;

  if (
    fiscalSettings.certificado_a1_base64 && fiscalSettings.certificado_senha
  ) {
    try {
      const certInfo = loadCertificateFromBase64(
        fiscalSettings.certificado_a1_base64,
        fiscalSettings.certificado_senha,
      );
      const validation = validateCertificate(certInfo, fiscalSettings.cnpj);
      certificate = {
        valid: validation.valid,
        errors: validation.errors,
        cnpj: certInfo.cnpj,
        valid_from: certInfo.validFrom.toISOString(),
        valid_to: certInfo.validTo.toISOString(),
        issuer: certInfo.issuer,
      };
      if (!validation.valid) {
        checklist.errors.push(
          ...validation.errors.map((message) => `Certificado: ${message}`),
        );
      }
    } catch (error) {
      const message = getErrorMessage(error);
      checklist.errors.push(`Certificado: ${message}`);
      certificate = { valid: false, errors: [message] };
    }
  }

  const ready = checklist.errors.length === 0;
  return json({
    success: ready,
    ready,
    scope: "NFC-e 65 / Simples Nacional",
    ambiente: fiscalSettings.ambiente,
    uf: fiscalSettings.endereco_uf,
    checklist,
    certificate,
  });
}

async function diagnosticarCadastroPorEmail(
  req: Request,
  supabase: any,
  data: any,
) {
  const expectedKey = Deno.env.get("NFCE_DIAGNOSTIC_KEY") || "";
  const receivedKey = req.headers.get("x-diagnostic-key") || "";
  if (!expectedKey || receivedKey !== expectedKey) {
    return json({ error: "Diagnostico nao autorizado" }, 401);
  }

  const email = String(data.email || "").trim().toLowerCase();
  if (!email) throw new Error("email e obrigatorio");

  const user = await findAuthUserByEmail(supabase, email);
  if (!user) {
    return json({ success: false, error: "Usuario nao encontrado", email });
  }

  const fiscalSettings = await loadFiscalSettings(supabase, user.id, false);
  const readiness = buildFiscalReadiness(fiscalSettings);
  let certificate: any = null;
  let connection: any = null;

  if (
    fiscalSettings.certificado_a1_base64 && fiscalSettings.certificado_senha
  ) {
    try {
      const certInfo = loadCertificateFromBase64(
        fiscalSettings.certificado_a1_base64,
        fiscalSettings.certificado_senha,
      );
      const validation = validateCertificate(certInfo, fiscalSettings.cnpj);
      certificate = {
        valid: validation.valid,
        errors: validation.errors,
        cnpj: certInfo.cnpj,
        expected_cnpj: onlyDigits(fiscalSettings.cnpj),
        cnpj_matches: certInfo.cnpj === onlyDigits(fiscalSettings.cnpj),
        valid_from: certInfo.validFrom.toISOString(),
        valid_to: certInfo.validTo.toISOString(),
        subject: certInfo.subject,
        issuer: certInfo.issuer,
        chain_count: certInfo.certificateChainCount,
      };

      if (validation.valid && readiness.errors.length === 0) {
        const sefazClient = new SefazClient(certInfo);
        try {
          const result = await sefazClient.consultarStatusServico(
            fiscalSettings.endereco_uf,
            fiscalSettings.ambiente as Ambiente,
          );
          connection = {
            success: result.success,
            cStat: result.cStat,
            motivo: result.xMotivo,
            rawStatus: result.rawStatus,
          };
        } finally {
          sefazClient.close();
        }
      }
    } catch (error) {
      certificate = { valid: false, errors: [getErrorMessage(error)] };
    }
  }

  return json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    fiscal: {
      ativo: fiscalSettings.ativo,
      cnpj: onlyDigits(fiscalSettings.cnpj),
      razao_social: fiscalSettings.razao_social,
      nome_fantasia: fiscalSettings.nome_fantasia,
      inscricao_estadual: onlyDigits(fiscalSettings.inscricao_estadual),
      uf: fiscalSettings.endereco_uf,
      municipio: fiscalSettings.endereco_municipio,
      codigo_municipio: onlyDigits(fiscalSettings.codigo_municipio),
      ambiente: fiscalSettings.ambiente,
      serie: fiscalSettings.nfce_serie,
      proximo_numero: fiscalSettings.nfce_numero_atual,
      has_csc_id: Boolean(String(fiscalSettings.csc_id || "").trim()),
      has_csc_token: Boolean(String(fiscalSettings.csc_token || "").trim()),
      has_certificate: Boolean(fiscalSettings.certificado_a1_base64),
      certificate_bytes: Math.floor(
        String(fiscalSettings.certificado_a1_base64 || "").length * 3 / 4,
      ),
    },
    readiness,
    certificate,
    connection,
  });
}

async function findAuthUserByEmail(supabase: any, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Erro ao buscar usuarios: ${error.message}`);
    const users = data?.users || [];
    const found = users.find((user: any) =>
      String(user.email || "").toLowerCase() === email
    );
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

async function downloadXML(supabase: any, userId: string, cupomId: string) {
  const { data: cupom, error } = await supabase
    .from("nfce_cupons")
    .select("xml_processado, xml_autorizado, xml_content, numero, status")
    .eq("id", cupomId)
    .eq("user_id", userId)
    .single();
  if (error || !cupom) throw new Error("Cupom nao encontrado");

  if (cupom.status !== "autorizado") {
    throw new Error(
      "O XML fiscal processado so existe para documentos autorizados",
    );
  }

  let xml = String(cupom.xml_processado || "").trim();
  if (!xml) {
    xml = buildProcessedNFeXml(cupom.xml_content, cupom.xml_autorizado);
    const { error: updateError } = await supabase
      .from("nfce_cupons")
      .update({ xml_processado: xml, updated_at: new Date().toISOString() })
      .eq("id", cupomId)
      .eq("user_id", userId);
    if (updateError) {
      throw new Error(
        `Nao foi possivel armazenar o XML processado: ${updateError.message}`,
      );
    }
  }
  return json({ xml, numero: cupom.numero, document_type: "nfeProc" });
}

function buildProcessedNFeXml(
  xmlNFe: unknown,
  xmlSefazResponse: unknown,
): string {
  const sent = String(xmlNFe || "").trim();
  const response = String(xmlSefazResponse || "").trim();
  if (!sent || !response) {
    throw new Error(
      "XML enviado ou protocolo de autorizacao nao foi encontrado",
    );
  }

  if (/<nfeProc\b/i.test(sent)) return ensureXmlDeclaration(sent);

  const nfeMatch = sent.match(/<(?:\w+:)?NFe\b[^>]*>[\s\S]*?<\/(?:\w+:)?NFe>/i);
  const protocolMatch = response.match(
    /<(?:\w+:)?protNFe\b[^>]*>[\s\S]*?<\/(?:\w+:)?protNFe>/i,
  );
  if (!nfeMatch) throw new Error("O XML assinado da nota nao foi encontrado");
  if (!protocolMatch) {
    throw new Error(
      "O protocolo de autorizacao protNFe nao foi encontrado na resposta da Sefaz",
    );
  }

  const nfe = removeNamespacePrefix(nfeMatch[0], "NFe");
  const protocol = normalizeProtocolFragment(protocolMatch[0]);
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${
    stripXmlDeclaration(nfe)
  }${stripXmlDeclaration(protocol)}</nfeProc>`;
}

function removeNamespacePrefix(xml: string, elementName: string): string {
  return xml
    .replace(new RegExp(`<\\w+:${elementName}\\b`, "gi"), `<${elementName}`)
    .replace(new RegExp(`</\\w+:${elementName}>`, "gi"), `</${elementName}>`);
}

function normalizeProtocolFragment(xml: string): string {
  return xml
    .replace(/(<\/?)[A-Za-z_][\w.-]*:/g, "$1")
    .replace(/\s+xmlns:[A-Za-z_][\w.-]*=("[^"]*"|'[^']*')/g, "");
}

function stripXmlDeclaration(xml: string): string {
  return String(xml || "").replace(/^\s*<\?xml[^>]*\?>\s*/i, "").trim();
}

function ensureXmlDeclaration(xml: string): string {
  return /^\s*<\?xml/i.test(xml)
    ? xml
    : `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}

async function loadFiscalSettings(
  supabase: any,
  userId: string,
  activeOnly: boolean,
) {
  let query = supabase.from("fiscal_settings").select("*").eq(
    "user_id",
    userId,
  );
  if (activeOnly) query = query.eq("ativo", true);
  const { data, error } = await query.single();
  if (error || !data) {
    throw new Error("Configuracoes fiscais nao encontradas ou inativas");
  }
  return data;
}

async function loadFiscalModel(
  supabase: any,
  userId: string,
  modelCode: "55" | "65",
) {
  const { data, error } = await supabase.from("fiscal_document_models").select(
    "*",
  )
    .eq("user_id", userId).eq("model_code", modelCode).maybeSingle();
  if (error) {
    throw new Error(
      `Erro ao carregar configuração do modelo ${modelCode}: ${error.message}`,
    );
  }
  return data;
}

function validateNFeRecipient(consumerData?: NFCeData["consumer_data"]) {
  const doc = onlyDigits(consumerData?.cpf_cnpj);
  const missing: string[] = [];
  if (!String(consumerData?.nome || "").trim()) {
    missing.push("nome/razão social");
  }
  if (![11, 14].includes(doc.length)) missing.push("CPF/CNPJ válido");
  if (!String(consumerData?.address || "").trim()) missing.push("logradouro");
  if (!String(consumerData?.address_number || "").trim()) {
    missing.push("número");
  }
  if (!String(consumerData?.neighborhood || "").trim()) missing.push("bairro");
  if (!String(consumerData?.city || "").trim()) missing.push("município");
  if (onlyDigits(consumerData?.city_code).length !== 7) {
    missing.push("código IBGE do município");
  }
  if (!/^[A-Z]{2}$/.test(String(consumerData?.state || "").toUpperCase())) {
    missing.push("UF");
  }
  if (onlyDigits(consumerData?.postal_code).length !== 8) missing.push("CEP");
  if (missing.length) {
    throw new Error(
      `Destinatário incompleto para NF-e modelo 55: ${missing.join(", ")}`,
    );
  }
}

function loadSefazClient(fiscalSettings: any) {
  if (
    !fiscalSettings.certificado_a1_base64 || !fiscalSettings.certificado_senha
  ) {
    throw new Error("Certificado digital A1 nao configurado");
  }
  const certInfo = loadCertificateFromBase64(
    fiscalSettings.certificado_a1_base64,
    fiscalSettings.certificado_senha,
  );
  const validation = validateCertificate(certInfo, fiscalSettings.cnpj);
  if (!validation.valid) {
    throw new Error(`Certificado invalido: ${validation.errors.join(", ")}`);
  }
  return { certInfo, sefazClient: new SefazClient(certInfo) };
}

function validateFiscalSettingsForEmission(
  settings: any,
  modelCode: "55" | "65" = "65",
) {
  const readiness = buildFiscalReadiness(settings, modelCode);
  if (readiness.errors.length) {
    throw new Error(
      `Configuracao fiscal incompleta: ${readiness.errors.join("; ")}`,
    );
  }
}

function buildFiscalReadiness(settings: any, modelCode: "55" | "65" = "65") {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFields = [
    "cnpj",
    "razao_social",
    "endereco_logradouro",
    "endereco_numero",
    "endereco_bairro",
    "endereco_municipio",
    "endereco_uf",
    "endereco_cep",
    "codigo_municipio",
    "nfce_serie",
    "nfce_numero_atual",
  ];
  for (const field of requiredFields) {
    if (!String(settings[field] || "").trim()) {
      errors.push(`Campo obrigatorio ausente: ${field}`);
    }
  }

  const uf = String(settings.endereco_uf || "").toUpperCase();
  let codigoUf = "";
  if (uf) {
    try {
      codigoUf = getCodigoUF(uf);
    } catch (error) {
      errors.push(getErrorMessage(error));
    }
  }
  if (uf && codigoUf) {
    const codigoMunicipio = resolveMunicipalityCode(settings);
    if (codigoMunicipio.length !== 7 || !codigoMunicipio.startsWith(codigoUf)) {
      errors.push(
        `Codigo do municipio deve ter 7 digitos e comecar com o codigo IBGE da UF ${uf} (${codigoUf})`,
      );
    }
    if (codigoMunicipio !== onlyDigits(settings.codigo_municipio)) {
      warnings.push(
        `Codigo do municipio normalizado para ${
          settings.endereco_municipio || "municipio"
        }: ${codigoMunicipio}`,
      );
    }
    if (!onlyDigits(settings.inscricao_estadual)) {
      errors.push("Inscricao Estadual e obrigatoria para NFC-e");
    }
  }
  const ambiente = String(settings.ambiente || "") as Ambiente;
  if (uf && String(settings.ambiente || "").match(/^(homologacao|producao)$/)) {
    try {
      getSefazEndpoint(uf, ambiente, "status");
      getSefazEndpoint(uf, ambiente, "autorizacao");
      getSefazEndpoint(uf, ambiente, "retAutorizacao");
      getSefazEndpoint(uf, ambiente, "consulta");
      getSefazEndpoint(uf, ambiente, "evento");
      if (modelCode === "65") getQRCodeBaseUrl(uf, ambiente);
    } catch (error) {
      errors.push(getErrorMessage(error));
    }
  }

  const cnpj = onlyDigits(settings.cnpj);
  if (cnpj.length !== 14) errors.push("CNPJ deve conter 14 digitos");
  const serie = Number(settings.nfce_serie);
  if (!Number.isInteger(serie) || serie < 1 || serie > 999) {
    errors.push("Serie NFC-e deve ser um numero entre 1 e 999");
  }
  const nextNumber = Number(settings.nfce_numero_atual);
  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    errors.push("Proximo numero da NFC-e deve ser maior que zero");
  }
  if (!String(settings.ambiente || "").match(/^(homologacao|producao)$/)) {
    errors.push("Ambiente fiscal invalido");
  }
  if (modelCode === "65" && (!settings.csc_id || !settings.csc_token)) {
    warnings.push(
      "CSC não informado: o emissor usará QR Code v3 online, que dispensa CSC conforme NT 2025.001.",
    );
  }
  if (!settings.certificado_a1_base64 || !settings.certificado_senha) {
    errors.push("Certificado A1 e senha sao obrigatorios");
  }
  if (settings.ambiente === "producao") {
    warnings.push(
      "Producao exige credenciamento NFC-e ativo na Sefaz da UF e CSC de producao. Teste primeiro em homologacao.",
    );
  }

  return { errors, warnings };
}

async function getNextFiscalDocumentNumber(
  supabase: any,
  userId: string,
  modelCode: "55" | "65",
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "get_next_fiscal_document_number",
    { p_user_id: userId, p_model_code: modelCode },
  );
  if (error) {
    throw new Error(
      `Erro ao gerar número do documento modelo ${modelCode}: ${error.message}`,
    );
  }
  return Number(data);
}

async function generateAccessKey(
  supabase: any,
  fiscalSettings: any,
  numero: number,
  dataEmissao: Date,
  modelCode: "55" | "65",
): Promise<string> {
  const parts = getNfeDateParts(dataEmissao, fiscalSettings.endereco_uf);
  const aamm = `${parts.year.slice(-2)}${parts.month}`;
  const codigoNumerico = crypto.getRandomValues(new Uint32Array(1))[0]
    .toString().slice(0, 8).padStart(8, "0");
  const { data, error } = await supabase.rpc("generate_nfce_access_key", {
    p_uf: getCodigoUF(fiscalSettings.endereco_uf),
    p_aamm: aamm,
    p_cnpj: onlyDigits(fiscalSettings.cnpj),
    p_modelo: modelCode,
    p_serie: String(fiscalSettings.nfce_serie),
    p_numero: String(numero),
    p_tipo_emissao: "1",
    p_codigo_numerico: codigoNumerico,
  });
  if (error) throw new Error(`Erro ao gerar chave de acesso: ${error.message}`);
  return String(data);
}

function normalizeOrderItems(rawItems: unknown): any[] {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === "string") {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeRecord(rawValue: unknown): Record<string, any> {
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return rawValue as Record<string, any>;
  }
  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, any>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function applyApprovedFiscalRules(
  supabase: any,
  userId: string,
  modelCode: "55" | "65",
  settings: any,
  consumerData: NFCeData["consumer_data"] | undefined,
  operationDestination: 1 | 2 | 3,
  orderItems: any[],
  productFiscalById: Map<string, any>,
) {
  const operationDate = new Date().toISOString().slice(0, 10);
  const crt = Number(settings.regime_tributario || 1);
  const { data: rules, error } = await supabase
    .from("fiscal_tax_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .not("accountant_approved_at", "is", null)
    .contains("model_codes", [modelCode])
    .contains("issuer_crt", [crt])
    .lte("valid_from", operationDate)
    .or(`valid_until.is.null,valid_until.gte.${operationDate}`)
    .order("priority", { ascending: true });

  // A migracao pode chegar antes do cache do PostgREST. Contas legadas seguem
  // funcionando enquanto o modo estrito estiver desligado.
  if (error) {
    if (settings.require_approved_fiscal_rules) {
      throw new Error(
        `Erro ao resolver regras fiscais aprovadas: ${error.message}`,
      );
    }
    return orderItems;
  }

  const issuerUf = String(settings.endereco_uf || "").toUpperCase();
  const destinationUf = operationDestination === 3
    ? "EX"
    : String(consumerData?.state || issuerUf).toUpperCase();
  const recipientIe = Number(consumerData?.state_registration_indicator || 9);
  const finalConsumer = consumerData?.final_consumer !== false;
  const presenceIndicator = Number(consumerData?.presence_indicator || 1);

  return orderItems.map((item, itemIndex) => {
    const product = item.product_id
      ? productFiscalById.get(String(item.product_id)) || {}
      : {};
    const ncm = onlyDigits(item.fiscal_ncm || item.ncm || product.fiscal_ncm);
    const cest = onlyDigits(item.fiscal_cest || product.fiscal_cest);
    const productOrigin = Number(
      item.fiscal_origem ?? product.fiscal_origem ?? 0,
    );
    const operationType = String(item.operation_type || "sale");
    const matches = (rules || []).filter((rule: any) =>
      rule.operation_type === operationType &&
      (rule.operation_destination == null ||
        Number(rule.operation_destination) === operationDestination) &&
      (!rule.origin_uf || rule.origin_uf === issuerUf) &&
      (!rule.destination_uf || rule.destination_uf === destinationUf) &&
      (rule.recipient_ie_indicator == null ||
        Number(rule.recipient_ie_indicator) === recipientIe) &&
      (rule.final_consumer == null ||
        Boolean(rule.final_consumer) === finalConsumer) &&
      (rule.presence_indicator == null ||
        Number(rule.presence_indicator) === presenceIndicator) &&
      (!rule.product_id ||
        String(rule.product_id) === String(item.product_id || "")) &&
      (!rule.ncm_prefix || ncm.startsWith(String(rule.ncm_prefix))) &&
      (!rule.cest || String(rule.cest) === cest) &&
      (rule.product_origin == null ||
        Number(rule.product_origin) === productOrigin)
    ).map((rule: any) => ({
      rule,
      specificity: (rule.product_id ? 1_000_000 : 0) +
        String(rule.ncm_prefix || "").length * 10_000 +
        (rule.cest ? 1_000 : 0) +
        (rule.destination_uf ? 100 : 0) +
        (rule.operation_destination != null ? 10 : 0) +
        (rule.recipient_ie_indicator != null ? 2 : 0) +
        (rule.presence_indicator != null ? 1 : 0),
    })).sort((a: any, b: any) =>
      b.specificity - a.specificity ||
      Number(a.rule.priority) - Number(b.rule.priority) ||
      String(a.rule.id).localeCompare(String(b.rule.id))
    );

    if (!matches.length) {
      if (settings.require_approved_fiscal_rules) {
        throw new Error(
          `Item ${itemIndex + 1} (${
            item.product_name || item.name || "produto"
          }): nenhuma regra fiscal vigente e aprovada corresponde à operação`,
        );
      }
      return item;
    }
    if (
      matches.length > 1 &&
      matches[0].specificity === matches[1].specificity &&
      Number(matches[0].rule.priority) === Number(matches[1].rule.priority)
    ) {
      throw new Error(
        `Item ${itemIndex + 1}: regras fiscais ambíguas (${
          matches[0].rule.name
        } e ${
          matches[1].rule.name
        }). Ajuste a prioridade ou os critérios antes de emitir.`,
      );
    }

    const rule = matches[0].rule;
    const ibsConfig = normalizeRecord(rule.ibs_cbs_config);
    return {
      ...item,
      operation_type: operationType,
      fiscal_rule_id: rule.id,
      fiscal_cfop: rule.cfop,
      fiscal_csosn: crt === 1 ? rule.icms_code : undefined,
      fiscal_icms_cst: crt === 1 ? undefined : rule.icms_code,
      fiscal_icms_config: normalizeRecord(rule.icms_config),
      fiscal_cst_pis: rule.pis_cst || item.fiscal_cst_pis,
      fiscal_cst_cofins: rule.cofins_cst || item.fiscal_cst_cofins,
      fiscal_beneficio: rule.benefit_code || item.fiscal_beneficio,
      fiscal_ibs_cbs_cst: rule.ibs_cbs_cst || item.fiscal_ibs_cbs_cst,
      fiscal_cclass_trib: rule.cclass_trib || item.fiscal_cclass_trib,
      fiscal_ibs_cbs_config: ibsConfig,
      fiscal_is_cst: rule.is_cst || item.fiscal_is_cst,
      fiscal_is_cclass_trib: rule.is_cclass_trib || item.fiscal_is_cclass_trib,
      fiscal_is_config: normalizeRecord(rule.is_config),
      fiscal_rtc_source_version: rule.rtc_source_version,
      fiscal_rtc_table_version: rule.rtc_table_version,
      fiscal_reducao_ibs: ibsConfig.reducao_ibs ?? item.fiscal_reducao_ibs,
      fiscal_reducao_cbs: ibsConfig.reducao_cbs ?? item.fiscal_reducao_cbs,
    };
  });
}

export function buildFiscalItems(
  orderItems: any[],
  settings: any,
  productFiscalById: Map<string, any> = new Map(),
  operationDestination: 1 | 2 | 3 = 1,
) {
  return orderItems.map((item, index) => {
    const productFiscal = item.product_id
      ? productFiscalById.get(String(item.product_id)) || {}
      : {};
    const quantity = Math.max(Number(item.quantity || 1), 0.0001);
    const unitPrice = money(item.price || item.valor_unitario || 0);
    const total = money(item.subtotal ?? unitPrice * quantity);
    const ncm = String(
      item.ncm || item.fiscal_ncm || productFiscal.fiscal_ncm ||
        settings.ncm_padrao || "",
    ).replace(/\D/g, "").padStart(8, "0").slice(0, 8);
    const cstIbsCbs = onlyDigits(
      String(
        item.fiscal_ibs_cbs_cst || productFiscal.fiscal_ibs_cbs_cst || "",
      ),
    ).slice(0, 3);
    const cclassTrib = onlyDigits(
      String(
        item.fiscal_cclass_trib || productFiscal.fiscal_cclass_trib || "",
      ),
    ).slice(0, 6);
    const reducaoIbs = percentage(
      item.fiscal_reducao_ibs ?? productFiscal.fiscal_reducao_ibs ?? 0,
    );
    const reducaoCbs = percentage(
      item.fiscal_reducao_cbs ?? productFiscal.fiscal_reducao_cbs ?? 0,
    );
    const aliquotaIbsUf = percentage(settings.rtc_aliquota_ibs_uf ?? 0.1);
    const aliquotaIbsMun = percentage(settings.rtc_aliquota_ibs_mun ?? 0);
    const aliquotaCbs = percentage(settings.rtc_aliquota_cbs ?? 0.9);
    const baseIbsCbs = money(Math.max(0, total - money(item.discount || 0)));
    const aliquotaEfetivaIbsUf = effectiveRate(aliquotaIbsUf, reducaoIbs);
    const aliquotaEfetivaIbsMun = effectiveRate(aliquotaIbsMun, reducaoIbs);
    const aliquotaEfetivaCbs = effectiveRate(aliquotaCbs, reducaoCbs);
    const valorIbsUf = money(baseIbsCbs * aliquotaEfetivaIbsUf / 100);
    const valorIbsMun = money(baseIbsCbs * aliquotaEfetivaIbsMun / 100);
    const configuredRtc = normalizeRecord(
      item.rtc_config || item.fiscal_ibs_cbs_config ||
        productFiscal.fiscal_ibs_cbs_config,
    );
    const rtcConfig = Object.keys(configuredRtc).length ? configuredRtc : {
      enabled: Boolean(settings.rtc_enabled),
      mode: "standard",
      ibsUf: { rate: settings.rtc_aliquota_ibs_uf, reduction: reducaoIbs },
      ibsMun: { rate: settings.rtc_aliquota_ibs_mun, reduction: reducaoIbs },
      cbs: { rate: settings.rtc_aliquota_cbs, reduction: reducaoCbs },
    };
    const configuredIs = normalizeRecord(
      item.is_config || item.fiscal_is_config ||
        productFiscal.fiscal_is_config,
    );
    const selectiveConfig: Record<string, any> = {
      ...configuredIs,
      cst: configuredIs.cst || item.fiscal_is_cst ||
        productFiscal.fiscal_is_cst,
      cClassTrib: configuredIs.cClassTrib || item.fiscal_is_cclass_trib ||
        productFiscal.fiscal_is_cclass_trib,
    };
    const selectiveBase = money(
      selectiveConfig.vBC ?? baseIbsCbs,
    );
    const selectiveValue = selectiveConfig.enabled
      ? money(
        selectiveConfig.value ??
          selectiveBase * Number(selectiveConfig.rate || 0) / 100 +
            Number(selectiveConfig.quantity || 0) *
              Number(selectiveConfig.specificRate || 0) / 100,
      )
      : 0;
    return {
      product_id: item.product_id || null,
      regime_tributario: Number(settings.regime_tributario || 1),
      operation_type: String(item.operation_type || "sale"),
      fiscal_rule_id: item.fiscal_rule_id || null,
      codigo_produto: sanitizeCode(
        item.internal_code || productFiscal.internal_code || item.sku ||
          item.codigo_produto || item.product_id ||
          String(index + 1).padStart(6, "0"),
      ),
      descricao: String(
        item.product_name || item.name || item.descricao || `Item ${index + 1}`,
      ),
      ncm,
      // O CFOP deve vir da regra da operacao/destino. Trocar somente o
      // primeiro digito e inseguro: diversas familias nao possuem par direto
      // (por exemplo, 5.405 e 6.404). A validacao abaixo bloqueia divergencias.
      cfop: onlyDigits(
        item.cfop || item.fiscal_cfop || productFiscal.fiscal_cfop ||
          settings.cfop_padrao || "",
      ).slice(0, 4),
      unidade: String(item.unidade || "UN"),
      quantidade: quantity,
      valor_unitario: unitPrice,
      valor_total: total,
      valor_desconto: money(item.discount || 0),
      origem: String(item.fiscal_origem || productFiscal.fiscal_origem || "0")
        .replace(/\D/g, "").slice(0, 1) || "0",
      cest: String(item.fiscal_cest || productFiscal.fiscal_cest || "").replace(
        /\D/g,
        "",
      ).slice(0, 7) || null,
      cbenef:
        String(item.fiscal_beneficio || productFiscal.fiscal_beneficio || "")
          .trim() || null,
      informacoes_adicionais:
        String(item.fiscal_observacao || productFiscal.fiscal_observacao || "")
          .trim() || null,
      cst_icms: normalizeIcmsCode(
        Number(settings.regime_tributario || 1),
        item.csosn || item.cst_icms || item.fiscal_icms_cst ||
          (Number(settings.regime_tributario || 1) === 1
            ? item.fiscal_csosn || productFiscal.fiscal_csosn ||
              settings.csosn_padrao
            : productFiscal.fiscal_icms_cst || productFiscal.fiscal_csosn),
      ),
      icms_config: item.icms_config || item.fiscal_icms_config ||
        productFiscal.fiscal_icms_config || {},
      rtc_config: rtcConfig,
      is_config: selectiveConfig,
      is_cst: item.fiscal_is_cst || productFiscal.fiscal_is_cst || null,
      is_cclass_trib: item.fiscal_is_cclass_trib ||
        productFiscal.fiscal_is_cclass_trib || null,
      valor_is: selectiveValue,
      rtc_nt_version: item.fiscal_rtc_source_version ||
        settings.rtc_nt_version || null,
      rtc_table_version: item.fiscal_rtc_table_version ||
        settings.rtc_cclass_table_version || null,
      aliquota_icms: Number(item.aliquota_icms || 0),
      valor_icms: Number(item.valor_icms || 0),
      icms_st_base_retida: money(
        Number(
          item.fiscal_icms_st_base_ret_unit ??
            productFiscal.fiscal_icms_st_base_ret_unit ?? 0,
        ) * quantity,
      ),
      icms_st_aliquota: percentage(
        item.fiscal_icms_st_aliquota ?? productFiscal.fiscal_icms_st_aliquota ??
          0,
      ),
      icms_substituto: money(
        Number(
          item.fiscal_icms_substituto_unit ??
            productFiscal.fiscal_icms_substituto_unit ?? 0,
        ) * quantity,
      ),
      icms_st_retido: money(
        Number(
          item.fiscal_icms_st_ret_unit ??
            productFiscal.fiscal_icms_st_ret_unit ?? 0,
        ) * quantity,
      ),
      icms_efetivo_reducao: percentage(
        item.fiscal_icms_efetivo_reducao ??
          productFiscal.fiscal_icms_efetivo_reducao ?? 0,
      ),
      icms_efetivo_aliquota: percentage(
        item.fiscal_icms_efetivo_aliquota ??
          productFiscal.fiscal_icms_efetivo_aliquota ?? 0,
      ),
      cst_pis: String(
        item.cst_pis || item.fiscal_cst_pis || productFiscal.fiscal_cst_pis ||
          settings.cst_pis_padrao || "07",
      ),
      aliquota_pis: Number(item.aliquota_pis || 0),
      valor_pis: Number(item.valor_pis || 0),
      cst_cofins: String(
        item.cst_cofins || item.fiscal_cst_cofins ||
          productFiscal.fiscal_cst_cofins || settings.cst_cofins_padrao || "07",
      ),
      aliquota_cofins: Number(item.aliquota_cofins || 0),
      valor_cofins: Number(item.valor_cofins || 0),
      cst_ibs_cbs: cstIbsCbs,
      cclass_trib: cclassTrib,
      aliquota_ibs_uf: aliquotaIbsUf,
      aliquota_ibs_mun: aliquotaIbsMun,
      aliquota_cbs: aliquotaCbs,
      reducao_ibs: reducaoIbs,
      reducao_cbs: reducaoCbs,
      valor_base_ibs_cbs: baseIbsCbs,
      valor_ibs_uf: valorIbsUf,
      valor_ibs_mun: valorIbsMun,
      valor_ibs: money(valorIbsUf + valorIbsMun),
      valor_cbs: money(baseIbsCbs * aliquotaEfetivaCbs / 100),
    };
  });
}

function percentage(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function effectiveRate(nominalRate: number, reduction: number): number {
  return Number((nominalRate * (1 - percentage(reduction) / 100)).toFixed(4));
}

function normalizeTaxCst(value: string, fallback = "07") {
  return String(value || fallback).replace(/\D/g, "").padStart(2, "0").slice(
    0,
    2,
  ) || fallback;
}

function buildPisXml(item: any) {
  const cst = normalizeTaxCst(item.cst_pis);
  if (["01", "02"].includes(cst)) {
    return `<PIS><PISAliq><CST>${cst}</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISAliq></PIS>`;
  }
  if (cst === "03") {
    return `<PIS><PISQtde><CST>03</CST><qBCProd>0.0000</qBCProd><vAliqProd>0.0000</vAliqProd><vPIS>0.00</vPIS></PISQtde></PIS>`;
  }
  if (["04", "06", "07", "08", "09"].includes(cst)) {
    return `<PIS><PISNT><CST>${cst}</CST></PISNT></PIS>`;
  }
  return `<PIS><PISOutr><CST>${cst}</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`;
}

function buildCofinsXml(item: any) {
  const cst = normalizeTaxCst(item.cst_cofins);
  if (["01", "02"].includes(cst)) {
    return `<COFINS><COFINSAliq><CST>${cst}</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSAliq></COFINS>`;
  }
  if (cst === "03") {
    return `<COFINS><COFINSQtde><CST>03</CST><qBCProd>0.0000</qBCProd><vAliqProd>0.0000</vAliqProd><vCOFINS>0.00</vCOFINS></COFINSQtde></COFINS>`;
  }
  if (["04", "06", "07", "08", "09"].includes(cst)) {
    return `<COFINS><COFINSNT><CST>${cst}</CST></COFINSNT></COFINS>`;
  }
  return `<COFINS><COFINSOutr><CST>${cst}</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>`;
}

function validateFiscalItemsForEmission(
  items: any[],
  settings: any,
  operationDestination: 1 | 2 | 3 = 1,
) {
  const crt = Number(settings.regime_tributario || 0);
  if (![1, 2, 3].includes(crt)) {
    throw new Error(
      `CRT ${
        crt || "não informado"
      } inválido. Use 1 para Simples Nacional, 2 para Simples com excesso de sublimite ou 3 para regime normal.`,
    );
  }

  const errors: string[] = [];
  for (const [index, item] of items.entries()) {
    const label = `Item ${index + 1} (${
      item.descricao || item.codigo_produto
    })`;
    if (!/^\d{8}$/.test(String(item.ncm || ""))) {
      errors.push(`${label}: NCM deve ter 8 dígitos`);
    }
    if (!/^\d{4}$/.test(String(item.cfop || ""))) {
      errors.push(`${label}: CFOP deve ter 4 dígitos`);
    }
    const expectedCfopPrefix = String(
      operationDestination === 1 ? 5 : operationDestination === 2 ? 6 : 7,
    );
    if (
      /^\d{4}$/.test(String(item.cfop || "")) &&
      !String(item.cfop).startsWith(expectedCfopPrefix)
    ) {
      errors.push(
        `${label}: CFOP ${item.cfop} incompatível com operação ${
          operationDestination === 1
            ? "interna"
            : operationDestination === 2
            ? "interestadual"
            : "com o exterior"
        }`,
      );
    }
    const icmsCode = normalizeIcmsCode(crt, item.cst_icms);
    const acceptedCodes: readonly string[] = crt === 1
      ? SIMPLES_CSOSN
      : NORMAL_CST;
    if (!acceptedCodes.includes(icmsCode)) {
      errors.push(
        `${label}: ${crt === 1 ? "CSOSN" : "CST ICMS"} ${
          icmsCode || "(vazio)"
        } inválido`,
      );
    } else {
      try {
        validateIcmsItem({ ...item, cst_icms: icmsCode }, crt);
      } catch (error) {
        errors.push(`${label}: ${getErrorMessage(error)}`);
      }
    }
    if (!/^\d{2}$/.test(String(item.cst_pis || ""))) {
      errors.push(`${label}: CST PIS deve ter 2 dígitos`);
    }
    if (!/^\d{2}$/.test(String(item.cst_cofins || ""))) {
      errors.push(`${label}: CST COFINS deve ter 2 dígitos`);
    }
    if (item.cest && !/^\d{7}$/.test(String(item.cest))) {
      errors.push(`${label}: CEST deve ter 7 dígitos`);
    }
    if (["500", "60"].includes(icmsCode)) {
      if (!item.cest) {
        errors.push(
          `${label}: CEST é obrigatório para mercadoria com ICMS-ST retido`,
        );
      }
    }
    try {
      validateRtcItem(item);
    } catch (error) {
      errors.push(`${label}: ${getErrorMessage(error)}`);
    }
    const rtcConfig = normalizeRecord(item.rtc_config);
    const selectiveConfig = normalizeRecord(item.is_config);
    if (
      settings.rtc_strict_validation &&
      (rtcConfig.enabled || selectiveConfig.enabled)
    ) {
      if (!item.rtc_nt_version) {
        errors.push(`${label}: versão da Nota Técnica RTC não registrada`);
      }
      if (!item.rtc_table_version) {
        errors.push(
          `${label}: versão da tabela oficial CST/cClassTrib não registrada`,
        );
      }
      if (!item.fiscal_rule_id) {
        errors.push(
          `${label}: RTC exige regra fiscal versionada e aprovada, não apenas cadastro do produto`,
        );
      }
    }
  }
  if (errors.length) {
    throw new Error(
      `Cadastro fiscal dos produtos incompleto: ${
        errors.slice(0, 5).join("; ")
      }`,
    );
  }
}

export function generateNFCeXML(input: {
  fiscalSettings: any;
  cupom: any;
  order: any;
  items: any[];
  consumerData?: any;
  observacoes?: string;
  paymentMethod: string;
  deliveryFee: number;
  totalProdutos: number;
  valorDesconto: number;
  valorTotal: number;
  valorTributos: number;
  modelCode?: "55" | "65";
}): string {
  const {
    fiscalSettings,
    cupom,
    order,
    items,
    consumerData,
    observacoes,
    paymentMethod,
    deliveryFee,
    totalProdutos,
    valorDesconto,
    valorTotal,
    valorTributos,
    modelCode = "65",
  } = input;
  const isHomologacao = fiscalSettings.ambiente !== "producao";
  const operationDestination = resolveOperationDestination(
    fiscalSettings,
    consumerData,
    modelCode,
  );
  const dhEmi = formatNfeDate(
    new Date(cupom.data_hora_emissao),
    fiscalSettings.endereco_uf,
  );
  const codigoMunicipio = resolveMunicipalityCode(fiscalSettings);
  const consumidorDoc = onlyDigits(consumerData?.cpf_cnpj);
  const detXml = items.map((item, index) => {
    const productName = isHomologacao && index === 0
      ? "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
      : item.descricao;
    const cestXml = item.cest ? `<CEST>${escapeXml(item.cest)}</CEST>` : "";
    const benefitXml = item.cbenef
      ? `<cBenef>${escapeXml(item.cbenef)}</cBenef>`
      : "";
    const additionalXml = item.informacoes_adicionais
      ? `<infAdProd>${escapeXml(item.informacoes_adicionais)}</infAdProd>`
      : "";
    return `<det nItem="${index + 1}"><prod><cProd>${
      escapeXml(item.codigo_produto)
    }</cProd><cEAN>SEM GTIN</cEAN><xProd>${
      escapeXml(productName)
    }</xProd><NCM>${item.ncm}</NCM>${cestXml}${benefitXml}<CFOP>${item.cfop}</CFOP><uCom>${
      escapeXml(item.unidade)
    }</uCom><qCom>${fixed4(item.quantidade)}</qCom><vUnCom>${
      fixed4(item.valor_unitario)
    }</vUnCom><vProd>${
      fixed2(item.valor_total)
    }</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${
      escapeXml(item.unidade)
    }</uTrib><qTrib>${fixed4(item.quantidade)}</qTrib><vUnTrib>${
      fixed4(item.valor_unitario)
    }</vUnTrib><indTot>1</indTot></prod><imposto><vTotTrib>${
      fixed2(item.valor_total * 0.0765)
    }</vTotTrib>${
      buildIcmsGroupXml(item, Number(fiscalSettings.regime_tributario || 1))
    }${buildPisXml(item)}${buildCofinsXml(item)}${
      buildRtcItemXml(item)
    }</imposto>${additionalXml}</det>`;
  }).join("");

  const recipientAddressXml = modelCode === "55"
    ? `<enderDest><xLgr>${escapeXml(consumerData?.address || "")}</xLgr><nro>${
      escapeXml(consumerData?.address_number || "")
    }</nro>${
      consumerData?.address_complement
        ? `<xCpl>${escapeXml(consumerData.address_complement)}</xCpl>`
        : ""
    }<xBairro>${escapeXml(consumerData?.neighborhood || "")}</xBairro><cMun>${
      onlyDigits(consumerData?.city_code)
    }</cMun><xMun>${escapeXml(consumerData?.city || "")}</xMun><UF>${
      escapeXml(String(consumerData?.state || "").toUpperCase())
    }</UF><CEP>${
      onlyDigits(consumerData?.postal_code)
    }</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderDest>`
    : "";
  const recipientIe = String(consumerData?.state_registration || "").trim();
  const destXml = consumidorDoc
    ? `<dest>${
      consumidorDoc.length === 11
        ? `<CPF>${consumidorDoc}</CPF>`
        : `<CNPJ>${consumidorDoc}</CNPJ>`
    }${
      consumerData?.nome ? `<xNome>${escapeXml(consumerData.nome)}</xNome>` : ""
    }${recipientAddressXml}<indIEDest>${
      Number(consumerData?.state_registration_indicator || 9)
    }</indIEDest>${recipientIe ? `<IE>${escapeXml(recipientIe)}</IE>` : ""}${
      consumerData?.email
        ? `<email>${escapeXml(consumerData.email)}</email>`
        : ""
    }</dest>`
    : "";
  const paymentXml = buildPaymentDetailsXml(order, paymentMethod, valorTotal);
  const icmsTotals = calculateIcmsTotals(items);

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${cupom.chave_acesso}" versao="4.00"><ide><cUF>${
    getCodigoUF(fiscalSettings.endereco_uf)
  }</cUF><cNF>${cupom.chave_acesso.substring(35, 43)}</cNF><natOp>${
    escapeXml(fiscalSettings.operation_nature || "Venda de mercadoria")
  }</natOp><mod>${modelCode}</mod><serie>${
    Number(cupom.serie)
  }</serie><nNF>${cupom.numero}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>${operationDestination}</idDest><cMunFG>${codigoMunicipio}</cMunFG><tpImp>${
    modelCode === "55" ? "1" : "4"
  }</tpImp><tpEmis>1</tpEmis><cDV>${cupom.chave_acesso.slice(-1)}</cDV><tpAmb>${
    isHomologacao ? "2" : "1"
  }</tpAmb><finNFe>1</finNFe><indFinal>${
    consumerData?.final_consumer === false ? "0" : "1"
  }</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>PopSystem-1.0</verProc></ide><emit><CNPJ>${
    onlyDigits(fiscalSettings.cnpj)
  }</CNPJ><xNome>${escapeXml(fiscalSettings.razao_social)}</xNome><xFant>${
    escapeXml(fiscalSettings.nome_fantasia || fiscalSettings.razao_social)
  }</xFant><enderEmit><xLgr>${
    escapeXml(fiscalSettings.endereco_logradouro)
  }</xLgr><nro>${escapeXml(fiscalSettings.endereco_numero)}</nro>${
    fiscalSettings.endereco_complemento
      ? `<xCpl>${escapeXml(fiscalSettings.endereco_complemento)}</xCpl>`
      : ""
  }<xBairro>${
    escapeXml(fiscalSettings.endereco_bairro)
  }</xBairro><cMun>${codigoMunicipio}</cMun><xMun>${
    escapeXml(fiscalSettings.endereco_municipio)
  }</xMun><UF>${escapeXml(fiscalSettings.endereco_uf)}</UF><CEP>${
    onlyDigits(fiscalSettings.endereco_cep)
  }</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>${
    escapeXml(fiscalSettings.inscricao_estadual || "ISENTO")
  }</IE><CRT>${
    Number(fiscalSettings.regime_tributario || 1)
  }</CRT></emit>${destXml}${detXml}<total><ICMSTot><vBC>${
    fixed2(icmsTotals.vBC)
  }</vBC><vICMS>${fixed2(icmsTotals.vICMS)}</vICMS><vICMSDeson>${
    fixed2(icmsTotals.vICMSDeson)
  }</vICMSDeson><vFCP>${fixed2(icmsTotals.vFCP)}</vFCP><vBCST>${
    fixed2(icmsTotals.vBCST)
  }</vBCST><vST>${fixed2(icmsTotals.vST)}</vST><vFCPST>${
    fixed2(icmsTotals.vFCPST)
  }</vFCPST><vFCPSTRet>${fixed2(icmsTotals.vFCPSTRet)}</vFCPSTRet><vProd>${
    fixed2(totalProdutos)
  }</vProd><vFrete>${fixed2(deliveryFee)}</vFrete><vSeg>0.00</vSeg><vDesc>${
    fixed2(valorDesconto)
  }</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${
    fixed2(valorTotal)
  }</vNF><vTotTrib>${fixed2(valorTributos)}</vTotTrib></ICMSTot>${
    buildRtcTotalsXml(items, valorTotal)
  }</total><transp><modFrete>9</modFrete></transp><pag>${paymentXml}</pag>${
    observacoes
      ? `<infAdic><infCpl>${escapeXml(observacoes)}</infCpl></infAdic>`
      : ""
  }</infNFe></NFe>`;
}

export function resolveOperationDestination(
  fiscalSettings: any,
  consumerData: NFCeData["consumer_data"] | undefined,
  modelCode: "55" | "65" = "65",
): 1 | 2 | 3 {
  if (modelCode === "65") return 1;
  const issuerState = String(fiscalSettings?.endereco_uf || "").trim()
    .toUpperCase();
  const recipientState = String(consumerData?.state || "").trim().toUpperCase();
  const countryCode = onlyDigits(consumerData?.country_code || "1058");
  if (recipientState === "EX" || (countryCode && countryCode !== "1058")) {
    return 3;
  }
  if (!/^[A-Z]{2}$/.test(issuerState) || !/^[A-Z]{2}$/.test(recipientState)) {
    throw new Error(
      "Não foi possível determinar o destino fiscal: confira a UF do emitente e do destinatário.",
    );
  }
  return issuerState === recipientState ? 1 : 2;
}

export function normalizeCfopForDestination(
  cfopValue: unknown,
  operationDestination: 1 | 2 | 3,
): string {
  const cfop = onlyDigits(String(cfopValue || ""));
  if (!/^\d{4}$/.test(cfop)) return cfop;
  if (!/^[567]/.test(cfop)) {
    throw new Error(`CFOP ${cfop} inválido para uma operação de saída.`);
  }
  const expectedPrefix = operationDestination === 1
    ? "5"
    : operationDestination === 2
    ? "6"
    : "7";
  if (cfop.startsWith(expectedPrefix)) return cfop;

  // Correspondências explícitas. A legislação não permite inferir um CFOP
  // trocando somente o primeiro dígito (por exemplo, 5.405 corresponde a
  // 6.404, e não a 6.405). Novas famílias devem entrar nesta matriz somente
  // depois da validação fiscal.
  const families: string[][] = [
    ["5101", "6101", "7101"],
    ["5102", "6102", "7102"],
    ["5405", "6404"],
  ];
  const family = families.find((codes) => codes.includes(cfop));
  const resolved = family?.find((code) => code.startsWith(expectedPrefix));
  if (resolved) return resolved;

  throw new Error(
    `CFOP ${cfop} não possui correspondência fiscal aprovada para idDest ${operationDestination}. Cadastre a regra exata da operação.`,
  );
}

function buildPaymentDetailsXml(
  order: any,
  paymentMethod: string,
  valorTotal: number,
): string {
  const lines = normalizeFiscalPaymentLines(order, paymentMethod, valorTotal);
  return lines.map((line: { method: string; amount: number }) => {
    const tPag = mapPaymentMethod(line.method);
    const cardXml = buildPaymentCardXml(tPag, order, line.method);
    return `<detPag><indPag>0</indPag><tPag>${tPag}</tPag><vPag>${
      fixed2(line.amount)
    }</vPag>${cardXml}</detPag>`;
  }).join("");
}

function normalizeFiscalPaymentLines(
  order: any,
  paymentMethod: string,
  valorTotal: number,
): Array<{ method: string; amount: number }> {
  const splitLines = Array.isArray(order?.variations?.payment_split?.lines)
    ? order.variations.payment_split.lines
    : [];

  const validSplitLines = splitLines
    .map((line: any) => ({
      method: normalizeFiscalPaymentMethod(
        line?.method || line?.label || paymentMethod,
      ),
      amount: money(Number(line?.amount || 0)),
    }))
    .filter((line: any) => line.amount > 0);

  if (validSplitLines.length > 0) {
    const totals = new Map<string, number>();
    validSplitLines.forEach((line: { method: string; amount: number }) => {
      totals.set(
        line.method,
        money((totals.get(line.method) || 0) + line.amount),
      );
    });
    return Array.from(totals, ([method, amount]) => ({ method, amount }));
  }

  return [{
    method: normalizeFiscalPaymentMethod(paymentMethod),
    amount: money(valorTotal),
  }];
}

function normalizeFiscalPaymentMethod(method: string): string {
  const normalized = normalizeTextKey(String(method || "")).replace(
    /[^A-Z0-9]/g,
    "_",
  );
  if (normalized.includes("PIX")) {
    return normalized.includes("ONLINE") ? "pix_online" : "pix";
  }
  if (normalized.includes("DEBITO") || normalized.includes("DEBIT")) {
    return "cartao_debito";
  }
  if (normalized.includes("CREDITO") || normalized.includes("CREDIT")) {
    return "cartao_credito";
  }
  if (normalized.includes("CARTAO") || normalized.includes("CARD")) {
    return "cartao_credito";
  }
  if (normalized.includes("DINHEIRO") || normalized.includes("CASH")) {
    return "dinheiro";
  }
  return String(method || "");
}

function buildPaymentCardXml(tPag: string, order: any, method: string): string {
  if (!["03", "04", "17"].includes(tPag)) return "";

  if (tPag === "17") {
    return "<card><tpIntegra>2</tpIntegra></card>";
  }

  const tef = order?.variations?.tef || {};
  const acquirerCnpj = onlyDigits(tef?.acquirer_cnpj || tef?.cnpj || "");
  const authorizationCode = String(
    tef?.auth || tef?.authorization_code || tef?.cAut || "",
  ).trim();
  const brandCode = mapCardBrand(tef?.brand);

  if (
    acquirerCnpj.length === 14 && authorizationCode &&
    ["03", "04"].includes(tPag)
  ) {
    return `<card><tpIntegra>1</tpIntegra><CNPJ>${acquirerCnpj}</CNPJ>${
      brandCode ? `<tBand>${brandCode}</tBand>` : ""
    }<cAut>${escapeXml(authorizationCode).slice(0, 128)}</cAut></card>`;
  }

  return "<card><tpIntegra>2</tpIntegra></card>";
}

function mapCardBrand(value: unknown): string {
  const brand = normalizeTextKey(String(value || ""));
  if (!brand) return "";
  if (brand.includes("VISA")) return "01";
  if (brand.includes("MASTER")) return "02";
  if (brand.includes("AMERICAN") || brand.includes("AMEX")) return "03";
  if (brand.includes("SOROCRED")) return "04";
  if (brand.includes("DINERS")) return "05";
  if (brand.includes("ELO")) return "06";
  if (brand.includes("HIPER")) return "07";
  if (brand.includes("AURA")) return "08";
  if (brand.includes("CABAL")) return "09";
  return "99";
}

function mapPaymentMethod(method: string): string {
  const normalized = normalizeFiscalPaymentMethod(method);
  if (normalized.includes("pix")) return "17";
  if (normalized.includes("cartao_debito")) return "04";
  if (normalized.includes("cartao_credito")) return "03";
  if (normalized.includes("dinheiro")) return "01";
  return "99";
}

function getCodigoUF(uf: string): string {
  const codigos: Record<string, string> = {
    AC: "12",
    AL: "27",
    AP: "16",
    AM: "13",
    BA: "29",
    CE: "23",
    DF: "53",
    ES: "32",
    GO: "52",
    MA: "21",
    MT: "51",
    MS: "50",
    MG: "31",
    PA: "15",
    PB: "25",
    PR: "41",
    PE: "26",
    PI: "22",
    RJ: "33",
    RN: "24",
    RS: "43",
    RO: "11",
    RR: "14",
    SC: "42",
    SP: "35",
    SE: "28",
    TO: "17",
  };
  const normalizedUf = String(uf || "").toUpperCase();
  const codigo = codigos[normalizedUf];
  if (!codigo) {
    throw new Error(`UF fiscal invalida ou nao suportada: ${uf || "(vazia)"}`);
  }
  return codigo;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function required(value: string | undefined, field: string): string {
  if (!value) throw new Error(`${field} e obrigatorio`);
  return value;
}

function onlyDigits(value?: string): string {
  return String(value || "").replace(/\D/g, "");
}

function sanitizeCode(value: string): string {
  return String(value || "").replace(/[^\w.-]/g, "").slice(0, 60) || "000001";
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

function fixed2(value: number): string {
  return money(value).toFixed(2);
}

function fixed4(value: number): string {
  return Number(value || 0).toFixed(4);
}

function getNfeTimeZone(uf: string): string {
  return NFE_TIMEZONES[String(uf || "").toUpperCase()] || "America/Sao_Paulo";
}

function getNfeDateParts(date: Date, uf: string) {
  const timeZone = getNfeTimeZone(uf);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const offsetName =
    offsetFormatter.formatToParts(date).find((part) =>
      part.type === "timeZoneName"
    )?.value || "GMT-03:00";
  const offset = offsetName.replace(/^GMT/i, "") || "-03:00";
  return {
    year: parts.year || String(date.getUTCFullYear()),
    month: parts.month || String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: parts.day || String(date.getUTCDate()).padStart(2, "0"),
    hour: parts.hour === "24" ? "00" : (parts.hour || "00"),
    minute: parts.minute || "00",
    second: parts.second || "00",
    offset: /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : "-03:00",
  };
}

function formatNfeDate(date: Date, uf: string): string {
  const parts = getNfeDateParts(date, uf);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${parts.offset}`;
}

function normalizeTextKey(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function resolveMunicipalityCode(settings: any): string {
  const raw = onlyDigits(settings?.codigo_municipio);
  if (raw.length === 7) return raw;
  const uf = String(settings?.endereco_uf || "").toUpperCase();
  const city = normalizeTextKey(settings?.endereco_municipio);
  return MUNICIPALITY_CODE_OVERRIDES[`${uf}|${city}`] || raw;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error || "Erro desconhecido");
}
