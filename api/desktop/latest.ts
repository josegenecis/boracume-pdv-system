const OWNER = 'josegenecis';
const REPO = 'PopSystem';

const disableRedirectCache = (res: any) => {
  res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('pragma', 'no-cache');
  res.setHeader('expires', '0');
};

export default async function handler(req: any, res: any) {
  try {
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=100`;
    const gh = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'boracume-web',
      },
    });

    const fallback = `https://github.com/${OWNER}/${REPO}/releases`;
    if (!gh.ok) {
      res.statusCode = 302;
      res.setHeader('location', fallback);
      disableRedirectCache(res);
      res.end();
      return;
    }

    const releases: any[] = await gh.json();
    const desktopRelease = Array.isArray(releases)
      ? releases.find((release: any) => {
          const tag = String(release?.tag_name || '');
          return !release?.draft && !release?.prerelease && /^v\d/.test(tag);
        })
      : null;
    const assets: any[] = Array.isArray(desktopRelease?.assets) ? desktopRelease.assets : [];
    const setup = assets.find((a: any) => {
      const name = String(a?.name || '').toLowerCase();
      return name.endsWith('.exe') && name.includes('setup') && name.includes('popsystem');
    });

    const url = String(setup?.browser_download_url || '') || fallback;
    res.statusCode = 302;
    res.setHeader('location', url);
    disableRedirectCache(res);
    res.end();
  } catch {
    const fallback = `https://github.com/${OWNER}/${REPO}/releases`;
    res.statusCode = 302;
    res.setHeader('location', fallback);
    disableRedirectCache(res);
    res.end();
  }
}
