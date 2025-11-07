export async function postJSON(url, payload, opts = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: JSON.stringify(payload)
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok || !data?.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    const code = data?.code || "REQUEST_FAILED";
    const err = new Error(msg);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return data.data;
}

export async function getJSON(url, opts = {}) {
  const res = await fetch(url, {
    method: "GET",
    headers: { ...(opts.headers || {}) }
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok || !data?.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    const code = data?.code || "REQUEST_FAILED";
    const err = new Error(msg);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return data.data;
}
