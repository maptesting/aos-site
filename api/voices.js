// /api/voices.js — static curated voices for your app
// No API key needed, safe to expose names/ids you want users to pick from.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, code: "METHOD", message: "Method not allowed" });
  }

  // Curated list (you can add more later)
  const voices = [
    { id: "56bWURjYFHyYyVf490Dp", name: "Emma" },
    { id: "UgBBYS2sOqTuMpoF3BR0", name: "Mark" }
  ];

  // Optionally include a "Default" (server decides)
  const includeDefault = true;
  const payload = includeDefault
    ? [{ id: "", name: "Default" }, ...voices]
    : voices;

  return res.status(200).json({ ok: true, data: { voices: payload } });
}
