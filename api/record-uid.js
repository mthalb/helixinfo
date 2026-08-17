// api/record-uid.js
// Vercel Serverless Function -- runs only on the server. Clients only
// ever see a POST to this same-origin endpoint; storage + dedupe logic
// happens entirely here, using Upstash Redis (via Vercel Marketplace).

import { Redis } from "@upstash/redis";

// Vercel's Upstash integration injects env vars under one of two
// naming schemes depending on when/how it was connected. Support both
// so this doesn't break based on which one shows up in your project.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SET_KEY = "used_uids"; // Redis Set holding every UID ever looked up

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uid = String(req.body?.uid || "").trim();
  if (!uid) {
    return res.status(400).json({ error: "Missing uid" });
  }

  try {
    // sadd returns 1 if newly added, 0 if it was already in the set
    const added = await redis.sadd(SET_KEY, uid);
    return res.status(200).json({ isNew: added === 1 });
  } catch (err) {
    console.error("Redis error:", err);
    return res.status(500).json({ error: "Storage failed" });
  }
}
