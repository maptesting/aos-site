import crypto from "crypto";

const COOKIE_NAME = "csrf_tok";

export function issueCsrf(res) {
  const token = crypto.randomBytes(16).toString("hex");
  // HttpOnly cookie so JS can't read it; SameSite=Lax blocks most CSRF
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure`
  );
  return token;
}

export function verifyCsrf(req) {
  const raw = req.headers.cookie || "";
  const fromCookie = raw
    .split(";")
    .map(x => x.trim())
    .find(x => x.startsWith(COOKIE_NAME + "="))
    ?.split("=")[1];

  const fromHeader = req.headers["x-csrf-token"];
  return Boolean(fromCookie && fromHeader && fromCookie === fromHeader);
}
