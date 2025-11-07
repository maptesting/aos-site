// /api/tts.js — ElevenLabs proxy with 429 retry & robust errors
export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allow = ["https://aos-ai.com", "https://aos-ai.vercel.app", "http://localhost:3000"];
  if (origin && (allow.includes(origin) || origin.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const ok = (data, status=200)=> res.status(status).json({ ok:true, data });
  const fail = (message, code="UNKNOWN", status=400)=> res.status(status).json({ ok:false, code, message });

  if (req.method !== "POST") return fail("Method not allowed", "METHOD", 405);

  async function readBody(){
    if (req.body && typeof req.body === "object") return req.body;
    const chunks=[]; for await (const c of req) chunks.push(c);
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"); }
    catch { throw new Error("Body must be valid JSON"); }
  }

  // small helper
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  try {
    const body = await readBody();
    const text = (body?.text ?? "").toString().trim();
    if (!text) return fail("Text is required", "VALIDATION", 400);
    if (text.length > 1000) return fail("Text too long (max 1000 chars)", "VALIDATION", 400);

    const xiKey = process.env.ELEVENLABS_API_KEY;
    if (!xiKey) return fail("Server missing ELEVENLABS_API_KEY (set in Vercel → Env Vars → Production, then redeploy).", "CONFIG", 500);

    const voiceId = (body?.voice_id || "UgBBYS2sOqTuMpoF3BR0").toString();
    const modelId = (body?.model_id || "eleven_multilingual_v2").toString();
    const voice_settings = body?.voice_settings;

    // retry up to 3x on 429 (too_many_concurrent_requests)
    let attempt = 0, lastDetail = "";
    while (attempt < 3) {
      attempt++;
      const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: { "xi-api-key": xiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: modelId, voice_settings })
      });

      if (upstream.ok) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        return ok({ audioBase64: `data:audio/mpeg;base64,${buf.toString("base64")}` });
      }

      // read error detail once per attempt
      try {
        const j = await upstream.clone().json();
        lastDetail = (j?.detail ? JSON.stringify(j.detail) : JSON.stringify(j)).slice(0, 400);
      } catch {
        try { lastDetail = (await upstream.text()).slice(0, 400); } catch {}
      }

      // 429 → backoff and retry
      if (upstream.status === 429) {
        const backoff = 300 * attempt + Math.floor(Math.random() * 200); // 300ms, ~500ms, ~700ms
        await sleep(backoff);
        continue;
      }

      // other status → fail immediately
      return fail(`TTS upstream error (${upstream.status}). ${lastDetail || "No details"}`, "UPSTREAM", upstream.status === 502 ? 502 : 502);
    }

    // exhausted retries
    return fail(`TTS upstream error (429). ${lastDetail || "Too many concurrent requests — please try again."}`, "UPSTREAM", 502);
  } catch (e) {
    return fail(e?.message || "Unexpected server error", "EXCEPTION", 500);
  }
}
