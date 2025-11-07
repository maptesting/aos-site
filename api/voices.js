// /api/voices.js — curated voices (safe to expose)
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok:false, code:"METHOD", message:"Method not allowed" });
  }
  const voices = [
    { id: "", name: "Default" },
    { id: "56bWURjYFHyYyVf490Dp", name: "Emma" },
    { id: "UgBBYS2sOqTuMpoF3BR0", name: "Mark" },
  ];
  res.status(200).json({ ok:true, data:{ voices } });
}
