import { postJSON } from "../web/fetcher.js";

export async function generateFlows(cfg, { csrfToken } = {}) {
  try {
    const data = await postJSON("/api/generate-flows", { cfg }, {
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
    });
    return data; // { checkAvailability, bookAppointment }
  } catch (err) {
    console.warn("[generateFlows] failed:", err.code, err.message);
    alert(`Couldn't generate flows: ${err.message}`);
    return null;
  }
}
