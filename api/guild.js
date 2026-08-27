// Vercel Serverless Function — proxies guild lookups, hides the real API key.

export default async function handler(req, res) {
  const { id, region } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  const API_KEY = process.env.GGWHITEHAWK_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  const upstreamUrl = `https://public.ggwhitehawk.site/guild?id=${encodeURIComponent(id)}&region=${encodeURIComponent((region || 'bd').toLowerCase())}&key=${encodeURIComponent(API_KEY)}`;

  try {
    const upstreamRes = await fetch(upstreamUrl);
    const data = await upstreamRes.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
