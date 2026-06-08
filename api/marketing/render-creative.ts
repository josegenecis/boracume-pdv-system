import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

type ImageAsset = {
  bytes: Uint8Array;
  contentType: string;
};

async function readJson(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function bytesToText(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('utf8');
}

function isSupportedByResvg(contentType: string, bytes: Uint8Array) {
  const type = contentType.toLowerCase();
  if (type.includes('png') || type.includes('jpeg') || type.includes('jpg') || type.includes('gif')) return true;

  const header = Buffer.from(bytes.subarray(0, 12)).toString('hex');
  return (
    header.startsWith('89504e47') ||
    header.startsWith('ffd8ff') ||
    header.startsWith('474946383761') ||
    header.startsWith('474946383961')
  );
}

function isSvgImage(contentType: string, bytes: Uint8Array) {
  const type = contentType.toLowerCase();
  if (type.includes('svg')) return true;
  return bytesToText(bytes.subarray(0, 300)).trimStart().startsWith('<svg');
}

async function normalizeImageForResvg(asset: ImageAsset) {
  if (isSupportedByResvg(asset.contentType, asset.bytes)) return asset.bytes;

  if (isSvgImage(asset.contentType, asset.bytes)) {
    const png = new Resvg(bytesToText(asset.bytes), {
      fitTo: { mode: 'original' },
      background: 'transparent',
      font: {
        loadSystemFonts: false,
        defaultFontFamily: 'Arial',
      },
    }).render().asPng();

    return new Uint8Array(png);
  }

  const png = await sharp(Buffer.from(asset.bytes), { animated: false })
    .rotate()
    .png()
    .toBuffer();

  return new Uint8Array(png);
}

async function fetchImageAsset(url: string): Promise<ImageAsset | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) return null;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const secret = process.env.BORACUME_INTERNAL_KEY || process.env.RENDER_CREATIVE_SECRET || '';
  const provided = String(req.headers?.['x-boracume-key'] || req.headers?.['x-render-secret'] || '').trim();
  if (secret && provided !== secret) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const body = await readJson(req);
    const svg = String(body.svg || '').trim();
    const width = Math.max(320, Math.min(2400, Number(body.width || 1080)));
    const height = Math.max(320, Math.min(2400, Number(body.height || 1080)));

    if (!svg || !svg.includes('<svg')) {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'SVG inválido.' }));
      return;
    }

    const renderer = new Resvg(svg, {
      fitTo: { mode: 'original' },
      background: 'white',
      font: {
        loadSystemFonts: false,
        defaultFontFamily: 'Arial',
      },
    });

    for (const item of renderer.imagesToResolve() || []) {
      const href = String(typeof item === 'string' ? item : (item as any)?.href || '').trim();
      const asset = await fetchImageAsset(href).catch(() => null);
      if (asset) {
        const bytes = await normalizeImageForResvg(asset);
        renderer.resolveImage(href, Buffer.from(bytes));
      }
    }

    const png = renderer.render().asPng();
    res.statusCode = 200;
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-creative-width', String(width));
    res.setHeader('x-creative-height', String(height));
    res.end(Buffer.from(png));
  } catch (error: any) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: error?.message || 'Falha ao renderizar criativo.' }));
  }
}
