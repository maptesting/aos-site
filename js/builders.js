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
