import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ProductLookupResult = {
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  image_url?: string;
  barcode: string;
  source: string;
};

const normalizeBarcode = (value: unknown) => String(value || '').replace(/\D/g, '').trim();

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
};

async function lookupOpenFoodFacts(barcode: string): Promise<ProductLookupResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,status,product_name,product_name_pt,product_name_en,brands,categories,categories_tags,image_front_url,image_url,quantity,generic_name,generic_name_pt`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PopSystem/1.0 (contato@popsystem.com.br)',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) return null;

  const payload = await response.json();
  if (Number(payload?.status || 0) !== 1 || !payload?.product) return null;

  const product = payload.product;
  const name = firstText(product.product_name_pt, product.product_name, product.product_name_en);
  if (!name) return null;

  const brand = firstText(product.brands);
  const quantity = firstText(product.quantity);
  const descriptionParts = [
    firstText(product.generic_name_pt, product.generic_name),
    brand ? `Marca: ${brand}` : '',
    quantity ? `Embalagem: ${quantity}` : '',
  ].filter(Boolean);

  const rawCategory = firstText(product.categories)
    || (Array.isArray(product.categories_tags) ? firstText(product.categories_tags[0]) : '');

  return {
    name,
    description: descriptionParts.join('\n'),
    brand: brand || undefined,
    category: rawCategory ? rawCategory.replace(/^.*:/, '').replace(/-/g, ' ') : undefined,
    image_url: firstText(product.image_front_url, product.image_url) || undefined,
    barcode,
    source: 'openfoodfacts',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const barcode = normalizeBarcode(body?.barcode);

    if (!barcode || barcode.length < 8 || barcode.length > 14) {
      return new Response(JSON.stringify({ error: 'Código de barras inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const product = await lookupOpenFoodFacts(barcode);

    if (!product) {
      return new Response(JSON.stringify({ found: false, barcode }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ found: true, product }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('product-barcode-lookup error', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro ao consultar código de barras.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
