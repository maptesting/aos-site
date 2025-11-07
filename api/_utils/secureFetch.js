export async function secureFetch(url, { method = "POST", headers = {}, body, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upstream ${res.status}: ${text.slice(0, 200)}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return await res.json();
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
