// Vercel Serverless Function — proxies player info lookups so the
// real API key never reaches the browser.
// Runs server-side only; visitors cannot view this file's source.

export default async function handler(req, res) {
  const { uid, region } = req.query;

  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }

  const API_KEY = process.env.GGWHITEHAWK_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  const upstreamUrl = `https://public.ggwhitehawk.site/info?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent((region || 'bd').toLowerCase())}&key=${encodeURIComponent(API_KEY)}`;

  try {
    const upstreamRes = await fetch(upstreamUrl);
    const data = await upstreamRes.json();
    // Cache for 30s at the edge to reduce duplicate lookups hitting your quota.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
