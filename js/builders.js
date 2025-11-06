// js/builders.js (ONLY the two functions below need to exist/replace)
// (If you already added the "safe AOS attach" block earlier, keep it;
//  just ensure these functions are assigned onto window.AOS.)

(function () {
  const prev = (typeof window !== 'undefined' ? window.AOS : null) || {};

  function uuid() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }

  // ---------- CHECK AVAILABILITY WORKFLOW ----------
  function buildCheckAvailability(v = {}) {
    const tz = v.timezone || 'America/New_York';
    const calendarId = v.calendarId || 'primary';

    const wfId = uuid();
    const webhookPath = 'check_availability'; // keep stable so your agent can call it

    // Nodes
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
if (!timeISO) {
  return [{ error: 'Missing timeISO' }];
}
const start = new Date(timeISO);
if (isNaN(start.getTime())) {
  return [{ error: 'Invalid timeISO' }];
}
// 60-minute slot by default
const end = new Date(start.getTime() + 60 * 60 * 1000);
return [{
  timeISO,
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
          // show events overlapping the window
          singleEvents: true
        }
      },
      id: 3,
      name: 'Google Calendar: Get Many',
      type: 'n8n-nodes-base.googleCalendar',
      typeVersion: 3,
      position: [860, 300],
      // credentials will be attached by the user inside n8n
      credentials: {}
    };

    const nIf = {
      parameters: {
        conditions: {
          number: [
            {
              value1: '={{$json["total"] || ($json.length ?? 0)}}',
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

    const nRespond = {
      parameters: {
        response: 'json',
        responseBody: '={{ $json.available !== undefined ? $json : { available: $branch === "main" } }}',
        options: { responseCode: 200 }
      },
      id: 5,
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1380, 300]
    };

    const nMapTrue = {
      parameters: {
        functionCode: `return [{ available: true }];`
      },
      id: 6,
      name: 'Map Available',
      type: 'n8n-nodes-base.function',
      typeVersion: 2,
      position: [1300, 160]
    };

    const nMapFalse = {
      parameters: {
        functionCode: `return [{ available: false }];`
      },
      id: 7,
      name: 'Map Unavailable',
      type: 'n8n-nodes-base.function',
      typeVersion: 2,
      position: [1300, 440]
    };

    return {
      name: 'checkAvailability',
      nodes: [nWebhook, nNormalize, nGcalGet, nIf, nRespond, nMapTrue, nMapFalse],
      connections: {
        'Webhook (check_availability)': { main: [[ { node: 'Normalize Time', type: 'main', index: 0 } ]] },
        'Normalize Time': { main: [[ { node: 'Google Calendar: Get Many', type: 'main', index: 0 } ]] },
        'Google Calendar: Get Many': { main: [[ { node: 'IF (No Events)', type: 'main', index: 0 } ]] },
        'IF (No Events)': {
          main: [
            [ { node: 'Map Available', type: 'main', index: 0 } ],   // true
            [ { node: 'Map Unavailable', type: 'main', index: 0 } ]  // false
          ]
        },
        'Map Available': { main: [[ { node: 'Respond', type: 'main', index: 0 } ]] },
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

  // ---------- BOOK APPOINTMENT WORKFLOW ----------
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
          description: '={{$json["description"]}}',
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
        responseBody: `={{ { booked: true, start: $json.start, end: $json.end, summary: $json.summary } }}`,
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

  // expose (preserve other helpers like buildPrompt/truncate if already defined)
  const AOS = {
    truncate: prev.truncate || ((s,n=900)=> s && s.length>n ? s.slice(0,n) + "\n\n…(preview truncated)" : (s||"")),
    buildPrompt: prev.buildPrompt,
    buildCheckAvailability,
    buildBookAppointment
  };

  if (typeof window !== 'undefined') window.AOS = AOS;
})();
