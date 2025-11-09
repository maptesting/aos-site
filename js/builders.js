// /js/builders.js
// FINAL: zero-touch by default, with optional safe placeholder injection,
// plus rich prompt builder. No eval; string replacement only.

(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = { ready: false, tpl: { avail: null, book: null } };

  const log  = (...a) => console.log('[AOS-builders]', ...a);
  const err  = (...a) => console.error('[AOS-builders]', ...a);
  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));

  const safeNow = (tz) => {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: tz || 'America/New_York',
        weekday: 'long', year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return new Date().toLocaleString(); }
  };

  async function loadJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }

  // ---------- config helpers ----------
  function normalizeConfig(v = {}) {
    return {
      version: v.version ?? 1,
      bizName: (v.bizName || v.business || 'the business').trim(),
      agentName: (v.agentName || v.receptionistName || 'Alex').trim(),
      industry: (v.industry || 'services').trim(),
      services: (v.services || 'General services').trim(), // comma-separated OK
      hours: (v.hours || 'Mon–Fri 9:00–17:00').trim(),
      location: (v.location || 'Local area').trim(),
      policies: (v.policies || 'Standard policies apply.').trim(),
      timezone: (v.timezone || 'America/New_York').trim(),
      calendarId: (v.calendarId || '').trim(),
      email: (v.email || v.emailFrom || 'no-reply@example.com').trim(),
    };
  }

  // Safe placeholder injection across any JSON graph
  function injectPlaceholders(graph, v) {
    const cfg = normalizeConfig(v);
    const mapping = {
      '{{bizName}}': cfg.bizName,
      '{{receptionistName}}': cfg.agentName,
      '{{agentName}}': cfg.agentName,
      '{{industry}}': cfg.industry,
      '{{services}}': cfg.services,
      '{{hours}}': cfg.hours,
      '{{location}}': cfg.location,
      '{{policies}}': cfg.policies,
      '{{timezone}}': cfg.timezone,
      '{{calendarId}}': cfg.calendarId,
      '{{email}}': cfg.email
    };

    let s = JSON.stringify(graph);
    for (const [key, val] of Object.entries(mapping)) {
      // replace all occurrences of each placeholder
      s = s.split(key).join(val);
    }
    return JSON.parse(s);
  }

  // ---------- Long, sectioned prompt (for .txt only; DOES NOT touch graphs) ----------
  function buildLongPrompt(v = {}) {
    const cfg = normalizeConfig(v);
    const L = (val, label) => `${label}: ${val || 'N/A'}`;
    return [
`# ROLE
You are ${cfg.agentName}, a friendly, efficient AI receptionist for **${cfg.bizName}** (${cfg.industry}). Keep replies to 1–2 sentences, natural and clear.

# CURRENT TIME
- Current time: **${safeNow(cfg.timezone)}**
- Timezone: **${cfg.timezone}**
Use ISO 8601 timestamps when interacting with tools.

# BUSINESS CONTEXT
${L(cfg.bizName,'Business')}
${L(cfg.location,'Location / Service')}
${L(cfg.industry,'Industry')}
${L(cfg.services,'Services')}
${L(cfg.hours,'Hours')}
${L(cfg.policies,'Policies')}

# TASK
Answer questions and help book appointments quickly.

# BOOKING FLOW
1) Ask for the preferred date/time (within ${cfg.hours}).
2) Run the availability check for the requested slot.
3) If unavailable, propose up to 3 close alternatives (same day or next business day).
4) Collect full name, email, phone.
5) Confirm slot and create the booking.
6) Summarize details and say a confirmation will be sent from **${cfg.email}**.

# TRANSFER
If human help is requested, politely hand off.

# STYLE & RULES
- Warm, concise, confident; use contractions.
- Don’t invent availability outside ${cfg.hours}.
- Ask a single clarifying question when needed; then act.
- Confirm final date/time + contact details before booking.
- Don’t mention internal tools to the user.

# EXAMPLE
User: “Can I come tomorrow at 3 for ${cfg.services.split(',')[0].trim()}?”
You: “Happy to help — is **tomorrow 3:00 PM** best? What’s your **name and email**?”
(then check slot and book)
You: “All set — booked **tomorrow 3:00–4:00 PM**. You’ll get a confirmation shortly.”`
    ].join('\n');
  }

  // ---------- Public API ----------
  let readyResolve;
  const readyPromise = new Promise((res) => (readyResolve = res));

  AOS.init = async function init() {
    if (state.ready) return;
    // Load exactly what you uploaded into /public/templates/
    const [avail, book] = await Promise.all([
      loadJSON('/templates/checkAvailability.json'),
      loadJSON('/templates/bookAppointment.json'),
    ]);
    state.tpl.avail = avail; // masters kept pristine
    state.tpl.book  = book;
    state.ready = true;
    readyResolve(true);
    log('✅ Templates loaded (zero-touch ready; injection optional)');
  };

  AOS.ready = () => readyPromise;

  // Prompt .txt (rich) — uses form values
  AOS.buildPrompt = (v) => buildLongPrompt(v || {});

  /**
   * Build Check Availability graph
   * @param {object} v - form values (bizName, services, hours, timezone, etc.)
   * @param {object} opts - { inject: boolean } default true
   */
  AOS.buildCheckAvailability = async (v = {}, opts = { inject: true }) => {
    if (!state.ready) await AOS.ready();
    const base = deepClone(state.tpl.avail);
    return opts.inject ? injectPlaceholders(base, v) : base;
  };

  /**
   * Build Book Appointment graph
   * @param {object} v - form values (bizName, services, hours, timezone, calendarId, email, etc.)
   * @param {object} opts - { inject: boolean } default true
   */
  AOS.buildBookAppointment = async (v = {}, opts = { inject: true }) => {
    if (!state.ready) await AOS.ready();
    const base = deepClone(state.tpl.book);
    return opts.inject ? injectPlaceholders(base, v) : base;
  };

  // Optional: quick stats so UI can assert connections exist
  AOS.debugBuild = async (kind) => {
    if (!state.ready) await AOS.ready();
    const g = deepClone(kind === 'avail' ? state.tpl.avail : state.tpl.book);
    const nodes = Array.isArray(g.nodes) ? g.nodes : [];
    const conn  = g.connections || g.connectionsById || {};
    return { nodes: nodes.length, connections: Object.keys(conn).length };
  };

  // Utility for UI
  AOS.truncate = (s, n = 1200) => (s && s.length > n ? s.slice(0, n) + ' …' : (s || ''));

  // start loading immediately
  AOS.init().catch((e) => err('Template preload failed:', e));
})();

// === [ADD] Utility: simple placeholder injection ===
function injectPlaceholders(str, map) {
  return Object.entries(map).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v ?? "")),
    String(str)
  );
}

// === [ADD] Async downloader (uses your existing async-aware setDL if present) ===
async function setDL(el, filename, data, mime = "application/octet-stream") {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  el.setAttribute("href", url);
  el.setAttribute("download", filename);
}

// === [ADD] Agent registry ===
const AGENT_DEFS = {
  invoice: {
    title: "AI Invoice / Follow-ups",
    promptPath: "/prompts/agents/invoice.txt",
    templatePath: "/templates/agents/invoice.json"
  },
  salesCloser: {
    title: "AI Sales Closer",
    promptPath: "/prompts/agents/salesCloser.txt",
    templatePath: "/templates/agents/salesCloser.json"
  },
  leadQualifier: {
    title: "AI Lead Qualifier",
    promptPath: "/prompts/agents/leadQualifier.txt",
    templatePath: "/templates/agents/leadQualifier.json"
  },
  dmResponder: {
    title: "AI DM Responder",
    promptPath: "/prompts/agents/dmResponder.txt",
    templatePath: "/templates/agents/dmResponder.json"
  }
};

// === [ADD] Collect shared form fields (same pattern as your Receptionist builder) ===
// Customize selectors to your existing inputs (ids below are shown in the HTML snippet)
function getGlobalFields() {
  return {
    BIZ_NAME: document.querySelector("#bizName")?.value || "Your Business",
    AGENT_NAME: document.querySelector("#agentName")?.value || "Ava",
    TIMEZONE: document.querySelector("#timezone")?.value || "America/New_York",
    BIZ_EMAIL: document.querySelector("#bizEmail")?.value || "owner@example.com",

    // AI
    OPENAI_API_KEY: document.querySelector("#openaiKey")?.value || "sk-***",
    OPENAI_MODEL: document.querySelector("#openaiModel")?.value || "gpt-4o-mini",

    // SMTP / Email logs
    SMTP_FROM: document.querySelector("#smtpFrom")?.value || "no-reply@example.com",
    SMTP_CRED_ID: document.querySelector("#smtpCredId")?.value || "SMTP_CREDENTIAL_ID",

    // Airtable
    AIRTABLE_BASE_ID: document.querySelector("#airtableBaseId")?.value || "appXXXXXXXXXXXXXX",
    AIRTABLE_TABLE: document.querySelector("#airtableTable")?.value || "Logs",
    AIRTABLE_CRED_ID: document.querySelector("#airtableCredId")?.value || "AIRTABLE_CREDENTIAL_ID",

    // Calendar
    GOOGLE_CALENDAR_ID: document.querySelector("#calendarId")?.value || "primary",
    GOOGLE_CAL_OAUTH_ID: document.querySelector("#calOAuthId")?.value || "GOOGLE_CAL_OAUTH_CRED_ID",

    // Offer/DM/Sales knobs
    CTA_URL: document.querySelector("#ctaUrl")?.value || "https://yourlink.com",
    OFFER_SNIPPET: document.querySelector("#offerSnippet")?.value || "Quick summary of your offer",
    FOLLOWUP_GAP_HOURS: document.querySelector("#followupGap")?.value || "24",
    PLATFORM_REPLY_WEBHOOK: document.querySelector("#platformWebhook")?.value || "https://example.com/reply",
    BOOK_URL: document.querySelector("#bookUrl")?.value || "https://cal.com/you",
    FAQ_URL: document.querySelector("#faqUrl")?.value || "https://yourdomain.com/faq",

    // Invoicing
    PAYMENT_LINK: document.querySelector("#paymentLink")?.value || "https://pay.yourdomain.com",
    TAX_RULES_SNIPPET: document.querySelector("#taxRules")?.value || "",

    // Scheduling
    BUSINESS_HOURS: document.querySelector("#bizHours")?.value || "Mon-Fri 9:00-17:00",
    BUFFER_MIN: document.querySelector("#bufferMin")?.value || "15",
    DEFAULT_DURATION_MIN: document.querySelector("#defaultDuration")?.value || "30",

    // Qualifier
    QUAL_RULES: document.querySelector("#qualRules")?.value || "A: ready budget & timeline; B: missing one; C: mismatch",

    // Twilio (Sales Closer SMS)
    TWILIO_FROM: document.querySelector("#twilioFrom")?.value || "+15555555555",
    TWILIO_CRED_ID: document.querySelector("#twilioCredId")?.value || "TWILIO_CREDENTIAL_ID",

    // Owner
    OWNER_NAME: document.querySelector("#ownerName")?.value || "Owner",

    // Not used here but kept for parity:
    BIZ_TYPE: document.querySelector("#bizType")?.value || "services",
    UPSells: document.querySelector("#upsells")?.value || "",
    POLICIES_SNIPPET: document.querySelector("#policies")?.value || ""
  };
}

// === [ADD] Fetch text/JSON helpers ===
async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return r.text();
}
async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return r.json();
}

// === [ADD] Core builder for agents ===
async function buildAgent(agentKey, btnPrompt, btnJSON) {
  const defs = AGENT_DEFS[agentKey];
  if (!defs) throw new Error(`Unknown agent: ${agentKey}`);

  const vals = getGlobalFields();

  // 1) Get LONG prompt and inject placeholders
  const rawPrompt = await fetchText(defs.promptPath);
  const longPrompt = injectPlaceholders(rawPrompt, vals);

  // 2) Get template JSON and inject placeholders, including prompt injection
  const tpl = await fetchJSON(defs.templatePath);

  // Replace the sentinel YOU_ARE_* in the OpenAI node with the actual long prompt
  // Find httpRequest nodes and swap the system message content
  (tpl.nodes || []).forEach(n => {
    if (n.type === "n8n-nodes-base.httpRequest" && typeof n.parameters?.bodyParametersJson === "string") {
      let body = n.parameters.bodyParametersJson;
      body = body.replace(/YOU_ARE_[A-Z_]+/g, longPrompt.replace(/`/g, "\\`"));
      body = injectPlaceholders(body, vals);
      n.parameters.bodyParametersJson = body;
    }
    // Inject into headers and other string fields with placeholders
    if (n.parameters?.headerParametersJson && typeof n.parameters.headerParametersJson === "string") {
      n.parameters.headerParametersJson = injectPlaceholders(n.parameters.headerParametersJson, vals);
    }
    // Generic scan for common fields
    const walk = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const k in obj) {
        if (typeof obj[k] === "string") obj[k] = injectPlaceholders(obj[k], vals);
        else walk(obj[k]);
      }
    };
    walk(n.parameters);
  });

  // 3) Prepare downloads
  await setDL(btnPrompt, `${agentKey}-FULL-PROMPT.txt`, longPrompt, "text/plain");
  await setDL(btnJSON, `${agentKey}-workflow.json`, JSON.stringify(tpl, null, 2), "application/json");
}

// === [ADD] Event delegation for agent buttons ===
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-agent][data-action]");
  if (!el) return;
  e.preventDefault();
  el.disabled = true;
  const card = el.closest("[data-agent-card]");
  const agentKey = el.getAttribute("data-agent");
  try {
    const promptBtn = card.querySelector('[data-action="prompt"]');
    const jsonBtn = card.querySelector('[data-action="json"]');
    await buildAgent(agentKey, promptBtn, jsonBtn);
    el.textContent = "Ready ✓";
    setTimeout(() => (el.textContent = el.getAttribute("data-label") || "Generate"), 1200);
  } catch (err) {
    console.error(err);
    el.textContent = "Error";
  } finally {
    el.disabled = false;
  }
});

