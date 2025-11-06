// /js/builders.js
// Loads your exact n8n templates and builds a LONG, sectioned prompt using form values.

(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = { ready: false, tpl: {} };

  // ---------- utils ----------
  const log  = (...a) => console.log('[AOS-builders]', ...a);
  const warn = (...a) => console.warn('[AOS-builders]', ...a);
  const err  = (...a) => console.error('[AOS-builders]', ...a);

  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  async function loadJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }

  // ---------- template preload (your exact graphs; connections preserved) ----------
  AOS.init = async function init() {
    if (state.ready) return;
    const [avail, book] = await Promise.all([
      loadJSON('/templates/checkAvailability.json'),
      loadJSON('/templates/bookAppointment.json'),
    ]);
    state.tpl.checkAvailability = avail;
    state.tpl.bookAppointment   = book;
    state.ready = true;
    log('✅ n8n templates loaded');
  };

  // ---------- LONG Prompt Builder (modeled after your attached doc) ----------
  // Helper: safe lines
  function line(v, label) {
    return v ? `${label}: ${v}` : `${label}: N/A`;
  }
  function nowInTZ(tz) {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: tz || 'America/New_York',
        weekday: 'long', year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return new Date().toLocaleString();
    }
  }

  /**
   * Build a rich, operations-ready receptionist prompt.
   * Sections:
   * - Role
   * - Current Time (use this timezone)
   * - Task
   * - Booking Flow (checkAvailability -> alternatives -> bookAppointment)
   * - Transfer
   * - Goal
   * - Specifics (behavioral rules)
   * - Example Script (short)
   * - Notes
   * - Call Conclusion
   */
  function buildLongPrompt(v) {
    const tz        = v.timezone  || 'America/New_York';
    const biz       = v.bizName   || 'the business';
    const agent     = v.agentName || 'Alex';
    const industry  = v.industry  || 'services';
    const services  = v.services  || 'General services';
    const hours     = v.hours     || 'Mon–Fri 9:00–17:00';
    const location  = v.location  || 'Local area';
    const policies  = v.policies  || 'Standard policies apply.';
    const emailFrom = v.email     || 'no-reply@example.com';

    const nowStr = nowInTZ(tz);

    return [
`# ROLE
You are ${agent}, a friendly, efficient, and professional AI receptionist for **${biz}** (${industry}). You greet naturally, guide the conversation, and keep messages short (1–2 sentences) and human — never robotic.

# CURRENT TIME
Use this exact current time & timezone for availability/booking decisions:
- Current time: **${nowStr}**
- Timezone: **${tz}**
Always provide times in ISO 8601 format when interacting with tools (e.g. \`YYYY-MM-DDTHH:MM:SS±HH:MM\`).

# BUSINESS CONTEXT
${line(biz, 'Business')}
${line(location, 'Location / Service area')}
${line(industry, 'Industry')}
${line(services, 'Services')}
${line(hours, 'Hours')}
${line(policies, 'Policies')}

# TASK
Answer questions about the business and — when the user wants to book — collect details and schedule. Keep replies concise and personable.

# BOOKING FLOW
1) Ask what they need and for **preferred date/time** (within hours: ${hours}).
2) Call **checkAvailability** (via the workflow) with ISO 8601 date/time.
3) If outside hours, remind them of hours and ask for another time; run **checkAvailability** again.
4) If unavailable, suggest up to **3 nearby alternatives** (same day if possible; otherwise the next business day). Confirm one choice.
5) Collect **full name, email, phone** (if not already captured).
6) Call **bookAppointment** with confirmed details (ISO 8601 start; set duration per service default).
7) After success, **summarize** booking details and advise they’ll receive a confirmation from **${emailFrom}**.

# TRANSFER
If the user asks to talk to a manager or needs human support, hand off using the transfer mechanism available in your system. Keep it polite and brief.

# GOAL
Help every user quickly:
- Understand offerings & policies,
- Find a suitable time,
- Get booked with minimal back-and-forth,
- Leave feeling taken care of.

# SPECIFICS & STYLE
- Warm, clear, confident. Use contractions (“you’re all set”, “let’s do it”).
- **Never** invent availability outside business hours.
- If details are unclear, ask a **single clarifying question**, then proceed.
- Confirm **final date/time + contact info** before booking.
- Use the customer’s name once you have it.
- Avoid walls of text (max ~2 sentences per reply unless summarizing).
- If you don’t know an answer, don’t guess — say you’re not sure and offer to follow up by email.
- Do **not** mention internal tools or function names to the user.

# EXAMPLE DIALOGUE (Appointment)
- User: “Can I come in tomorrow around 3pm for ${services.split(',')[0].trim()}?”
- You: “Happy to help! Is **tomorrow at 3:00 PM** still good, and what’s your **name and email**?”
- (Internally: run **checkAvailability** for the requested slot in ${tz}.)
- You: “We’re **open** then. Can I also get your **phone** to confirm?”
- (Internally: run **bookAppointment** with ISO 8601 times.)
- You: “All set, **[Name]** — you’re booked for **tomorrow 3:00–4:00 PM**. You’ll get a confirmation from **${emailFrom}**. Anything else I can do?”

# NOTES
- If the requested slot is unavailable, propose up to 3 nearby alternatives.
- If the day is fully booked, offer the next business day options near the original hour.
- Respect ${hours}. If the user requests outside hours, gently steer them back inside.
- If policies are relevant (e.g., deposits, cancellations): “Quick note: **${policies}**”.

# CALL CONCLUSION
Once booked or the question is resolved, close politely:
“Great — you’re all set! You’ll get a confirmation shortly. Have a great day!”`
    ].join('\n');
  }

  // ---------- string placeholder injection (non-destructive to graph structure) ----------
  function injectPlaceholders(graph, v, kind) {
    const g = deepClone(graph);
    const map = {
      WEBHOOK_PATH: kind === 'avail'
        ? `/webhook/${slug(v.bizName || 'business')}/check-availability`
        : `/webhook/${slug(v.bizName || 'business')}/book-appointment`,
      TIMEZONE:     v.timezone   || 'America/New_York',
      CALENDAR_ID:  v.calendarId || 'primary',
      EMAIL:        v.email      || '',
      SYSTEM_PROMPT: buildLongPrompt(v),
    };

    // Global string replace sweep across the JSON (keeps nodes & connections intact)
    return JSON.parse(JSON.stringify(g), (_, val) => {
      if (typeof val !== 'string') return val;
      return val
        .replace(/\{\{\s*WEBHOOK_PATH\s*\}\}/g, map.WEBHOOK_PATH)
        .replace(/\{\{\s*TIMEZONE\s*\}\}/g, map.TIMEZONE)
        .replace(/\{\{\s*CALENDAR_ID\s*\}\}/g, map.CALENDAR_ID)
        .replace(/\{\{\s*EMAIL\s*\}\}/g, map.EMAIL)
        .replace(/\{\{\s*SYSTEM_PROMPT\s*\}\}/g, map.SYSTEM_PROMPT);
    });
  }

  // ---------- public API ----------
  AOS.buildPrompt = function buildPrompt(values) {
    // Prompt doesn’t require templates; can run before AOS.init()
    return buildLongPrompt(values || {});
  };

  AOS.buildCheckAvailability = async function buildCheckAvailability(values) {
    if (!state.ready) await AOS.init();
    return injectPlaceholders(state.tpl.checkAvailability, values || {}, 'avail');
  };

  AOS.buildBookAppointment = async function buildBookAppointment(values) {
    if (!state.ready) await AOS.init();
    return injectPlaceholders(state.tpl.bookAppointment, values || {}, 'book');
  };

  AOS.truncate = function truncate(s, n = 1200) {
    return s && s.length > n ? s.slice(0, n) + ' …' : (s || '');
  };

  // Preload templates so downloads work immediately after first preview
  AOS.init().catch((e) => err('Template preload failed:', e));
})();
