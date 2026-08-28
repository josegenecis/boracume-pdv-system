export type CnpjRegistrationData = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  codigo_municipio: string;
  inscricao_estadual: string;
  regime_tributario?: number;
  situacao_cadastral?: string;
  source: 'cnpj_ws' | 'brasil_api';
};

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const clean = (value: unknown) => String(value ?? '').trim();
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export function isValidCnpj(value: unknown) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (baseLength: number) => {
    let factor = baseLength - 7;
    let total = 0;
    for (let index = 0; index < baseLength; index += 1) {
      total += Number(cnpj[index]) * factor--;
      if (factor < 2) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(cnpj[12]) && calculateDigit(13) === Number(cnpj[13]);
}

const simpleNationalRegime = (value: unknown) => {
  if (value === true) return 1;
  const normalized = clean(value).toLowerCase();
  return ['sim', 's', 'true', '1'].includes(normalized) ? 1 : undefined;
};

export function normalizeCnpjWs(data: unknown, requestedCnpj: string): CnpjRegistrationData | null {
  const root = record(data);
  const establishment = record(root.estabelecimento);
  const state = record(establishment.estado);
  const city = record(establishment.cidade);
  const simples = record(root.simples);
  const returnedCnpj = onlyDigits(establishment.cnpj);
  if (!Object.keys(establishment).length || returnedCnpj !== onlyDigits(requestedCnpj)) return null;

  const uf = clean(state.sigla).toUpperCase();
  const stateRegistrations = Array.isArray(establishment.inscricoes_estaduais)
    ? establishment.inscricoes_estaduais.map(record)
    : [];
  const activeStateRegistration = stateRegistrations.find((item) =>
    item.ativo !== false && (!uf || clean(record(item.estado).sigla).toUpperCase() === uf)
  ) || stateRegistrations.find((item) => item.ativo !== false) || stateRegistrations[0];
  const streetType = clean(establishment.tipo_logradouro);
  const streetName = clean(establishment.logradouro);

  return {
    cnpj: returnedCnpj,
    razao_social: clean(root.razao_social),
    nome_fantasia: clean(establishment.nome_fantasia),
    logradouro: [streetType, streetName].filter(Boolean).join(' '),
    numero: clean(establishment.numero),
    complemento: clean(establishment.complemento),
    bairro: clean(establishment.bairro),
    municipio: clean(city.nome),
    uf,
    cep: onlyDigits(establishment.cep),
    codigo_municipio: onlyDigits(city.ibge_id),
    inscricao_estadual: onlyDigits(activeStateRegistration?.inscricao_estadual),
    regime_tributario: simpleNationalRegime(simples.simples),
    situacao_cadastral: clean(establishment.situacao_cadastral),
    source: 'cnpj_ws',
  };
}

export function normalizeBrasilApi(data: unknown, requestedCnpj: string): CnpjRegistrationData | null {
  const root = record(data);
  const returnedCnpj = onlyDigits(root.cnpj);
  if (returnedCnpj !== onlyDigits(requestedCnpj)) return null;

  const stateRegistrations = Array.isArray(root.inscricoes_estaduais)
    ? root.inscricoes_estaduais.map(record)
    : [];
  const activeStateRegistration = stateRegistrations.find((item) => item.ativo !== false) || stateRegistrations[0];
  const streetType = clean(root.descricao_tipo_de_logradouro);
  const streetName = clean(root.logradouro);

  return {
    cnpj: returnedCnpj,
    razao_social: clean(root.razao_social || root.nome),
    nome_fantasia: clean(root.nome_fantasia || root.fantasia),
    logradouro: streetType && !streetName.toUpperCase().startsWith(streetType.toUpperCase())
      ? `${streetType} ${streetName}`.trim()
      : streetName,
    numero: clean(root.numero),
    complemento: clean(root.complemento),
    bairro: clean(root.bairro),
    municipio: clean(root.municipio),
    uf: clean(root.uf).toUpperCase(),
    cep: onlyDigits(root.cep),
    // NFC-e/NF-e exige o código IBGE de 7 dígitos, não o código SIAFI.
    codigo_municipio: onlyDigits(root.codigo_municipio_ibge),
    inscricao_estadual: onlyDigits(activeStateRegistration?.inscricao_estadual || activeStateRegistration?.ie),
    regime_tributario: simpleNationalRegime(root.opcao_pelo_simples),
    situacao_cadastral: clean(root.descricao_situacao_cadastral || root.situacao_cadastral),
    source: 'brasil_api',
  };
}
