import { postJSON } from "../web/fetcher.js";

export async function generateFlows(cfg, { csrfToken } = {}) {
  try {
    const data = await postJSON("/api/generate-flows", { cfg }, {
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
    });
    return data; // { checkAvailability, bookAppointment }
  } catch (err) {
    console.warn("[generate-flows] failed:", err.code, err.message);
    // Minimal user feedback:
    const msg = (err.code === "RATE_LIMIT")
      ? "Too many requests — try again in a minute."
      : (err.code === "CSRF")
        ? "Security check failed — refresh the page and try again."
        : `Couldn't generate flows: ${err.message}`;
    alert(msg);
    return null;
  }
}
