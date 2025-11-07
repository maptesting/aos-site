export function ok(res, data = {}, status = 200) {
  res.status(status).json({ ok: true, data });
}

export function fail(res, message = "Unknown error", code = "UNKNOWN", status = 400) {
  res.status(status).json({ ok: false, code, message });
}
