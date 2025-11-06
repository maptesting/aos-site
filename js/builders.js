// /js/builders.js
// FINAL: zero-touch workflows + rich prompt .txt
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

  // ---------- Long, sectioned prompt (for .txt only; DOES NOT touch graphs) ----------
  function buildLongPrompt(v = {}) {
    const tz        = v.timezone  || 'America/New_York';
    const biz       = v.bizName   || 'the business';
    const agent     = v.agentName || 'Alex';
    const industry  = v.industry  || 'services';
    const services  = v.services  || 'General services';
    const hours     = v.hours     || 'Mon–Fri 9:00–17:00';
    const location  = v.location  || 'Local area';
    const policies  = v.policies  || 'Standard policies apply.';
    const emailFrom = v.email     || 'no-reply@example.com';
    const L = (val, label) => `${label}: ${val || 'N/A'}`;

    return [
`# ROLE
You are ${agent}, a friendly, efficient AI receptionist for **${biz}** (${industry}). Keep replies to 1–2 sentences, natural and clear.

# CURRENT TIME
- Current time: **${safeNow(tz)}**
- Timezone: **${tz}**
Use ISO 8601 timestamps when interacting with tools.

# BUSINESS CONTEXT
${L(biz,'Business')}
${L(location,'Location / Service')}
${L(industry,'Industry')}
${L(services,'Services')}
${L(hours,'Hours')}
${L(policies,'Policies')}

# TASK
Answer questions and help book appointments quickly.

# BOOKING FLOW
1) Ask for the preferred date/time (within ${hours}).
2) Run the availability check for the requested slot.
3) If unavailable, propose up to 3 close alternatives (same day or next business day).
4) Collect full name, email, phone.
5) Confirm slot and create the booking.
6) Summarize details and say a confirmation will be sent from **${emailFrom}**.

# TRANSFER
If human help is requested, politely hand off.

# STYLE & RULES
- Warm, concise, confident; use contractions.
- Don’t invent availability outside ${hours}.
- Ask a single clarifying question when needed; then act.
- Confirm final date/time + contact details before booking.
- Don’t mention internal tools to the user.

# EXAMPLE
User: “Can I come tomorrow at 3 for ${services.split(',')[0].trim()}?”
You: “Happy to help — is **tomorrow 3:00 PM** best? What’s your **name and email**?”
(then check slot and book)
You: “All set — booked **tomorrow 3:00–4:00 PM**. You’ll get a confirmation shortly.”`
    ].join('\n');
  }

  // ---------- Public API (ZERO-TOUCH on graphs) ----------
  let readyResolve;
  const readyPromise = new Promise((res) => (readyResolve = res));

  AOS.init = async function init() {
    if (state.ready) return;
    // Load exactly what you uploaded into /public/templates/
    const [avail, book] = await Promise.all([
      loadJSON('/templates/checkAvailability.json'),
      loadJSON('/templates/bookAppointment.json'),
    ]);
    // Keep masters pristine; we will only deepClone when building.
    state.tpl.avail = avail;
    state.tpl.book  = book;
    state.ready = true;
    readyResolve(true);
    log('✅ Templates loaded (zero-touch mode)');
  };

  AOS.ready = () => readyPromise;

  // Prompt .txt (rich) — uses form values
  AOS.buildPrompt = (v) => buildLongPrompt(v || {});

  // Workflows — return EXACT copies of your uploaded templates (no edits)
  AOS.buildCheckAvailability = async () => {
    if (!state.ready) await AOS.ready();
    return deepClone(state.tpl.avail);
  };
  AOS.buildBookAppointment = async () => {
    if (!state.ready) await AOS.ready();
    return deepClone(state.tpl.book);
  };

  // Debug: quick stats so UI can assert connections exist (optional)
  AOS.debugBuild = async (kind) => {
    if (!state.ready) await AOS.ready();
    const g = deepClone(kind === 'avail' ? state.tpl.avail : state.tpl.book);
    const nodes = Array.isArray(g.nodes) ? g.nodes : [];
    const conn  = g.connections || {};
    return { nodes: nodes.length, connections: Object.keys(conn).length };
  };

  AOS.truncate = (s, n = 1200) => (s && s.length > n ? s.slice(0, n) + ' …' : (s || ''));

  // start loading immediately
  AOS.init().catch((e) => err('Template preload failed:', e));
})();
