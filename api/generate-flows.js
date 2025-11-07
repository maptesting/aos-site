import { withCORS } from "./_utils/cors";
import { ok, fail } from "./_utils/respond";
import { rateLimit } from "./_utils/rateLimit";
import { GenerateFlowsSchema } from "./_utils/validation";
import fs from "fs";
import path from "path";

function readJSON(relPath) {
  const p = path.join(process.cwd(), "templates", relPath);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function injectPlaceholders(obj, cfg) {
  const s = JSON.stringify(obj)
    .replaceAll("{{bizName}}", cfg.bizName)
    .replaceAll("{{receptionistName}}", cfg.receptionistName)
    .replaceAll("{{timezone}}", cfg.timezone)
    .replaceAll("{{calendarId}}", cfg.calendarId)
    .replaceAll("{{email}}", cfg.email);
  return JSON.parse(s);
}

export default async function handler(req, res) {
  if (withCORS(res, req)) return;

  if (req.method !== "POST") return fail(res, "Method not allowed", "METHOD", 405);

  const { allowed } = await rateLimit(req);
  if (!allowed) return fail(res, "Too many requests", "RATE_LIMIT", 429);

  try {
    const { cfg } = GenerateFlowsSchema.parse(req.body || {});
    // NOTE: We do NOT change your n8n templates—keep them intact in /templates
    const checkAvailability = readJSON("checkAvailability.json");
    const bookAppointment = readJSON("bookAppointment.json");

    const injected = {
      checkAvailability: injectPlaceholders(checkAvailability, cfg),
      bookAppointment: injectPlaceholders(bookAppointment, cfg)
    };

    return ok(res, injected);
  } catch (e) {
    return fail(res, e.message || "Invalid payload", "VALIDATION", 400);
  }
}
