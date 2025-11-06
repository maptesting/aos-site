// /js/builders.js
// Immutable templates + allowlisted injection + token-guarded prompt + graph validation.

(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = { ready: false, tpl: { avail: null, book: null } };

  // ---------- utils ----------
  const log  = (...a) => console.log('[AOS-builders]', ...a);
  const warn = (...a) => console.warn('[AOS-builders]', ...a);
  const err  = (...a) => console.error('[AOS-builders]', ...a);
  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));
  const freezeDeep = (o) => (Object.freeze(o), o);
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  async function loadJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }

  function safeNow(tz) {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: tz || 'America/New_York',
        weekday: 'long', year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return new Date().toLocaleString(); }
  }

  // ---------- Long, operational prompt (only inserted where %%SYSTEM_PROMPT%% exists) ----------
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
You are ${agent}, a friendly, efficient, and professional AI receptionist for **${biz}** (${industry}). Keep replies to 1–2 sentences, human and clear.

# CURRENT TIME
- Current time: **${safeNow(tz)}**
- Timezone: **${tz}**
Use ISO 8601 for tool calls.

# BUSINESS CONTEXT
${L(biz,'Business')}
${L(location,'Location / Service')}
${L(industry,'Industry')}
${L(services,'Services')}
${L(hours,'Hours')}
${L(policies,'Policies')}

# TASK
Answer questions and book appointments quickly.

# BOOKING FLOW
1) Ask for preferred date/time within ${hours}.
2) Run checkAvailability with ISO time.
3) If unavailable, propose up to 3 close alternatives (same day; else next business day).
4) Collect full name, email, phone.
5) Run bookAppointment with ISO start; default duration per service.
6) Summarize booking and say they’ll get a confirmation from **${emailFrom}**.

# TRANSFER
If human help is requested, hand off politely.

# GOAL
Get the user a suitable time with minimal back-and-forth.

# STYLE & RULES
- Warm, concise, confident; use contractions.
- Never invent availability outside ${hours}.
- Ask one clarifying question when needed; then act.
- Confirm final date/time + contact details before booking.
- Don’t mention internal tools to the user.

# EXAMPLE
User: “Can I come tomorrow at 3 for ${services.split(',')[0].trim()}?”
You: “Happy to help — is **tomorrow 3:00 PM** still best? What’s your **name and email**?”
(then use workflows)
You: “All set, [Name] — booked **tomorrow 3:00–4:00 PM**. You’ll get a confirmation shortly.”`
    ].join('\n');
  }

  // ---------- Strict, allowlisted injection (no global replace, no name changes) ----------
  function injectAllowlisted(graph, values, kind) {
    const g = deepClone(graph); // never mutate masters

    const tz   = values.timezone   || 'America/New_York';
    const cal  = values.calendarId || 'primary';
    const mail = values.email      || '';
    const hook = kind === 'avail'
      ? `/webhook/${slug(values.bizName || 'business')}/check-availability`
      : `/webhook/${slug(values.bizName || 'business')}/book-appointment`;

    const nodes = Array.isArray(g.nodes) ? g.nodes : [];
    for (const n of nodes) {
      const p = n.parameters || {};

      // 1) Webhook path if present
      if (String(n.type).includes('webhook') && typeof p.path === 'string') {
        p.path = hook;
      }

      // 2) Google Calendar tool/calendar id/timezone if present
      const isCal =
        n.type === 'n8n-nodes-base.googleCalendar' ||
        n.type === 'n8n-nodes-base.googleCalendarTool' ||
        (n.name && n.name.toLowerCase().includes('calendar'));

      if (isCal) {
        if (p.calendar && typeof p.calendar === 'object') {
          p.calendar.value = cal;
          p.calendar.cachedResultName = cal;
        }
        if (typeof p.calendarId === 'string') {
          p.calendarId = cal;
        }
        if (!p.options) p.options = {};
        if (typeof p.options.timezone === 'string') {
          p.options.timezone = tz;
        } else if (typeof p.timezone === 'string') {
          p.timezone = tz;
        }
      }

      // 3) Only inject SYSTEM_PROMPT where the explicit token exists
      const promptKeys = ['systemMessage','systemPrompt','system','prompt','text'];
      for (const k of promptKeys) {
        if (typeof p[k] === 'string' && p[k].includes('%%SYSTEM_PROMPT%%')) {
          p[k] = p[k].replace('%%SYSTEM_PROMPT%%', buildLongPrompt(values));
        }
      }

      // 4) Email token if present
      if (typeof p.email === 'string' && p.email.includes('%%EMAIL%%')) {
        p.email = p.email.replace('%%EMAIL%%', mail);
      }

      n.parameters = p; // write back
    }

    // ---- Graph validation (prevents exporting broken workflows)
    const nodeCount = nodes.length;
    const conn = g.connections && typeof g.connections === 'object' ? g.connections : {};
    const connCount = Object.keys(conn).length;

    if (!nodeCount) {
      throw new Error('[AOS] Template has no nodes.');
    }
    if (!connCount) {
      // Keep the error explicit so you see it immediately if something strips connections
      throw new Error('[AOS] Template connections are empty after injection. Aborting to prevent a broken download.');
    }
    return g;
  }

  // ---------- Public API ----------
  let readyResolve;
  const readyPromise = new Promise((res) => (readyResolve = res));

  AOS.init = async function init() {
    if (state.ready) return;
    const [avail, book] = await Promise.all([
      loadJSON('/templates/checkAvailability.json'),
      loadJSON('/templates/bookAppointment.json'),
    ]);
    state.tpl.avail = freezeDeep(avail);
    state.tpl.book  = freezeDeep(book);
    state.ready = true;
    readyResolve(true);
    log('✅ Templates loaded & frozen');
  };

  AOS.ready = () => readyPromise;

  AOS.buildPrompt = (v) => buildLongPrompt(v || {});

  AOS.buildCheckAvailability = async (v) => {
    if (!state.ready) await AOS.ready();
    return injectAllowlisted(state.tpl.avail, v || {}, 'avail');
  };

  AOS.buildBookAppointment = async (v) => {
    if (!state.ready) await AOS.ready();
    return injectAllowlisted(state.tpl.book, v || {}, 'book');
  };

  // Expose a debug helper so the UI can assert connections before enabling downloads
  AOS.debugBuild = async (kind, v) => {
    const graph = kind === 'avail'
      ? await AOS.buildCheckAvailability(v || {})
      : await AOS.buildBookAppointment(v || {});
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const conn  = graph.connections || {};
    return {
      nodes: nodes.length,
      connections: Object.keys(conn).length,
      names: nodes.map(n => n.name)
    };
  };

  // preload
  AOS.init().catch((e) => err('Template preload failed:', e));
})();
