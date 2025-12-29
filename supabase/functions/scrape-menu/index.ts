
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      throw new Error('URL is required')
    }

    console.log(`Scraping URL: ${url}`);

    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }

    // Fetch the HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Simple Regex-based scraper to find products and prices
    // Looks for patterns like "Name ... R$ 20,00" or structures common in menus
    const products = [];
    
    // Pattern 1: Text followed by price (R$ XX,XX)
    // Matches: "X-Burger R$ 25,00" or "Coca Cola ... 5,00"
    // Limited to lines/blocks of reasonable length to avoid capturing huge text blocks
    const priceRegex = /([^\d\n<]{3,50})[\s\.\-_:]+(?:R\$\s*)?(\d+[,.]\d{2})/gi;
    
    let match;
    const seenNames = new Set();

    // Remove scripts and styles to reduce noise
    const cleanHtml = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
                          .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");

    // Extract text content roughly (very basic HTML to text)
    const textContent = cleanHtml.replace(/<[^>]+>/g, '\n').split('\n');

    for (const line of textContent) {
      const cleanLine = line.trim();
      if (cleanLine.length < 5) continue;

      // Reset regex index for each line
      priceRegex.lastIndex = 0;
      
      while ((match = priceRegex.exec(cleanLine)) !== null) {
        const name = match[1].trim().replace(/^[-–—\s]+|[-–—\s]+$/g, ''); // Clean leading/trailing dashes
        const priceStr = match[2].replace(',', '.');
        const price = parseFloat(priceStr);

        if (name && price > 0 && name.length > 2 && !seenNames.has(name)) {
          // Filter out common false positives
          if (/total|subtotal|entrega|taxa|troco|cartão|dinheiro|pagamento/i.test(name)) continue;

          products.push({
            name: name,
            price: price,
            description: '' // Hard to extract description reliably with regex
          });
          seenNames.add(name);
        }
      }
    }

    // Limit results
    const limitedProducts = products.slice(0, 50);

    return new Response(
      JSON.stringify({ 
        success: true, 
        products: limitedProducts,
        count: limitedProducts.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
