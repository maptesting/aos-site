// /js/builders.js
// Uses your exact n8n blueprints as templates and injects business fields.
// Keep templates at: /templates/checkAvailability.json and /templates/bookAppointment.json

(function () {
  const prev = (typeof window !== 'undefined' ? window.AOS : null) || {};
  const truncate = prev.truncate || ((s, n = 900) => (!s || typeof s !== 'string') ? '' : (s.length > n ? s.slice(0, n) + "\n\n…(preview truncated)" : s));
  const slugify = (s = '') => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,40) || 'biz';

  let TPL_CHECK = null;
  let TPL_BOOK  = null;

  async function fetchTemplate(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load template ${url}: ${res.status}`);
    return await res.json();
  }

  async function ensureTemplates() {
    if (!TPL_CHECK) TPL_CHECK = await fetchTemplate('/templates/checkAvailability.json');
    if (!TPL_BOOK)  TPL_BOOK  = await fetchTemplate('/templates/bookAppointment.json');
  }

  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  function findNodeByType(nodes, type) {
    return nodes.find(n => n.type === type) || null;
  }
  function findNodeByNameStarts(nodes, starts){
    return nodes.find(n => String(n.name || '').startsWith(starts)) || null;
  }

  function personalizeWorkflow(template, {
    kind, bizName, calendarId, timezone, email, systemPrompt
  }) {
    const wf = clone(template);

    // 1) Webhook path + visible name
    const slug = slugify(bizName);
    const path = (kind === 'check')
      ? `check_availability_${slug}`
      : `book_appointment_${slug}`;

    const webhookNode = findNodeByType(wf.nodes, 'n8n-nodes-base.webhook') ||
                        findNodeByNameStarts(wf.nodes, 'Webhook (');
    if (webhookNode && webhookNode.parameters) {
      webhookNode.parameters.path = path;
      webhookNode.name = `Webhook (${kind === 'check' ? 'check_availability' : 'book_appointment'})`;
    }

    // 2) Agent system prompt
    const agentNode = findNodeByType(wf.nodes, '@n8n/n8n-nodes-langchain.agent') ||
                      findNodeByNameStarts(wf.nodes, 'AI Agent');
    if (agentNode?.parameters) agentNode.parameters.systemMessage = systemPrompt;

    // 3) Keep graph connections 100% as in template (no touching)
    wf.settings = wf.settings || {};
    wf.settings.timezone = timezone || wf.settings.timezone || 'America/New_York';
    wf.meta = wf.meta || {};
    wf.meta.version = '1.119.x';

    return wf;
  }

  // ---------------- Long production prompt (for .txt download) ----------------
  function buildPrompt(v = {}) {
    const agent     = v.agentName || "Alex";
    const biz       = v.bizName || "Your Business";
    const ind       = v.industry || "services";
    const loc       = v.location || "your city";
    const lang      = v.language || "English";
    const tz        = v.timezone || "America/New_York";
    const hours     = v.hours || "Mon–Sat 9:00–18:00";
    const services  = v.services || "General consultation";
    const emailFrom = v.email || "support@yourdomain.com";
    const calendarId= v.calendarId || "primary";
    const policies  = v.policies || "Be courteous; confirm details before booking.";
    const calTool   = `Google Calendar Tool (${calendarId})`;

    return `# System Role
You are **${agent}**, a friendly, professional AI receptionist for **"${biz}"**, a **${ind}** business in **${loc}**. You speak **${lang}**. Your goals: greet, qualify, check availability, and book appointments; answer basic questions concisely.

# Time & Timezone
- Use the current time provided by the system.
- Assume local timezone **${tz}** for human-readable times unless the user specifies otherwise.
- When calling tools, you MUST send time in **ISO 8601** format with timezone offset (e.g., 2025-05-12T15:00:00-04:00).

# Tools (use only when needed)
- **${calTool}**: a LangChain tool that can read availability and create events in the Google Calendar **${calendarId}**.

# Business Context
- **Services**: ${services}
- **Hours**: ${hours} (${tz})
- **Policies**: ${policies}

# Data To Collect (for bookings)
- **Required**: full name, email, phone number, service type, preferred date/time.
- **Optional**: notes/special requests.

# Core Behaviors
1) **Greet** and clarify intent in 1 short sentence.
2) If a time is mentioned, **interpret** it in ${tz}, normalize to ISO, and use **${calTool}** to check availability.
3) If **available**:
   - Collect any missing required fields.
   - Confirm details back to the user in ${tz}.
   - Use **${calTool}** to create the event.
4) If **unavailable**:
   - Offer **2–3 nearby alternatives** within working hours for the same day; if none, suggest the next working day.
5) **Confirm** and mention a confirmation email will come from **${emailFrom}**.

# Tool Usage Rules
- Do not claim a time slot is free until **${calTool}** confirms it.
- Always send ISO time to the tool.
- Keep responses short (1–2 sentences), warm, and professional.

# Examples
User: “Can you do Friday at 3pm?”
You: “Sure — one moment while I check Friday 3:00 PM ${tz}. If that’s booked, I’ll suggest nearby times.”

*(Use ${calTool} to check “2025-05-16T15:00:00-04:00”.)*

User: “Friday at 3 works. I’m Jordan Lee, 555-212-8787, jordan@example.com, Full detail.”
You: “Perfect — booking Friday 3:00–4:00 PM for a Full Detail. I’ll send a confirmation to jordan@example.com now.”

*(Use ${calTool} to create the event with the collected details.)*`;
  }

  // ---------------- Build from templates (async) ----------------
  async function buildCheckAvailability(v = {}) {
    await ensureTemplates();
    const systemPrompt = [
      `You are the receptionist for "${v.bizName || 'Your Business'}". Timezone: ${v.timezone || 'America/New_York'}.`,
      `Task: Interpret user date/time in local timezone, convert to ISO 8601 with offset, and use Google Calendar Tool to CHECK whether that slot is free in calendar "${v.calendarId || 'primary'}".`,
      `If free, say it's available and ask for any missing required fields for booking. If not free, propose 2–3 nearby slots within business hours.`,
      `Keep replies short (1–2 sentences).`
    ].join(' ');
    return personalizeWorkflow(TPL_CHECK, {
      kind: 'check',
      bizName: v.bizName,
      calendarId: v.calendarId,
      timezone: v.timezone,
      email: v.email,
      systemPrompt
    });
  }

  async function buildBookAppointment(v = {}) {
    await ensureTemplates();
    const systemPrompt = [
      `You are the receptionist for "${v.bizName || 'Your Business'}". Timezone: ${v.timezone || 'America/New_York'}.`,
      `Task: Ask for and confirm required fields: full name, email, phone number, service type, and preferred date/time (ISO).`,
      `Use Google Calendar Tool to CREATE an event in "${v.calendarId || 'primary'}" for 60 minutes at the selected time.`,
      `After creation, confirm the exact booking time (${v.timezone || 'America/New_York'}) and mention a confirmation will be sent from ${v.email || 'support@yourdomain.com'}.`,
      `Keep replies short (1–2 sentences).`
    ].join(' ');
    return personalizeWorkflow(TPL_BOOK, {
      kind: 'book',
      bizName: v.bizName,
      calendarId: v.calendarId,
      timezone: v.timezone,
      email: v.email,
      systemPrompt
    });
  }

  // Expose
  const AOS = {
    truncate,
    buildPrompt,                 // string
    buildCheckAvailability,      // Promise<object>
    buildBookAppointment         // Promise<object>
  };
  if (typeof window !== 'undefined') window.AOS = AOS;
})();
