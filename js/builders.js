// /js/builders.js
// Real LangChain-style n8n workflows + long production prompt.
// Works on n8n 1.119.x (you attach creds to LLM + Google Calendar Tool after import).

(function () {
  const prev = (typeof window !== 'undefined' ? window.AOS : null) || {};

  // -------- helpers --------
  const truncate = prev.truncate || function (s, n = 900) {
    if (!s || typeof s !== 'string') return '';
    return s.length > n ? s.slice(0, n) + "\n\n…(preview truncated)" : s;
  };

  function uuid() {
    // human-friendly random id; n8n assigns its own internal ids anyway
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }

  function slugify(s = '') {
    return (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'biz';
  }

  // -------- LONG, production prompt (full text) --------
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
   - After user selects, proceed to booking.
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

  // -------- LangChain agent workflows (AI + Calendar Tool) --------
  // Design: Webhook -> Agent; LLM -> Agent (model); GoogleCalendarTool -> Agent (tools); Agent -> Respond
  // You will attach:
  //   - OpenAI API credentials on lmChatOpenAi node
  //   - Google creds on googleCalendarTool node
  // in n8n after import.

  function baseNodesForAgentFlow({ name, path, systemPrompt }) {
    const idWebhook = 1;
    const idLLM     = 2;
    const idGCal    = 3;
    const idAgent   = 4;
    const idResp    = 5;

    const nodes = [
      {
        parameters: {
          httpMethod: 'POST',
          path,
          responseMode: 'responseNode',
          options: { responseData: 'allEntries' }
        },
        id: idWebhook,
        name: `Webhook (${name})`,
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [300, 300]
      },
      {
        parameters: {
          // You’ll choose the exact model in n8n; gpt-4o works well.
          model: 'gpt-4o',
          temperature: 0.2
        },
        id: idLLM,
        name: 'OpenAI Chat (LLM)',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1,
        position: [560, 160],
        credentials: {} // attach in n8n
      },
      {
        parameters: {
          // Tool node exposes calendar capabilities to the Agent.
          // Configure specifics inside n8n if needed (read/write scope).
        },
        id: idGCal,
        name: 'Google Calendar Tool',
        type: 'n8n-nodes-base.googleCalendarTool',
        typeVersion: 1,
        position: [560, 440],
        credentials: {} // attach in n8n
      },
      {
        parameters: {
          agentType: 'openAiFunctions', // stable with tools
          systemMessage: systemPrompt || 'You are a helpful scheduling assistant.',
          // “Input” to the Agent will be the Webhook body text / fields
          // n8n agent node auto-wires inputs from main input.
        },
        id: idAgent,
        name: 'AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1,
        position: [820, 300]
      },
      {
        parameters: {
          response: 'json',
          responseBody: '={{$json}}',
          options: { responseCode: 200 }
        },
        id: idResp,
        name: 'Respond',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        position: [1080, 300]
      }
    ];

    const connections = {
      [`Webhook (${name})`]: { main: [[ { node: 'AI Agent', type: 'main', index: 0 } ]] },
      'OpenAI Chat (LLM)':   { main: [[ { node: 'AI Agent', type: 'model', index: 0 } ]] },
      'Google Calendar Tool':{ main: [[ { node: 'AI Agent', type: 'tools', index: 0 } ]] },
      'AI Agent':            { main: [[ { node: 'Respond', type: 'main', index: 0 } ]] },
    };

    return { nodes, connections };
  }

  function buildCheckAvailability(v = {}) {
    const tz = v.timezone || 'America/New_York';
    const calendarId = v.calendarId || 'primary';
    const biz = v.bizName || 'Your Business';
    const slug = slugify(biz);
    const wfId = uuid();

    const systemPrompt = [
      `You are the receptionist for "${biz}". Timezone: ${tz}.`,
      `Task: When the user provides a date/time, interpret it in ${tz}, convert to ISO 8601 with offset, and use the Google Calendar Tool to CHECK whether that slot is free in the calendar "${calendarId}".`,
      `If free, say it's available and ask for any missing required fields for booking. If not free, propose 2–3 nearby slots within business hours.`,
      `Keep replies short (1–2 sentences).`
    ].join(' ');

    const { nodes, connections } = baseNodesForAgentFlow({
      name: 'check_availability',
      path: `check_availability_${slug}`,
      systemPrompt
    });

    return {
      name: 'checkAvailability',
      nodes,
      connections,
      pinData: {},
      staticData: {},
      meta: { instanceId: wfId, version: '1.119.x' },
      settings: { timezone: tz },
      active: false,
      id: wfId
    };
  }

  function buildBookAppointment(v = {}) {
    const tz = v.timezone || 'America/New_York';
    const calendarId = v.calendarId || 'primary';
    const biz = v.bizName || 'Your Business';
    const emailFrom = v.email || 'support@yourdomain.com';
    const slug = slugify(biz);
    const wfId = uuid();

    const systemPrompt = [
      `You are the receptionist for "${biz}". Timezone: ${tz}.`,
      `Task: Ask for and confirm required fields: full name, email, phone number, service type, and preferred date/time (ISO).`,
      `Use the Google Calendar Tool to CREATE an event in "${calendarId}" for 60 minutes at the selected time.`,
      `After creation, confirm the exact booking time (${tz}) and mention a confirmation will be sent from ${emailFrom}.`,
      `Keep replies short (1–2 sentences).`
    ].join(' ');

    const { nodes, connections } = baseNodesForAgentFlow({
      name: 'book_appointment',
      path: `book_appointment_${slug}`,
      systemPrompt
    });

    return {
      name: 'bookAppointment',
      nodes,
      connections,
      pinData: {},
      staticData: {},
      meta: { instanceId: wfId, version: '1.119.x' },
      settings: { timezone: tz },
      active: false,
      id: wfId
    };
  }

  // -------- expose --------
  const AOS = {
    truncate,
    buildPrompt,
    buildCheckAvailability,
    buildBookAppointment
  };
  if (typeof window !== 'undefined') window.AOS = AOS;
})();
