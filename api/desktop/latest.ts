const OWNER = 'josegenecis';
const REPO = 'PopSystem';

const disableRedirectCache = (res: any) => {
  res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('pragma', 'no-cache');
  res.setHeader('expires', '0');
};

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
      disableRedirectCache(res);
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
    disableRedirectCache(res);
    res.end();
  } catch {
    const fallback = `https://github.com/${OWNER}/${REPO}/releases/latest`;
    res.statusCode = 302;
    res.setHeader('location', fallback);
    disableRedirectCache(res);
    res.end();
  }
}
