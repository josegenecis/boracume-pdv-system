const OWNER = 'josegenecis';
const REPO = 'boracume-pdv-system';

export default async function handler(req: any, res: any) {
  try {
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
    const gh = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'boracume-web',
      },
    });

    const fallback = `https://github.com/${OWNER}/${REPO}/releases/latest`;
    if (!gh.ok) {
      res.statusCode = 302;
      res.setHeader('location', fallback);
      res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=3600');
      res.end();
      return;
    }

    const json: any = await gh.json();
    const assets: any[] = Array.isArray(json?.assets) ? json.assets : [];
    const setup = assets.find((a: any) => {
      const name = String(a?.name || '').toLowerCase();
      return name.endsWith('.exe') && name.includes('setup');
    });

    const url = String(setup?.browser_download_url || '') || fallback;
    res.statusCode = 302;
    res.setHeader('location', url);
    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.end();
  } catch {
    const fallback = `https://github.com/${OWNER}/${REPO}/releases/latest`;
    res.statusCode = 302;
    res.setHeader('location', fallback);
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.end();
  }
}

