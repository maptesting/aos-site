const ALLOW_ORIGINS = [
  "https://yourdomain.com",
  "https://your-vercel-deployment.vercel.app",
  "http://localhost:3000"
];

export function withCORS(res, req) {
  const origin = req.headers.origin;
  if (origin && ALLOW_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
