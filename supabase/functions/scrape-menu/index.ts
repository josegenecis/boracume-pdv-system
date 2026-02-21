
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
declare const Deno: any;

// @ts-ignore
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log("Edge Function scrape-menu V11 (Skip Step & Image Rehosting) iniciada!");

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const bodyText = await req.text();
    if (!bodyText) throw new Error('Body vazio');
    
    let body;
    try {
        body = JSON.parse(bodyText);
    } catch (e) {
        throw new Error('JSON inválido no body');
    }

    const { type, data, action = 'start', runId } = body;
    console.log(`[ScrapeMenu] Action: ${action}, Type: ${type}, RunID: ${runId}`);

    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // =================================================================================
    // ROTA 1: START
    // =================================================================================
    if (action === 'start') {
        if (type === 'url') {
             const rawUrl = String(data || '').trim();
             let parsedUrl: URL | null = null;
             try {
                 parsedUrl = new URL(rawUrl);
                 if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') parsedUrl = null;
             } catch {
                 parsedUrl = null;
             }

             if (!parsedUrl) {
                 return new Response(
                   JSON.stringify({ success: false, status: 'failed', error: 'URL inválida.' }),
                   { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                 );
             }

             // 1. iFood Logic
             if (APIFY_TOKEN && rawUrl.includes('ifood.com.br')) {
                const ifoodIdMatch = rawUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
                const storeId = ifoodIdMatch ? ifoodIdMatch[1] : null;

                if (storeId) {
                    console.log(`[Start] Iniciando Apify iFood Async para loja: ${storeId}`);
                    
                    const runUrl = `https://api.apify.com/v2/acts/priscilas~ifood-menu-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=1`;
                    
                    const inputPayload = {
                        "store_ids": [storeId],
                        "proxyConfiguration": { "useApifyProxy": true },
                        "latitude": "-23.550520",
                        "longitude": "-46.633308"
                    };
                    
                    console.log("[Start] Payload enviado para Apify:", JSON.stringify(inputPayload));

                    const startResp = await fetch(runUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(inputPayload)
                    });

                    if (!startResp.ok) {
                        const errText = await startResp.text();
                        console.error(`[Start] Erro Apify: ${startResp.status} - ${errText}`);
                        throw new Error(`Erro ao iniciar Apify: ${startResp.status} - ${errText}`);
                    }
                    
                    const startData = await startResp.json();
                    const dsId = startData?.data?.defaultDatasetId;
                    const status = startData?.data?.status;
                    if (status === 'SUCCEEDED' && dsId) {
                      const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
                      const items = await itemsResp.json();
                      let menuItems: any[] = [];
                      if (items[0]?.menu && Array.isArray(items[0].menu)) {
                        menuItems = items[0].menu;
                      } else if (items[0]?.categories && Array.isArray(items[0].categories)) {
                        for (const cat of items[0].categories) {
                          if (cat.items && Array.isArray(cat.items)) {
                            menuItems.push(...cat.items.map((i: any) => ({ ...i, category: cat.name })));
                          }
                        }
                      } else {
                        menuItems = items;
                      }
                      const mappedCategories = mapApifyItemsToCategories(menuItems);
                      const consolidated = consolidateVariantsAndCategories(mappedCategories);
                      let aiStructured: any[] = [];
                      try {
                        const rawText = JSON.stringify(menuItems).slice(0, 200000);
                        aiStructured = await aiStructurize(rawText, OPENAI_API_KEY);
                      } catch {}
                      const finalCats = aiStructured.length > 0 ? aiStructured : (consolidated.length > 0 ? consolidated : mappedCategories);
                      return new Response(
                        JSON.stringify({ success: true, status: 'completed', categories: finalCats }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                      );
                    }
                    return new Response(
                      JSON.stringify({ success: true, runId: startData?.data?.id, status: 'started' }),
                      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                    );
                }
             }

            if (!APIFY_TOKEN) {
              throw new Error('APIFY_TOKEN não configurado.');
            }
            console.log(`[Start] Iniciando Apify Web Scraper (terceiros)...`);
            const runUrl = `https://api.apify.com/v2/acts/apify~web-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=1`;
            const pageFunction = `
              async function pageFunction(context) {
                const { jQuery, request } = context;
                const $ = jQuery;
                function norm(t){ try{ return (t||'').replace(/\\s+/g,' ').trim(); }catch{ return ''; } }
                function priceOf(el){
                  const txt = norm($(el).text());
                  const m = txt.match(/R\\$\\s?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})/);
                  if(!m) return 0;
                  try{ return Number(m[0].replace('R$','').replace(/\\./g,'').replace(',','.').trim()); }catch{ return 0; }
                }
                function imgOf(el){
                  let src = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
                  src = norm(src);
                  if(src && src.startsWith('//')) src = 'https:' + src;
                  if(src && src.startsWith('http')) return src;
                  return null;
                }
                function parseVariations(container){
                  const groups = [];
                  const groupSel = '.add-ons, .addons, .options-group, .variations, .complements, [class*=adicionais], [class*=acompanha], [class*=opcoes]';
                  $(container).find(groupSel).each((i, g) => {
                    const name = norm($(g).find('h4, h3, .group-title, .title').first().text()) || 'Adicionais';
                    const options = [];
                    $(g).find('label, .option, .item, .checkbox, .radio').each((j, o) => {
                      const nm = norm($(o).text());
                      const pr = priceOf(o);
                      if(nm) options.push({ name: nm, price: Math.max(0, pr) });
                    });
                    if(options.length>0) groups.push({ name, required: false, max_selections: 1, options });
                  });
                  return groups;
                }
                function collectProducts(container){
                  const items = [];
                  const itemSel = '.product, .item, .menu-item, .card, .card-product, [class*=produto], [class*=item]';
                  $(container).find(itemSel).each((i, el) => {
                    const name = norm($(el).find('h1, h2, h3, .title, .name, [class*=nome]').first().text());
                    const desc = norm($(el).find('.description, .desc, [class*=descri]').first().text());
                    const price = priceOf(el);
                    const img = imgOf(el);
                    const variations = parseVariations(el);
                    if(name && price>0){
                      items.push({ name, description: desc || '', price, image_url: img, variations });
                    }
                  });
                  return items;
                }
                const anchorSel = 'h1, h2, h3, .category-title, .menu-category, .group-title, .section-title, [class*=categoria], [class*=category], [class*=secao]';
                const anchors = $(anchorSel).filter(function(){ return norm($(this).text()).length>0; }).toArray();
                const categories = [];
                for(let i=0;i<anchors.length;i++){
                  const h = anchors[i];
                  const name = norm($(h).text());
                  if(!name) continue;
                  const section = $(h).nextUntil(anchorSel);
                  let items = collectProducts(section.length ? section : $(h).parent());
                  if(items.length===0) items = collectProducts($(h).parent());
                  if(items.length>0) categories.push({ name, items });
                }
                if(categories.length===0){
                  const items = collectProducts('body');
                  if(items.length>0) categories.push({ name: 'Geral', items });
                }
                const merged = {};
                for(const c of categories){
                  const key = c.name;
                  if(!merged[key]) merged[key] = [];
                  merged[key] = merged[key].concat(c.items);
                }
                const out = Object.entries(merged).map(([name, items]) => ({ name, items }));
                return { categories: out };
              }
            `;
            const inputPayload = {
              startUrls: [{ url: rawUrl }],
              maxRequestsPerCrawl: 10,
              proxyConfiguration: { useApifyProxy: true },
              pageFunction,
              linkSelector: 'a[href*=\"produto\"], a[href*=\"product\"], .product a, .item a'
            };
            const startResp = await fetch(runUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(inputPayload)
            });
            if (!startResp.ok) {
              const errText = await startResp.text();
              console.error(`[Start] Erro Web Scraper: ${startResp.status} - ${errText}`);
              throw new Error(`Erro ao iniciar Web Scraper: ${startResp.status}`);
            }
            const startData = await startResp.json();
            const dsId = startData?.data?.defaultDatasetId;
            const status = startData?.data?.status;
            if (status === 'SUCCEEDED' && dsId) {
              const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
              const items = await itemsResp.json();
              let menuItems: any[] = [];
              if (items[0]?.menu && Array.isArray(items[0].menu)) {
                menuItems = items[0].menu;
              } else if (items[0]?.categories && Array.isArray(items[0].categories)) {
                for (const cat of items[0].categories) {
                  if (cat.items && Array.isArray(cat.items)) {
                    menuItems.push(...cat.items.map((i: any) => ({ ...i, category: cat.name })));
                  }
                }
              } else {
                menuItems = items;
              }
              const mappedCategories = mapApifyItemsToCategories(menuItems);
              const consolidated = consolidateVariantsAndCategories(mappedCategories);
              let aiStructured: any[] = [];
              try {
                const rawText = JSON.stringify(menuItems).slice(0, 200000);
                aiStructured = await aiStructurize(rawText, OPENAI_API_KEY);
              } catch {}
              const finalCats = aiStructured.length > 0 ? aiStructured : (consolidated.length > 0 ? consolidated : mappedCategories);
              return new Response(
                JSON.stringify({ success: true, status: 'completed', categories: finalCats }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
              );
            }
            return new Response(
              JSON.stringify({ success: true, runId: startData?.data?.id, status: 'started' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }
        
        if (type === 'image') {
             const result = await processWithAI(data, OPENAI_API_KEY, true);
             return result;
        }
    }

    // =================================================================================
    // ROTA 2: CHECK
    // =================================================================================
    if (action === 'check') {
        if (!runId) throw new Error('RunId obrigatório para check.');

        const checkResp = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
        const checkData = await checkResp.json();
        const status = checkData.data.status;

        console.log(`[Check] Status atual: ${status}`);

        if (status === 'RUNNING' || status === 'READY') {
            return new Response(
                JSON.stringify({ success: true, status: 'processing' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        if (status === 'SUCCEEDED') {
            const datasetId = checkData.data.defaultDatasetId;
            console.log(`[Check] Sucesso! Baixando dataset: ${datasetId}`);
            
            const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
            const items = await itemsResp.json();

            if (!items || items.length === 0) {
                return new Response(
                    JSON.stringify({ success: false, status: 'failed', error: 'Dataset vazio. O scraper não encontrou itens.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }

            // Lógica de extração
            let menuItems: any[] = [];
            
            if (items[0].menu && Array.isArray(items[0].menu)) {
                menuItems = items[0].menu;
            } else if (items[0].categories && Array.isArray(items[0].categories)) {
                for (const cat of items[0].categories) {
                    if (cat.items && Array.isArray(cat.items)) {
                        menuItems.push(...cat.items.map((i: any) => ({ ...i, category: cat.name })));
                    }
                }
            } else {
                menuItems = items;
            }

            if (menuItems.length > 0) {
                 const mappedCategories = mapApifyItemsToCategories(menuItems);
                 const consolidated = consolidateVariantsAndCategories(mappedCategories);
                 
                 // IA pós-processamento para estruturar categorias/complementos/variações
                 let aiStructured: any[] = [];
                 try {
                   const rawText = JSON.stringify(menuItems).slice(0, 200000);
                   aiStructured = await aiStructurize(rawText, OPENAI_API_KEY);
                 } catch (e) {
                   console.warn('[Check] IA estruturadora falhou, usando consolidação heurística.', e);
                 }
                 
                 const totalItems = mappedCategories.reduce((acc: number, c: any) => acc + (Array.isArray(c.items) ? c.items.length : 0), 0);
                 const withDesc = mappedCategories.reduce((acc: number, c: any) => acc + (Array.isArray(c.items) ? c.items.filter((i: any) => String(i.description || '').trim()).length : 0), 0);
                 const withImg = mappedCategories.reduce((acc: number, c: any) => acc + (Array.isArray(c.items) ? c.items.filter((i: any) => String(i.image_url || '').trim()).length : 0), 0);
                 const descOk = totalItems > 0 ? withDesc / totalItems >= 0.5 : false;
                 const imgOk = totalItems > 0 ? withImg / totalItems >= 0.5 : false;
                 
                 if (!(descOk && imgOk)) {
                   const jsonContent = JSON.stringify(menuItems.slice(0, 120));
                   const aiResult = await processWithAI(jsonContent, OPENAI_API_KEY, false, true);
                   return aiResult;
                 }
                 
                 if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
                     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
                     try {
                       const { data: buckets } = await supabase.storage.listBuckets();
                       const exists = Array.isArray(buckets) && buckets.some((b: any) => b.name === 'product-images');
                       if (!exists) {
                         await supabase.storage.createBucket('product-images', { public: true, fileSizeLimit: 10485760 });
                       }
                     } catch {}
 
                     const uploadImage = async (url: string) => {
                         try {
                             if (!url || !url.startsWith('http')) return null;
                             const resp = await fetch(url);
                             if (!resp.ok) return null;
                             const blob = await resp.blob();
                             const ext = blob.type.split('/')[1] || 'jpg';
                             const filename = `${crypto.randomUUID()}.${ext}`;
                             
                             const { error: uploadError } = await supabase.storage
                                .from('product-images')
                                .upload(filename, blob, { contentType: blob.type, upsert: false });
                             
                             if (uploadError) {
                                 console.warn(`[Check] Erro upload: ${uploadError.message}`);
                                 return null;
                             }
                             
                             const { data: { publicUrl } } = supabase.storage
                                .from('product-images')
                                .getPublicUrl(filename);
                                
                             return publicUrl;
                         } catch (e) {
                             console.warn(`[Check] Erro fetch imagem: ${e}`);
                             return null;
                         }
                     };

                     // Processar categorias em paralelo
                     const catsForImages = (aiStructured.length > 0 ? aiStructured : (consolidated.length > 0 ? consolidated : mappedCategories));
                     await Promise.all(catsForImages.map(async (cat: any) => {
                         if (cat.items) {
                             // Processar itens em paralelo (limitado a 5 por vez por categoria para não estourar)
                             const itemsWithImages = (cat.items || []).filter((i: any) => i.image_url);
                             for (const item of itemsWithImages) {
                                 // Tentar re-hospedar
                                 const newUrl = await uploadImage(item.image_url);
                                 if (newUrl) {
                                     item.image_url = newUrl;
                                 } else {
                                     // Se falhar, manter original (o frontend tem fallback)
                                     // Ou setar null se quisermos ser estritos? Melhor manter.
                                     console.log(`[Check] Falha ao re-hospedar ${item.image_url}, mantendo original.`);
                                 }
                             }
                         }
                     }));
                 }

                 const finalCats = aiStructured.length > 0 ? aiStructured : (consolidated.length > 0 ? consolidated : mappedCategories);
                 if (finalCats.length > 0) {
                      return new Response(
                        JSON.stringify({ success: true, status: 'completed', categories: finalCats }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                    );
                 }
                 
                 console.log('[Check] Mapeamento falhou, usando IA...');
                 const jsonContent = JSON.stringify(menuItems.slice(0, 60)); 
                 return await processWithAI(jsonContent, OPENAI_API_KEY, false, true);
            }
             
            return new Response(
                JSON.stringify({ success: false, status: 'failed', error: 'Não foi possível extrair produtos do dataset.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

        return new Response(
            JSON.stringify({ success: false, status: 'failed', error: `Apify terminou com status: ${status}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    throw new Error('Ação inválida ou tipo não suportado.');

  } catch (error: any) {
    console.error('[ScrapeMenu] Erro Fatal:', error);
    return new Response(
      JSON.stringify({ success: false, status: 'failed', error: error.message, details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
})

// === HELPERS (Mantidos) ===
function mapApifyItemsToCategories(items: any[]): any[] {
    const categoriesMap: Record<string, any[]> = {};

    const coerceImageUrl = (value: any): string | null => {
        const pickFromObject = (obj: any) => {
            if (!obj || typeof obj !== 'object') return null;
            const candidates = [obj.url, obj.href, obj.src, obj.imageUrl, obj.image_url, obj.thumbnail, obj.picture, obj.photo];
            for (const c of candidates) {
                if (typeof c === 'string' && c.trim()) return c.trim();
            }
            if (Array.isArray(obj.images)) {
              for (const im of obj.images) {
                const u = coerceImageUrl(im);
                if (u) return u;
              }
            }
            if (Array.isArray(obj.photos)) {
              for (const im of obj.photos) {
                const u = coerceImageUrl(im);
                if (u) return u;
              }
            }
            return null;
        };

        let url: string | null = null;
        if (typeof value === 'string') url = value.trim();
        else if (Array.isArray(value)) {
            for (const v of value) {
                const u = coerceImageUrl(v);
                if (u) { url = u; break; }
            }
        } else if (value && typeof value === 'object') {
            url = pickFromObject(value);
        }

        if (!url) return null;
        if (url === 'null' || url === 'undefined' || url === '[object Object]') return null;
        if (url.startsWith('//')) url = `https:${url}`;
        if (url.startsWith('http://')) url = `https://${url.slice('http://'.length)}`;
        if (url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
        if (url.includes('ifood-static.com.br') || url.includes('ifood-static.com')) return `https://${url}`;
        return null;
    };

    for (const item of items) {
        const name = item.name || item.title || item.productName || item.item_name;
        const price = parseFloat(item.price || item.unitPrice || item.value || item.basePrice || '0');
        const categoryName = item.category || item.menuSection || item.group || item.category_name || 'Geral';
        const description = item.description || item.details || item.shortDescription || item.desc || item.subtitle || item.content || item.ingredients || '';
        const imageUrl = coerceImageUrl(item.imageUrl) || coerceImageUrl(item.image) || coerceImageUrl(item.image_url) || coerceImageUrl(item.media) || coerceImageUrl(item.thumbnail) || null;
        if (!name) continue;
        const variants: any[] = [];
        const optionsSource = item.options || item.choices || item.modifiers || item.garnishes || item.addons || item.extras || [];
        if (Array.isArray(optionsSource)) {
            for (const opt of optionsSource) {
                if (opt.options && Array.isArray(opt.options)) {
                    for (const subOpt of opt.options) {
                        if (subOpt.name) variants.push({ name: subOpt.name, price: parseFloat(subOpt.price || subOpt.value || '0') });
                    }
                } else if (opt.name) {
                    variants.push({ name: opt.name, price: parseFloat(opt.price || opt.value || '0') });
                }
            }
        }
        if (!categoriesMap[categoryName]) categoriesMap[categoryName] = [];
        categoriesMap[categoryName].push({ name, price, description, image_url: imageUrl, variants });
    }
    return Object.entries(categoriesMap).map(([name, items]) => ({ name, items }));
}

async function processWithAI(content: string, apiKey: string | undefined, isImage = false, isJson = false) {
    if (!apiKey) throw new Error('Chave OpenAI não configurada.');
    const systemPrompt = `Você é um especialista em estruturar cardápios de restaurantes. Sempre responda em json.
Extraia produtos com nome, descrição, imagem (se houver) e preço base.
Extraia VARIANTES DE PREÇO (tamanhos com preços finais) e VARIAÇÕES/ADICIONAIS em grupos.
Regras:
- "price" deve ser o menor preço do item ou o preço base.
- "price_variants" lista tamanhos com preço final.
- "variations" são grupos com opções e acréscimos.
- Se não houver imagem confiável, use null.
Saída json:
{
  "categories": [
    {
      "name": "Categoria",
      "items": [
        {
          "name": "Produto",
          "description": "Descrição",
          "image_url": "https://..." | null,
          "price": 0.00,
          "price_variants": [ { "name": "P", "price": 10.00 } ],
          "variations": [
            {
              "name": "Adicionais",
              "required": false,
              "max_selections": 1,
              "options": [ { "name": "Bacon", "price": 5.00 } ]
            }
          ]
        }
      ]
    }
  ]
}`;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isImage ? [{ type: "text", text: "Extraia o cardápio e retorne um json." }, { type: "image_url", image_url: { url: content, detail: "high" } }] : `Extraia o cardápio a partir do HTML e retorne um json válido:\n\n${content.slice(0, 50000)}` }
    ];
    try {
      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: messages, temperature: 0.1, max_tokens: 4000, response_format: { type: "json_object" } })
      });
      if (!aiResp.ok) { const err = await aiResp.text(); throw new Error(`Erro IA: ${err}`); }
      const aiData = await aiResp.json();
      const parsed = JSON.parse(aiData.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim());
      return new Response(JSON.stringify({ success: true, status: 'completed', categories: parsed.categories || parsed.menu || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, status: 'failed', error: e?.message || String(e) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
}

function parseThirdPartyMenu(html: string): any[] {
  return [];
}

function validateAndSanitizeThirdParty(html: string, categories: any[]): any[] {
  try {
    const text = html.replace(/\s+/g, ' ').toLowerCase();
    const pricePattern = /(r\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2}))/i;
    const urlPattern = /(https?:\/\/[^\s"'<>]+)/i;
    const out: any[] = [];
    for (const cat of categories || []) {
      const name = String(cat?.name || '').trim();
      const items = Array.isArray(cat?.items) ? cat.items : [];
      const validItems: any[] = [];
      for (const it of items) {
        const nm = String(it?.name || '').trim();
        const desc = String(it?.description || '').trim();
        const price = Number(it?.price || 0);
        const pv = Array.isArray(it?.price_variants) ? it.price_variants : [];
        const img = it?.image_url || null;
        const hasName = nm && text.includes(nm.toLowerCase());
        const hasPrice = price > 0 || pv.some((v: any) => Number(v?.price || 0) > 0) || pricePattern.test(text);
        const imgOk = img && typeof img === 'string' && urlPattern.test(img);
        if (hasName && hasPrice) {
          const item: any = { name: nm, price: price };
          if (desc) item.description = desc;
          if (imgOk) item.image_url = img;
          if (pv.length > 0) item.price_variants = pv.map((v: any) => ({ name: String(v?.name || '').trim(), price: Number(v?.price || 0) })).filter((v: any) => v.name && v.price > 0);
          if (Array.isArray(it?.variations) && it.variations.length > 0) {
            item.variations = it.variations.map((g: any) => ({
              name: String(g?.name || '').trim(),
              required: !!g?.required,
              max_selections: Math.max(1, Number(g?.max_selections || 1)),
              options: Array.isArray(g?.options) ? g.options.map((o: any) => ({ name: String(o?.name || '').trim(), price: Math.max(0, Number(o?.price || 0)) })).filter((o: any) => o.name) : []
            })).filter((g: any) => g.name && g.options && g.options.length > 0);
          }
          validItems.push(item);
        }
      }
      if (name && validItems.length > 0) out.push({ name, items: validItems });
    }
    return out;
  } catch {
    return [];
  }
}

function consolidateVariantsAndCategories(categories: any[]): any[] {
  const sizeRegex = /\((\d{2,3}\s?(?:cm|ml))\)$/i;
  const tailSizeRegex = /\b(P|M|G|GG|Pequeno|Médio|Grande|Gigante)\b$/i;
  const keywords = [
    { name: 'Linha Premium', test: (n: string) => /premium/i.test(n) },
    { name: 'Linha Basic', test: (n: string) => /basic/i.test(n) },
    { name: 'Doces', test: (n: string) => /doce|chocolate|brigadeiro|sobremesa/i.test(n) },
    { name: 'Bebidas', test: (n: string) => /bebida|refrigerante|suco|água|coca|guaraná/i.test(n) }
  ];
  const normalizeName = (n: string) => n.replace(sizeRegex, '').replace(tailSizeRegex, '').trim();
  const extractSize = (n: string) => {
    const m1 = n.match(sizeRegex);
    if (m1) return m1[1].toUpperCase();
    const m2 = n.match(tailSizeRegex);
    if (m2) return m2[1].toUpperCase();
    return null;
  };
  let out: any[] = [];
  for (const cat of categories || []) {
    const groups: Record<string, any[]> = {};
    for (const it of (cat.items || [])) {
      const base = normalizeName(String(it?.name || ''));
      if (!base) continue;
      if (!groups[base]) groups[base] = [];
      groups[base].push(it);
    }
    const consolidatedItems: any[] = [];
    for (const [base, arr] of Object.entries(groups)) {
      if ((arr as any[]).length <= 1) {
        consolidatedItems.push(arr[0]);
      } else {
        const priceVariants = (arr as any[]).map((p: any) => ({
          name: extractSize(String(p?.name || '')) || String(p?.name || '').trim(),
          price: Number(p?.price || 0)
        })).filter(v => v.name && v.price > 0);
        const best = (arr as any[]).sort((a, b) => (String(b?.description || '').length) - (String(a?.description || '').length))[0];
        consolidatedItems.push({
          name: base,
          description: best?.description || '',
          image_url: best?.image_url || null,
          price: Math.min(...priceVariants.map(v => v.price)),
          price_variants: priceVariants
        });
      }
    }
    out.push({ name: cat.name || 'Geral', items: consolidatedItems });
  }
  // Se só há uma categoria e muitos itens, tentar dividir por keywords
  if (out.length === 1 && Array.isArray(out[0].items) && out[0].items.length > 10) {
    const buckets: Record<string, any[]> = {};
    for (const k of keywords) buckets[k.name] = [];
    buckets['Outros'] = [];
    for (const it of out[0].items) {
      const n = String(it?.name || '');
      const hit = keywords.find(k => k.test(n));
      if (hit) buckets[hit.name].push(it); else buckets['Outros'].push(it);
    }
    const rebuilt: any[] = [];
    for (const [name, items] of Object.entries(buckets)) {
      if (items.length > 0) rebuilt.push({ name, items });
    }
    if (rebuilt.length > 1) return rebuilt;
  }
  return out;
}

async function aiStructurize(raw: string, apiKey: string | undefined): Promise<any[]> {
  if (!apiKey) throw new Error('Chave OpenAI não configurada.');
  const systemPrompt = `Você é um parser de cardápios. Recebe texto bruto (ou JSON) e deve devolver JSON estruturado com categorias, itens, variações, complementos e imagens. Responda APENAS JSON.`;
  const userPrompt = `Aqui está o texto bruto extraído de um cardápio:\n\n${raw.slice(0, 120000)}\n\nGere um JSON no formato:\n{\n  "categorias": [\n    {\n      "nome": "Categoria",\n      "itens": [\n        {\n          "nome": "Produto",\n          "descricao": "Descrição",\n          "preco": 0.00,\n          "variacoes": [{"nome":"P","preco":10.00}],\n          "complementos":[{"nome":"Bacon","preco":5.00}],\n          "imagens":["https://..."]\n        }\n      ]\n    }\n  ]\n}\nRegras: mantenha nomes exatos dos itens, extraia preços reais, não invente categorias nem itens que não existam no texto.`;
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    })
  });
  if (!resp.ok) { const err = await resp.text(); throw new Error(`Erro IA: ${err}`); }
  const data = await resp.json();
  const parsed = JSON.parse(String(data?.choices?.[0]?.message?.content || '{}').trim());
  const categorias = Array.isArray(parsed?.categorias) ? parsed.categorias : [];
  const sizeRegex = /^(P|M|G|GG|Pequeno|Médio|Grande|Gigante|\d{2,3}\s?(?:cm|ml))$/i;
  const toInternal = categorias.map((c: any) => {
    const name = String(c?.nome || '').trim() || 'Geral';
    const items = Array.isArray(c?.itens) ? c.itens : [];
    const mappedItems = items.map((it: any) => {
      const nm = String(it?.nome || '').trim();
      const desc = String(it?.descricao || '').trim();
      const price = Number(it?.preco || 0);
      const imgs = Array.isArray(it?.imagens) ? it.imagens : [];
      const image_url = (imgs.find((u: any) => typeof u === 'string' && u.startsWith('http')) || null);
      const variacoes = Array.isArray(it?.variacoes) ? it.variacoes : [];
      const complementos = Array.isArray(it?.complementos) ? it.complementos : [];
      const price_variants = variacoes
        .map((vv: any) => ({ name: String(vv?.nome || '').trim(), price: Number(vv?.preco || 0) }))
        .filter((vv: any) => vv.name && vv.price > 0 && sizeRegex.test(vv.name));
      const other_variations = variacoes
        .map((vv: any) => ({ name: String(vv?.nome || '').trim(), price: Math.max(0, Number(vv?.preco || 0)) }))
        .filter((vv: any) => vv.name && !sizeRegex.test(vv.name));
      const variationsGroups: any[] = [];
      if (other_variations.length > 0) variationsGroups.push({ name: 'Variações', required: false, max_selections: 1, options: other_variations });
      if (complementos.length > 0) {
        const opts = complementos
          .map((v: any) => ({ name: String(v?.nome || '').trim(), price: Math.max(0, Number(v?.preco || 0)) }))
          .filter((o: any) => o.name);
        if (opts.length > 0) variationsGroups.push({ name: 'Complementos', required: false, max_selections: 1, options: opts });
      }
      const effectivePrice = price > 0 ? price : (price_variants.length > 0 ? Math.min(...price_variants.map((vv: any) => vv.price)) : 0);
      return { name: nm, description: desc, price: effectivePrice, image_url, price_variants, variations: variationsGroups };
    }).filter((p: any) => p.name && p.price > 0);
    return { name, items: mappedItems };
  }).filter((cat: any) => cat.items && cat.items.length > 0);
  return toInternal;
}
