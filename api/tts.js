// /api/tts.js  — self-contained, no external imports
export default async function handler(req, res) {
  // --- CORS (same-site + local dev) ---
  const origin = req.headers.origin;
  const allow = ["https://aos-ai.com", "https://*.vercel.app", "http://localhost:3000"];
  if (origin && (allow.includes(origin) || origin?.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // --- Helpers to send consistent JSON ---
  const ok = (data, status = 200) => res.status(status).json({ ok: true, data });
  const fail = (message, code = "UNKNOWN", status = 400) =>
    res.status(status).json({ ok: false, code, message });

  if (req.method !== "POST") return fail("Method not allowed", "METHOD", 405);

  // --- Read & parse body robustly (works on Vercel) ---
  async function readBody() {
    // If Vercel already parsed JSON:
    if (req.body && typeof req.body === "object") return req.body;
    // Else, read raw stream:
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8") || "";
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Body must be valid JSON");
    }
  }

  try {
    const body = await readBody();
    const text = (body?.text ?? "").toString();
    if (!text) return fail("Text is required", "VALIDATION", 400);
    if (text.length > 1000) return fail("Text too long (max 1000 chars)", "VALIDATION", 400);

    const xiKey = process.env.ELEVENLABS_API_KEY;
    if (!xiKey) {
      return fail(
        "Server missing ELEVENLABS_API_KEY (set it in Vercel → Project → Settings → Environment Variables → Production, then redeploy).",
        "CONFIG",
        500
      );
    }

    const voiceId = (body?.voice_id || "UgBBYS2sOqTuMpoF3BR0").toString();
    const modelId = (body?.model_id || "eleven_multilingual_v2").toString();
    const voice_settings = body?.voice_settings;

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": xiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings
        })
      }
    );

    if (!upstream.ok) {
      // Try JSON first; fall back to text; always return JSON to client
      let detail = "";
      try {
        const j = await upstream.json();
        detail = (j?.detail ? JSON.stringify(j.detail) : JSON.stringify(j)).slice(0, 400);
      } catch {
        try { detail = (await upstream.text()).slice(0, 400); } catch {}
      }
      return fail(`TTS upstream error (${upstream.status}). ${detail || "No details"}`, "UPSTREAM", 502);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    return ok({ audioBase64: `data:audio/mpeg;base64,${buf.toString("base64")}` });
  } catch (e) {
    // If our code threw, still return JSON (prevents your UI from seeing HTML)
    return fail(e?.message || "Unexpected server error", "EXCEPTION", 500);
  }
}
