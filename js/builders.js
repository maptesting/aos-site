// /js/builders.js
// Robust builders with: immutable templates, allowlisted injection, token-guarded prompt,
// deterministic init, and regression checks for connections.

(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = { ready: false, tpl: { avail: null, book: null } };

  // ---------- utils ----------
  const log  = (...a) => console.log('[AOS-builders]', ...a);
  const warn = (...a) => console.warn('[AOS-builders]', ...a);
  const err  = (...a) => console.error('[AOS-builders]', ...a);

  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));
  const freezeDeep = (o) => (Object.freeze(o), o);
  const slug = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return new Date().toLocaleString(); }
  }

  // ---------- LONG prompt (rich, sectioned). Only inserted where %%SYSTEM_PROMPT%% exists.
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

    const l = (val, label) => `${label}: ${val || 'N/A'}`;

    return [
`# ROLE
You are ${agent}, a friendly, efficient, and professional AI receptionist for **${biz}** (${industry}). Keep replies to 1–2 sentences, human and clear.

# CURRENT TIME
- Current time: **${safeNow(tz)}**
- Timezone: **${tz}**
Use ISO 8601 for tool calls (e.g. 2025-11-06T15:30:00-05:00).

# BUSINESS CONTEXT
${l(biz,'Business')}
${l(location,'Location / Service area')}
${l(industry,'Industry')}
${l(services,'Services')}
${l(hours,'Hours')}
${l(policies,'Policies')}

# TASK
Answer questions and book appointments quickly.

# BOOKING FLOW
1) Ask for preferred date/time within ${hours}.
2) Run checkAvailability (workflow) with ISO time.
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
- Don’t mention internal tools/functions to the user.

# EXAMPLE
User: “Can I come tomorrow at 3 for ${services.split(',')[0].trim()}?”
You: “Happy to help — is **tomorrow 3:00 PM** still the time you want? What’s your **name and email**?”
(then use workflows)
You: “All set, [Name] — booked for **tomorrow 3:00–4:00 PM**. You’ll get a confirmation from **${emailFrom}**.”`
    ].join('\n');
  }

  // ---------- allowlisted injection helpers ----------
  function injectAllowlisted(graph, values, kind) {
    const g = deepClone(graph); // never mutate the master
    const tz   = values.timezone   || 'America/New_York';
    const cal  = values.calendarId || 'primary';
    const mail = values.email      || '';
    const hook = kind === 'avail'
      ? `/webhook/${slug(values.bizName || 'business')}/check-availability`
      : `/webhook/${slug(values.bizName || 'business')}/book-appointment`;

    const nodes = Array.isArray(g.nodes) ? g.nodes : [];
    for (const n of nodes) {
      // 1) Webhook path (strict)
      if (String(n.type).includes('webhook') && n.parameters && typeof n.parameters.path === 'string') {
        n.parameters.path = hook;
      }

      // 2) Google Calendar tool (strict)
      const isCalTool =
        n.type === 'n8n-nodes-base.googleCalendar' ||
        n.type === 'n8n-nodes-base.googleCalendarTool' ||
        (n.name && n.name.toLowerCase().includes('calendar'));

      if (isCalTool && n.parameters) {
        // calendar id formats can differ per node type; handle common shapes
        if (n.parameters.calendar && typeof n.parameters.calendar === 'object') {
          n.parameters.calendar.value = cal;
          n.parameters.calendar.cachedResultName = cal;
        }
        if (typeof n.parameters.calendarId === 'string') {
          n.parameters.calendarId = cal;
        }
        // timezone may live under options or parameters directly
        if (!n.parameters.options) n.parameters.options = {};
        if (typeof n.parameters.options.timezone === 'string') {
          n.parameters.options.timezone = tz;
        } else if (typeof n.parameters.timezone === 'string') {
          n.parameters.timezone = tz;
        }
      }

      // 3) Only inject SYSTEM_PROMPT where an explicit token exists
      //    (prevents overwriting your crafted agent text)
      const p = n.parameters || {};
      const promptKeys = ['systemMessage','systemPrompt','system','prompt','text'];
      for (const k of promptKeys) {
        if (typeof p[k] === 'string' && p[k].includes('%%SYSTEM_PROMPT%%')) {
          p[k] = p[k].replace('%%SYSTEM_PROMPT%%', buildLongPrompt(values));
        }
      }

      // 4) Email fields (only if present and tokenized)
      if (typeof p.email === 'string' && p.email.includes('%%EMAIL%%')) {
        p.email = p.email.replace('%%EMAIL%%', mail);
      }
      n.parameters = p;
    }

    // regression guard: ensure connections exist
    if (!g.connections || typeof g.connections !== 'object' || !Object.keys(g.connections).length) {
      throw new Error('[AOS] Template connections missing after injection – aborting to prevent a broken download.');
    }
    return g;
  }

  // ---------- public API ----------
  let readyResolve;
  const readyPromise = new Promise((res) => (readyResolve = res));

  AOS.init = async function init() {
    if (state.ready) return;
    const [avail, book] = await Promise.all([
      loadJSON('/templates/checkAvailability.json'),
      loadJSON('/templates/bookAppointment.json'),
    ]);
    // Freeze masters to prevent accidental mutation
    state.tpl.avail = freezeDeep(avail);
    state.tpl.book  = freezeDeep(book);
    state.ready = true;
    readyResolve(true);
    log('✅ Templates loaded & frozen');
  };

  AOS.ready = function ready() { return readyPromise; };

  AOS.buildPrompt = function buildPrompt(values) {
    return buildLongPrompt(values || {});
  };

  AOS.buildCheckAvailability = async function buildCheckAvailability(values) {
    if (!state.ready) await AOS.ready();
    return injectAllowlisted(state.tpl.avail, values || {}, 'avail');
  };

  AOS.buildBookAppointment = async function buildBookAppointment(values) {
    if (!state.ready) await AOS.ready();
    return injectAllowlisted(state.tpl.book, values || {}, 'book');
  };

  AOS.truncate = function truncate(s, n = 1200) {
    return s && s.length > n ? s.slice(0, n) + ' …' : (s || '');
  };

  // start loading immediately
  AOS.init().catch((e) => err('Template preload failed:', e));
})();
