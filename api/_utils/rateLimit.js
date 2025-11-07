// Simple in-memory limiter (per function execution). Good enough for starters.
// You can swap to Upstash when ready.
const WINDOW_SEC = 60;
const LIMIT = 60;

let mem = new Map();

export async function rateLimit(req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / WINDOW_SEC);
  const key = `${ip}:${bucket}`;

  const count = (mem.get(key) || 0) + 1;
  mem.set(key, count);

  if (count > LIMIT) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: LIMIT - count };
}
