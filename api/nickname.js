// Vercel Serverless Function — proxies nickname lookups, hides the real API key.

export default async function handler(req, res) {
  const { uid, region } = req.query;

  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }

  const API_KEY = process.env.GGWHITEHAWK_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  const upstreamUrl = `https://public.ggwhitehawk.site/nickname?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent((region || 'bd').toLowerCase())}&key=${encodeURIComponent(API_KEY)}`;

  try {
    const upstreamRes = await fetch(upstreamUrl);
    const data = await upstreamRes.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
