import { withCORS } from "./_utils/cors";
import { rateLimit } from "./_utils/rateLimit";
import { ok, fail } from "./_utils/respond";
import { TTSRequestSchema } from "./_utils/validation";
// import { verifyCsrf } from "./_utils/csrf";

export default async function handler(req, res) {
  if (withCORS(res, req)) return; // OPTIONS

  if (req.method !== "POST") return fail(res, "Method not allowed", "METHOD", 405);

  // If you want CSRF for POSTs, uncomment next line and add header on client:
  // if (!verifyCsrf(req)) return fail(res, "CSRF check failed", "CSRF", 403);

  const { allowed } = await rateLimit(req);
  if (!allowed) return fail(res, "Too many requests", "RATE_LIMIT", 429);

  try {
    const parsed = TTSRequestSchema.parse(req.body || {});
    const xiKey = process.env.ELEVENLABS_API_KEY;
    if (!xiKey) return fail(res, "Server missing ELEVENLABS_API_KEY", "CONFIG", 500);

    const voiceId = parsed.voice_id || "UgBBYS2sOqTuMpoF3BR0";
    const modelId = parsed.model_id || "eleven_multilingual_v2";

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": xiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: parsed.text,
          model_id: modelId,
          voice_settings: parsed.voice_settings
        })
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      return fail(res, `TTS upstream error: ${errText.slice(0, 200)}`, "UPSTREAM", 502);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const b64 = buf.toString("base64");
    return ok(res, { audioBase64: `data:audio/mpeg;base64,${b64}` });
  } catch (e) {
    return fail(res, e.message || "Unexpected", "EXCEPTION", 500);
  }
}
