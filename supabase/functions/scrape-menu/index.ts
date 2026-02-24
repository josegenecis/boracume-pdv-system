
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

            // Guardrails: links inválidos conhecidos (ex.: home do Anota AI)
            try {
              const host = parsedUrl.host.toLowerCase();
              const path = parsedUrl.pathname || '/';
              if (host === 'pedido.anota.ai' && (path === '/' || path === '')) {
                return new Response(
                  JSON.stringify({ success: false, status: 'failed', error: 'Link do Anota AI inválido. Use o link da loja/checkout (não a página inicial).' }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
              }
            } catch {}

             // 1. iFood Logic
             if (APIFY_TOKEN && rawUrl.includes('ifood.com.br')) {
                const ifoodIdMatch = rawUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
                const storeId = ifoodIdMatch ? ifoodIdMatch[1] : null;

                if (storeId) {
                    console.log(`[Start] Iniciando Apify iFood Async para loja: ${storeId}`);
                    
                    const runUrl = `https://api.apify.com/v2/acts/priscilas~ifood-menu-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=0`;
                    
                    const inputPayload = {
                        "store_ids": [storeId],
                        "latitude": "-23.550520",
                        "longitude": "-46.633308",
                        "useApifyProxy": true,
                        "proxyCountry": "BR"
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

            // 2. CardapioWeb / sites dinâmicos: Website Content Crawler tende a ser mais robusto
            if (parsedUrl.host.toLowerCase().includes('cardapioweb.com')) {
              console.log(`[Start] Iniciando Apify Website Content Crawler (cardapioweb)...`);
              const runUrl = `https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=${APIFY_TOKEN}&waitForFinish=0`;
              const inputPayload = {
                startUrls: [{ url: rawUrl }],
                crawlerType: 'playwright:adaptive',
                maxCrawlDepth: 2,
                maxCrawlPages: 40,
                dynamicContentWaitSecs: 8,
                maxScrollHeightPixels: 8000,
                removeCookieWarnings: true,
                blockMedia: true,
                saveMarkdown: true,
                saveHtml: false,
                saveFiles: false,
                proxyConfiguration: { useApifyProxy: true }
              };
              const startResp = await fetch(runUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputPayload)
              });
              if (!startResp.ok) {
                const errText = await startResp.text();
                console.error(`[Start] Erro Website Content Crawler (cardapioweb): ${startResp.status} - ${errText}`);
                throw new Error(`Erro ao iniciar Website Content Crawler: ${startResp.status}`);
              }
              const startData = await startResp.json();
              return new Response(
                JSON.stringify({ success: true, runId: startData?.data?.id, status: 'started' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
              );
            }

            console.log(`[Start] Iniciando Apify Web Scraper (universal)...`);
            const runUrl = `https://api.apify.com/v2/acts/apify~web-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=0`;
            const pageFunction = `
              async function pageFunction(context) {
                const { jQuery, request } = context;
                const $ = jQuery;
                function norm(t){ try{ return (t||'').replace(/\\s+/g,' ').trim(); }catch{ return ''; } }
                function priceOfText(txt){
                  const m = String(txt||'').match(/R\\$\\s?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})/);
                  if(!m) return 0;
                  try{ return Number(m[0].replace('R$','').replace(/\\./g,'').replace(',','.').trim()); }catch{ return 0; }
                }
                function priceOf(el){ return priceOfText($(el).text()); }
                function imgUrlsFrom(el){
                  const urls = [];
                  $(el).find('img').each((_, im) => {
                    const src = $(im).attr('src') || $(im).attr('data-src') || '';
                    const srcset = $(im).attr('srcset') || '';
                    const pick = (u) => {
                      const s = norm(u);
                      if(!s) return;
                      let out = s;
                      if(out.startsWith('//')) out = 'https:' + out;
                      if(out.startsWith('http')) urls.push(out);
                    };
                    pick(src);
                    if(srcset) srcset.split(',').map(p => p.trim().split(' ')[0]).forEach(pick);
                  });
                  return Array.from(new Set(urls));
                }
                function parseVariationText(blockText){
                  const lines = String(blockText||'').split('\\n').map(l => norm(l)).filter(Boolean);
                  const options = [];
                  for(const l of lines){
                    const pr = priceOfText(l);
                    const nm = norm(l.replace(/R\\$\\s?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})/, ''));
                    if(nm && (pr>0 || /\\+\\s*R\\$/.test(l))) options.push({ name: nm, price: Math.max(0, pr) });
                  }
                  if(options.length>0) return [{ name: 'Adicionais', required: false, max_selections: 1, options }];
                  return [];
                }
                function collectProducts(container){
                  const items = [];
                  const itemSel = 'article, .product, .item, .menu-item, .card, [class*=produto], [class*=product], [class*=item]';
                  $(container).find(itemSel).each((i, el) => {
                    const name = norm($(el).find('h1, h2, h3, .title, .name, [class*=nome], [class*=title]').first().text()) || norm($(el).attr('aria-label'));
                    const desc = norm($(el).find('.description, .desc, [class*=descri], [class*=subtitle]').first().text());
                    const price = priceOf(el);
                    const images = imgUrlsFrom(el);
                    const variations = parseVariationText($(el).text());
                    if(name && price>0){
                      items.push({ name, description: desc || '', price, image_url: images[0] || null, variations });
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
                const pageText = norm($('body').text()).slice(0, 20000);
                const pageImages = imgUrlsFrom('body').slice(0, 200);
                return { categories: out, pageText, pageImages, pageUrl: request.url };
              }
            `;
            const inputPayload = {
              startUrls: [{ url: rawUrl }],
              maxRequestsPerCrawl: 25,
              proxyConfiguration: { useApifyProxy: true },
              pageFunction,
              linkSelector: 'a[href*="produto"], a[href*="product"], a[href*="item"], a[href*="menu"], a[href*="cardapio"], .product a, .item a'
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
            return new Response(
              JSON.stringify({ success: true, runId: startData?.data?.id, status: 'started' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }
        
        if (type === 'text') {
             const text = String(data || '').trim();
             if (!text) {
               return new Response(
                 JSON.stringify({ success: false, status: 'failed', error: 'Texto vazio.' }),
                 { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
               );
             }
             const categories = consolidateVariantsAndCategories(await aiStructurize(text, OPENAI_API_KEY));
             if (!categories || categories.length === 0) {
               return new Response(
                 JSON.stringify({ success: false, status: 'failed', error: 'Não foi possível estruturar o cardápio a partir do texto.' }),
                 { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
               );
             }
             return new Response(
               JSON.stringify({ success: true, status: 'completed', categories }),
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
            
            const itemsResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&format=json`);
            const items = await itemsResp.json();

            if (!items || items.length === 0) {
                return new Response(
                    JSON.stringify({ success: false, status: 'failed', error: 'Dataset vazio. O scraper não encontrou itens.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
            }

            // Lógica de extração (suporta Web Scraper com pageFunctionResult + crawlers de conteúdo)
            const looksLikeContentCrawl = !!(
              items?.[0]?.text ||
              items?.[0]?.markdown ||
              items?.[0]?.pageContent ||
              items?.[0]?.content ||
              items?.[0]?.html ||
              items?.[0]?.bodyText ||
              items?.[0]?.pageFunctionResult?.pageText ||
              items?.[0]?.pageFunctionResult?.pageText ||
              items?.[0]?.pageText
            );

            let extractedCategories: any[] = [];
            let menuItems: any[] = [];
            if (Array.isArray(items) && items[0]?.pageFunctionResult?.categories) {
                for (const it of items) {
                    const cats = it?.pageFunctionResult?.categories;
                    if (Array.isArray(cats)) extractedCategories.push(...cats);
                }
            }
            if (extractedCategories.length === 0 && !looksLikeContentCrawl) {
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
            }

            // Caminho 1: categorias já estruturadas pelo pageFunction
            if (extractedCategories.length > 0) {
                 const consolidated = consolidateVariantsAndCategories(extractedCategories);
                 
                 // IA pós-processamento apenas quando necessário
                 let aiStructured: any[] = [];
                 try {
                   const totalItemsHeuristic = consolidated.reduce((acc: number, c: any) => acc + (Array.isArray(c.items) ? c.items.length : 0), 0);
                   if (consolidated.length === 1 || totalItemsHeuristic >= 30) {
                     const { text, imageUrls } = extractTextAndImagesFromApifyItems(items);
                     const rawForAi =
                       `CATEGORIAS EXTRAÍDAS (JSON):\n` +
                       `${JSON.stringify(extractedCategories).slice(0, 90000)}\n\n` +
                       `IMAGENS ENCONTRADAS (pode usar como image_url quando fizer sentido):\n` +
                       `${imageUrls.slice(0, 200).join('\n')}\n\n` +
                       `TEXTO EXTRAÍDO:\n${String(text || '').slice(0, 50000)}`;
                     aiStructured = await aiStructurize(rawForAi, OPENAI_API_KEY);
                   }
                 } catch (e) {
                   console.warn('[Check] IA estruturadora (categorias) falhou, usando consolidação heurística.', e);
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
                     
                     let rehostBudget = 40;
                     const catsForImages = (aiStructured.length > 0 ? aiStructured : consolidated);
                     for (const cat of catsForImages) {
                       if (!cat.items || rehostBudget <= 0) continue;
                       const itemsWithImages = (cat.items || []).filter((i: any) => i.image_url && i.image_url.startsWith('http'));
                       for (const item of itemsWithImages) {
                         if (rehostBudget <= 0) break;
                         const newUrl = await uploadImage(item.image_url);
                         if (newUrl) item.image_url = newUrl;
                         rehostBudget--;
                       }
                     }
                 }
                 
                 const finalCats = aiStructured.length > 0 ? aiStructured : consolidated;
                 if (finalCats.length > 0) {
                      return new Response(
                        JSON.stringify({ success: true, status: 'completed', categories: finalCats }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                    );
                 }
            }

            // Caminho 1.5: crawler de conteúdo (texto/markdown/html/pageFunctionResult.pageText) + IA estruturadora universal
            if (looksLikeContentCrawl) {
                 const { text, imageUrls } = extractTextAndImagesFromApifyItems(items);
                 if (text && OPENAI_API_KEY) {
                   let aiStructured: any[] = [];
                   try {
                     const rawForAi =
                       `IMAGENS ENCONTRADAS (pode usar como image_url quando fizer sentido):\n` +
                       `${imageUrls.slice(0, 200).join('\n')}\n\n` +
                       `TEXTO EXTRAÍDO:\n${text}`;
                     aiStructured = await aiStructurize(rawForAi, OPENAI_API_KEY);
                   } catch (e) {
                     console.warn('[Check] IA estruturadora (crawler conteúdo) falhou.', e);
                   }
                   if (aiStructured.length > 0) {
                      return new Response(
                        JSON.stringify({ success: true, status: 'completed', categories: aiStructured }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                      );
                   }
                 }
            }
            
            // Caminho 2: itens avulsos (fallback)
            if (menuItems.length > 0) {
                 const mappedCategories = mapApifyItemsToCategories(menuItems);
                 const consolidated = consolidateVariantsAndCategories(mappedCategories);
                 
                 // IA pós-processamento apenas quando necessário (evita custo e demora)
                 let aiStructured: any[] = [];
                 try {
                   const totalItemsHeuristic = consolidated.reduce((acc: number, c: any) => acc + (Array.isArray(c.items) ? c.items.length : 0), 0);
                   if (consolidated.length === 1 || totalItemsHeuristic >= 30) {
                     const rawText = JSON.stringify(menuItems).slice(0, 150000);
                     aiStructured = await aiStructurize(rawText, OPENAI_API_KEY);
                   }
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

                     // Re-hosting: apenas quando necessário e com orçamento para evitar lentidão
                     const shouldRehost = (u: string) => {
                       try {
                         const host = new URL(u).host;
                         return !/(cardapioweb|cdn|cloudfront|googleusercontent|static|img\.|images\.)/i.test(host);
                       } catch { return false; }
                     };
                     let rehostBudget = 40;
                     const catsForImages = (aiStructured.length > 0 ? aiStructured : (consolidated.length > 0 ? consolidated : mappedCategories));
                     for (const cat of catsForImages) {
                       if (!cat.items || rehostBudget <= 0) continue;
                       const itemsWithImages = (cat.items || []).filter((i: any) => i.image_url && shouldRehost(i.image_url));
                       for (const item of itemsWithImages) {
                         if (rehostBudget <= 0) break;
                         const newUrl = await uploadImage(item.image_url);
                         if (newUrl) item.image_url = newUrl;
                         rehostBudget--;
                       }
                     }
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
            
            // Fallback final (universal): tenta estruturar a partir do JSON bruto do dataset
            try {
              const { text, imageUrls } = extractTextAndImagesFromApifyItems(items);
              const rawForAi =
                `IMAGENS ENCONTRADAS (pode usar como image_url quando fizer sentido):\n` +
                `${imageUrls.slice(0, 200).join('\n')}\n\n` +
                `DADOS EXTRAÍDOS (texto/markdown/html/JSON):\n${text || JSON.stringify(items).slice(0, 120000)}`;
              const aiStructured = await aiStructurize(rawForAi, OPENAI_API_KEY);
              if (Array.isArray(aiStructured) && aiStructured.length > 0) {
                return new Response(
                  JSON.stringify({ success: true, status: 'completed', categories: aiStructured }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
              }
            } catch {}

            return new Response(
              JSON.stringify({
                success: false,
                status: 'failed',
                error: 'Não foi possível extrair produtos do dataset.',
                debug: {
                  runId: String(runId || ''),
                  datasetId: String(datasetId || ''),
                  itemsCount: Array.isArray(items) ? items.length : 0
                }
              }),
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

    const sizeRegex = /^(P|M|G|GG|Pequeno|Médio|Medio|Grande|Gigante|\d{2,3}\s?(?:cm|ml))$/i;
    const groupLooksLikeSize = (groupName: string, optionNames: string[]) => {
      const g = String(groupName || '').toLowerCase();
      if (/(tamanho|size|por[cç][aã]o|volume|ml|cm|litro|lata)/i.test(g)) return true;
      const names = (optionNames || []).map(n => String(n || '').trim()).filter(Boolean);
      if (names.length === 0) return false;
      const hits = names.filter(n => sizeRegex.test(n)).length;
      if (hits / names.length >= 0.6) return true;
      const shortHits = names.filter(n => n.length <= 3 && /^[a-z]{1,3}$/i.test(n)).length;
      if (shortHits / names.length >= 0.6) return true;
      return false;
    };

    const normalizeMoney = (v: any) => {
      const n = Number(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    const extractGroups = (optionsSource: any) => {
      const groups: any[] = [];
      if (Array.isArray(optionsSource)) {
        for (const g of optionsSource) {
          if (g && typeof g === 'object') groups.push(g);
          else if (typeof g === 'string') groups.push({ name: g, options: [] });
        }
      } else if (optionsSource && typeof optionsSource === 'object') {
        groups.push(optionsSource);
      }
      return groups;
    };

    const mapOptionGroup = (group: any) => {
      const name = String(group?.name || group?.title || group?.groupName || group?.label || '').trim() || 'Opções';
      const required = Boolean(group?.required) || Number(group?.min || group?.min_selections || group?.minSelections || 0) > 0;
      const maxSelRaw = group?.max_selections ?? group?.maxSelections ?? group?.max ?? group?.maxQuantity ?? group?.max_quantity;
      const maxSelections = Math.max(1, Number(maxSelRaw || 1));

      const optionsArr =
        (Array.isArray(group?.options) ? group.options : null) ||
        (Array.isArray(group?.items) ? group.items : null) ||
        (Array.isArray(group?.choices) ? group.choices : null) ||
        (Array.isArray(group?.values) ? group.values : null) ||
        [];

      const options = optionsArr
        .map((o: any) => {
          const n = String(o?.name || o?.title || o?.label || o?.description || '').trim();
          if (!n) return null;
          const p = normalizeMoney(o?.price ?? o?.value ?? o?.amount ?? 0);
          return { name: n, price: p };
        })
        .filter(Boolean);

      return { name, required, max_selections: maxSelections, options };
    };

    for (const item of items) {
        const name = item.name || item.title || item.productName || item.item_name;
        const rawPrice = item.price ?? item.unitPrice ?? item.value ?? item.basePrice ?? '0';
        const price = normalizeMoney(rawPrice);
        const categoryName = item.category || item.menuSection || item.group || item.category_name || 'Geral';
        const description = item.description || item.details || item.shortDescription || item.desc || item.subtitle || item.content || item.ingredients || '';
        const imageUrl = coerceImageUrl(item.imageUrl) || coerceImageUrl(item.image) || coerceImageUrl(item.image_url) || coerceImageUrl(item.media) || coerceImageUrl(item.thumbnail) || null;
        if (!name) continue;
        const optionsSource = item.options || item.choices || item.modifiers || item.garnishes || item.addons || item.extras || item.variations || [];
        const groups = extractGroups(optionsSource);
        const mappedGroups = groups
          .map(mapOptionGroup)
          .filter((g: any) => g && g.options && g.options.length > 0);

        const price_variants: any[] = [];
        const variations: any[] = [];
        for (const g of mappedGroups) {
          const optionNames = (g.options || []).map((o: any) => String(o?.name || '').trim());
          if (groupLooksLikeSize(g.name, optionNames)) {
            for (const o of g.options || []) {
              if (o?.name && Number(o?.price || 0) > 0) price_variants.push({ name: o.name, price: Number(o.price || 0) });
            }
          } else {
            variations.push(g);
          }
        }

        const flatVariants: any[] = mappedGroups
          .flatMap((g: any) => (g.options || []).map((o: any) => ({ name: o.name, price: Number(o.price || 0) })))
          .filter((o: any) => o?.name && Number(o?.price || 0) > 0);

        const effectiveBasePrice = price > 0 ? price : (price_variants.length > 0 ? Math.min(...price_variants.map(v => Number(v.price || 0))) : 0);
        if (!categoriesMap[categoryName]) categoriesMap[categoryName] = [];
        categoriesMap[categoryName].push({
          name,
          price: effectiveBasePrice,
          description,
          image_url: imageUrl,
          variants: flatVariants,
          price_variants: price_variants.length > 0 ? price_variants : undefined,
          variations: variations.length > 0 ? variations : undefined
        });
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
  const systemPrompt = `Você é um parser de cardápios. Você recebe texto bruto (ou JSON) extraído de sites/cardápios e deve devolver um JSON estruturado. Responda APENAS JSON, sem explicações.`;
  const userPrompt = `ENTRADA (texto bruto / json / html / markdown):\n\n${raw.slice(0, 60000)}\n\nOBJETIVO: gerar JSON com categorias, itens e seus detalhes.\n\nFORMATO OBRIGATÓRIO:\n{\n  "categorias": [\n    {\n      "nome": "Categoria",\n      "itens": [\n        {\n          "nome": "Produto",\n          "descricao": "Descrição",\n          "preco": 0.00,\n          "variacoes": [\n            {\"nome\":\"P\",\"preco\":10.00},\n            {\"nome\":\"25cm\",\"preco\":15.99}\n          ],\n          \"complementos\": [\n            {\"nome\":\"Bacon\",\"preco\":5.00}\n          ],\n          \"imagens\": [\"https://...\"]\n        }\n      ]\n    }\n  ]\n}\n\nREGRAS IMPORTANTES:\n- NÃO INVENTE produtos/categorias: só use o que existir na entrada.\n- PREÇOS: sempre número (0.00). Converta vírgula para ponto.\n- Se um item tiver tamanhos com preços diferentes (P/M/G, 25cm/35cm, 300ml/500ml etc), coloque em \"variacoes\" com nome do tamanho e preço final.\n- Se houver adicionais/complementos com preço (ex.: \"+R$ 2,00\", \"Adicionar bacon 5\"), coloque em \"complementos\".\n- IMAGENS: só use URLs presentes na entrada. Se não der para associar uma imagem a um produto específico, deixe \"imagens\": [] para esse produto.\n- DESCRIÇÃO: se não existir, use string vazia.\n\nResponda somente com o JSON.`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    })
  });
  clearTimeout(timeoutId);
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

function extractTextAndImagesFromApifyItems(items: any[]): { text: string; imageUrls: string[] } {
  const parts: string[] = [];
  const images = new Set<string>();
  const pushImages = (value: any) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value) && /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value)) images.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) pushImages(v);
      return;
    }
    if (typeof value === 'object') {
      for (const k of ['url', 'src', 'href', 'image', 'imageUrl', 'image_url', 'thumbnail', 'photo', 'picture']) {
        const v = (value as any)[k];
        if (typeof v === 'string') pushImages(v);
      }
      for (const k of ['images', 'imageUrls', 'image_urls', 'photos', 'thumbnails']) {
        const v = (value as any)[k];
        if (Array.isArray(v)) pushImages(v);
      }
    }
  };

  for (const it of items || []) {
    const url = String((it as any)?.url || (it as any)?.pageUrl || (it as any)?.page_url || '').trim();
    const title = String((it as any)?.title || (it as any)?.pageTitle || '').trim();
    const textCandidate =
      (it as any)?.text ||
      (it as any)?.markdown ||
      (it as any)?.content ||
      (it as any)?.pageContent ||
      (it as any)?.bodyText ||
      (it as any)?.pageText ||
      (it as any)?.pageFunctionResult?.pageText ||
      '';
    const chunk = typeof textCandidate === 'string' ? textCandidate : JSON.stringify(textCandidate || it).slice(0, 6000);
    pushImages(it);
    pushImages((it as any)?.pageFunctionResult?.pageImages);
    if (chunk && chunk.trim()) {
      parts.push(`${url ? `URL: ${url}\n` : ''}${title ? `TÍTULO: ${title}\n` : ''}${chunk}`);
      const matches = chunk.match(/https?:\/\/[^\s"'<>]+/g) || [];
      for (const m of matches) pushImages(m);
    }
  }

  const text = parts.join('\n\n---\n\n').slice(0, 160000);
  return { text, imageUrls: Array.from(images).slice(0, 400) };
}
