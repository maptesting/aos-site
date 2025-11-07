import { issueCsrf } from "./_utils/csrf";
import { withCORS } from "./_utils/cors";

export default async function handler(req, res) {
  if (withCORS(res, req)) return; // OPTIONS
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, code: "METHOD", message: "Method not allowed" });
  }
  const token = issueCsrf(res);
  res.status(200).json({ ok: true, data: { token } });
}
