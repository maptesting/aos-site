// /js/builders.js
// Attaches robust builders onto window.AOS. Compatible with n8n 1.119.x

(function () {
  const prev = (typeof window !== 'undefined' ? window.AOS : null) || {};

  // ---------- helpers ----------
  const truncate = prev.truncate || function (s, n = 900) {
    if (!s || typeof s !== 'string') return '';
    return s.length > n ? s.slice(0, n) + "\n\n…(preview truncated)" : s;
  };

  function uuid() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }

  // ---------- FULL PROMPT (long form) ----------
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

    return `# System Role
You are **${agent}**, a friendly, professional AI receptionist for **"${biz}"**, a **${ind}** business in **${loc}**. You speak **${lang}**. Your goals: greet, qualify, check availability, and book appointments; answer basic questions concisely.

# Time & Timezone
- Use the current time.
- Assume the local timezone **${tz}** for all human-readable times unless the user specifies otherwise.
- Tool inputs MUST be ISO 8601 with timezone offset (e.g., 2025-05-12T15:00:00-04:00).

# Tools (invoke only when needed)
- **check_availability(timeISO)** → n8n webhook that checks Google Calendar **${calendarId}** within business hours.
- **book_appointment(full_name, email, phone_number, service_type, timeISO)** → n8n webhook that creates a calendar event in **${calendarId}**.

# Business Context
- **Services**: ${services}
- **Hours**: ${hours} (${tz})
- **Policies**: ${policies}

# Data To Collect (for bookings)
- **Required**: full name, email, phone number, service type, preferred date/time (ISO).
- **Optional**: notes/special requests.

# Conversation Flow
1) **Greet & clarify need** in 1 sentence.
2) If a time is mentioned, **interpret** it in ${tz}, normalize to ISO, then call **check_availability(timeISO)**.
3) If **available**:
   - Collect any missing required fields.
   - Confirm details back to the user in ${tz}.
   - Call **book_appointment(...)** with ISO time.
4) If **unavailable**:
   - Offer **2–3 nearby alternatives** within working hours for the same day; if none, suggest the next working day.
   - After user selects, proceed to booking.
5) **Confirm** and mention the confirmation email will come from **${emailFrom}**.

# Tool Usage Rules
- Only claim a slot is free **after** **check_availability** confirms it.
- Always send **ISO** time to tools.
- Be brief and natural; 1–2 sentences per reply.

# Examples
**User**: Can you do Friday at 3pm?
**You**: Sure — one moment while I check Friday 3:00 PM ${tz}. If that’s taken, I can suggest close alternatives.

*(Then call \`check_availability("2025-05-16T15:00:00-04:00")\`.)*

**User**: Friday at 3 works. I’m Jordan Lee, 555-212-8787, jordan@example.com, Full detail.
**You**: Perfect — booking Friday 3:00–4:00 PM for a Full Detail. I’ll send the confirmation to jordan@example.com now.

*(Then call \`book_appointment(full_name, email, phone_number, service_type, timeISO)\`.)*

# Tone
Warm, concise, professional. Use natural phrasing and light transitions (“Got it”, “No problem”, “Happy to help”).`;
  }

  // ---------- n8n WORKFLOW: checkAvailability ----------
  function buildCheckAvailability(v = {}) {
    const tz = v.timezone || 'America/New_York';
    const calendarId = v.calendarId || 'primary';
    const wfId = uuid();
    const webhookPath = 'check_availability';

    const nWebhook = {
      parameters: {
        httpMethod: 'POST',
        path: webhookPath,
        responseMode: 'responseNode',
        options: { responseData: 'allEntries' }
      },
      id: 1,
      name: 'Webhook (check_availability)',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [300, 300]
    };

    const nNormalize = {
      parameters: {
        functionCode: `
const body = $json;
const timeISO = (body.timeISO || body.time || body.date || '').toString();
if (!timeISO) return [{ error: 'Missing timeISO' }];

const start = new Date(timeISO);
if (isNaN(start.getTime())) return [{ error: 'Invalid timeISO' }];

// 60-minute slot by default
const end = new Date(start.getTime() + 60 * 60 * 1000);

return [{
  inputTimeISO: timeISO,
  rangeStart: start.toISOString(),
  rangeEnd: end.toISOString(),
  tz: ${JSON.stringify(tz)},
  calendarId: ${JSON.stringify(calendarId)}
}];
        `.trim()
      },
      id: 2,
      name: 'Normalize Time',
      type: 'n8n-nodes-base.function',
      typeVersion: 2,
      position: [580, 300]
    };

    const nGcalGet = {
      parameters: {
        operation: 'getMany',
        calendar: calendarId,
        options: {
          timeMin: '={{$json["rangeStart"]}}',
          timeMax: '={{$json["rangeEnd"]}}',
          singleEvents: true
        }
      },
      id: 3,
      name: 'Google Calendar: Get Many',
      type: 'n8n-nodes-base.googleCalendar',
      typeVersion: 3,
      position: [860, 300],
      credentials: {}
    };

    const nIf = {
      parameters: {
        conditions: {
          number: [
            {
              value1: '={{ $json.total ?? ($json.length ?? 0) }}',
              operation: 'equal',
              value2: 0
            }
          ]
        }
      },
      id: 4,
      name: 'IF (No Events)',
      type: 'n8n-nodes-base.if',
      typeVersion: 1,
      position: [1120, 300]
    };

    const nMapTrue = {
      parameters: { functionCode: `return [{ available: true }];` },
      id: 5,
      name: 'Map Available',
      type: 'n8n-nodes-base.function',
      typeVersion: 2,
      position: [1300, 160]
    };

    const nMapFalse = {
      parameters: { functionCode: `return [{ available: false }];` },
      id: 6,
      name: 'Map Unavailable',
      type: 'n8n-nodes-base.function',
      typeVersion: 2,
      position: [1300, 440]
    };

    const nRespond = {
      parameters: {
        response: 'json',
        responseBody: '={{ $json }}',
        options: { responseCode: 200 }
      },
      id: 7,
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1480, 300]
    };

    return {
      name: 'checkAvailability',
      nodes: [nWebhook, nNormalize, nGcalGet, nIf, nMapTrue, nMapFalse, nRespond],
      connections: {
        'Webhook (check_availability)': { main: [[ { node: 'Normalize Time', type: 'main', index: 0 } ]] },
        'Normalize Time': { main: [[ { node: 'Google Calendar: Get Many', type: 'main', index: 0 } ]] },
        'Google Calendar: Get Many': { main: [[ { node: 'IF (No Events)', type: 'main', index: 0 } ]] },
        'IF (No Events)': {
          main: [
            [ { node: 'Map Available', type: 'main', index: 0 } ],
            [ { node: 'Map Unavailable', type: 'main', index: 0 } ]
          ]
        },
        'Map Available':   { main: [[ { node: 'Respond', type: 'main', index: 0 } ]] },
        'Map Unavailable': { main: [[ { node: 'Respond', type: 'main', index: 0 } ]] }
      },
      pinData: {},
      staticData: {},
      meta: { instanceId: wfId, version: '1.119.x' },
      settings: { timezone: tz },
      active: false,
      id: wfId
    };
  }

  // ---------- n8n WORKFLOW: bookAppointment ----------
  function buildBookAppointment(v = {}) {
    const tz = v.timezone || 'America/New_York';
    const calendarId = v.calendarId || 'primary';
    const biz = v.bizName || 'Your Business';

    const wfId = uuid();
    const webhookPath = 'book_appointment';

    const nWebhook = {
      parameters: {
        httpMethod: 'POST',
        path: webhookPath,
        responseMode: 'responseNode',
        options: { responseData: 'allEntries' }
      },
      id: 10,
      name: 'Webhook (book_appointment)',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [300, 300]
    };

    const nBuildEvent = {
      parameters: {
        functionCode: `
const b = $json;
const required = ['full_name','email','phone_number','service_type','timeISO'];
for (const k of required) {
  if (!b[k]) return [{ error: 'Missing ' + k }];
}
const start = new Date(b.timeISO);
if (isNaN(start.getTime())) return [{ error: 'Invalid timeISO' }];
const end = new Date(start.getTime() + 60*60*1000);

return [{
  summary: (b.service_type || 'Appointment') + ' — ${biz}',
  description: \`Client: \${b.full_name}\\nEmail: \${b.email}\\nPhone: \${b.phone_number}\\nService: \${b.service_type}\`,
  start: start.toISOString(),
  end: end.toISOString(),
  calendarId: ${JSON.stringify(calendarId)}
}];
        `.trim()
      },
      id: 11,
      name: 'Build Event',
      type: 'n8n-nodes-base.function',
      typeVersion: 2,
      position: [580, 300]
    };

    const nGcalCreate = {
      parameters: {
        operation: 'create',
        calendar: calendarId,
        start: '={{$json["start"]}}',
        end: '={{$json["end"]}}',
        additionalFields: {
          summary: '={{$json["summary"]}}',
          description: '={{$json["description"]}}'
        }
      },
      id: 12,
      name: 'Google Calendar: Create Event',
      type: 'n8n-nodes-base.googleCalendar',
      typeVersion: 3,
      position: [860, 300],
      credentials: {}
    };

    const nRespond = {
      parameters: {
        response: 'json',
        responseBody: `={{ { booked: true, summary: $json.summary, start: $json.start, end: $json.end } }}`,
        options: { responseCode: 200 }
      },
      id: 13,
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1120, 300]
    };

    return {
      name: 'bookAppointment',
      nodes: [nWebhook, nBuildEvent, nGcalCreate, nRespond],
      connections: {
        'Webhook (book_appointment)': { main: [[ { node: 'Build Event', type: 'main', index: 0 } ]] },
        'Build Event': { main: [[ { node: 'Google Calendar: Create Event', type: 'main', index: 0 } ]] },
        'Google Calendar: Create Event': { main: [[ { node: 'Respond', type: 'main', index: 0 } ]] }
      },
      pinData: {},
      staticData: {},
      meta: { instanceId: wfId, version: '1.119.x' },
      settings: { timezone: tz },
      active: false,
      id: wfId
    };
  }

  // ---------- expose ----------
  const AOS = {
    truncate,
    buildPrompt,
    buildCheckAvailability,
    buildBookAppointment
  };

  if (typeof window !== 'undefined') window.AOS = AOS;
})();
