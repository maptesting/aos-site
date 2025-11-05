// js/builders.js
(function(){
  const AOS = {};

  function trunc(s, n=900){ return s.length>n ? s.slice(0,n) + "\n\n…(preview truncated)" : s; }
  function nowTZ(tz){ return `{{ "now" | date: "%A, %B %d, %Y, %I:%M %p", "${tz||'America/New_York'}" }}`; }
  function rid(){ return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2); }

  AOS.buildPrompt = (v)=>{
    const tz = v.timezone || "America/New_York";
    return `## Role
You are the AI Receptionist (“${v.agentName||'Alex'}”) for "${v.bizName}", a ${v.industry} business in ${v.location}. Speak ${v.language||'English'}. Your job is to greet, qualify, check availability, and book.

## Current Time
${nowTZ(tz)}

## Tools
- check_availability(time) → n8n webhook tool
- book_appointment(full_name, email, phone_number, service_type, time) → n8n webhook tool

## Flow
1) Greet & identify need; ask preferred date/time if not given.
2) Call **check_availability** with ISO date-time in ${tz}. If available, proceed; if not, offer 2–3 nearby times.
3) Collect full name, email, phone, service type. Call **book_appointment**.
4) Confirm and say a confirmation will be sent from ${v.email||'our email'}.

## Service Context
Services: ${v.services}.
Hours: ${v.hours||'09:00–18:00'} (${tz})
Policies: ${v.policies||'Be courteous, confirm if unsure.'}

## Style
Short, warm, professional (1–2 sentences). Keep times in ${tz}. Avoid long paragraphs.`;
  };

  // ---------- n8n JSON (matches the user's examples) ----------
  AOS.buildCheckAvailability = (v)=>{
    const calId = v.calendarId || "primary";
    const webhookPath = "check_availability"; // you can edit in n8n
    const wfId = rid();

    return {
      "name": "checkAvailability",
      "nodes": [
        {
          "parameters": {
            "httpMethod": "POST",
            "path": webhookPath,
            "responseMode": "responseNode",
            "options": {}
          },
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 2,
          "position": [-640, 432],
          "id": rid(),
          "name": "Webhook"
        },
        {
          "parameters": {
            "promptType": "define",
            "text":
`=Role:

You are an appointment availability checker. Your job is to get the requested time and use the calendar to check availability for the customer.

The current date and time is: {{ $now }}

Customer requested time is:
{{ $json.body.message.toolCallList[0].function.arguments.time }}

Calendar data:
Working hours ${v.hours||'09:00-18:00'}
Length of each slot: 1 hour

Booking Process
- Check the requested time using the calendar tool.
- If available → confirm.
- If unavailable → suggest up to 3 nearby times the same day; if none, suggest 3 on the next weekday.

Response style:
Natural and conversational. Never return past times. Keep answers concise.`
          },
          "type": "@n8n/n8n-nodes-langchain.agent",
          "typeVersion": 2,
          "position": [-336, 368],
          "id": rid(),
          "name": "AI Agent"
        },
        {
          "parameters": {
            "model": { "__rl": true, "mode": "list", "value": "gpt-4.1-mini" },
            "options": {}
          },
          "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
          "typeVersion": 1,
          "position": [-416, 608],
          "id": rid(),
          "name": "OpenAI Chat Model"
        },
        {
          "parameters": {
            "respondWith": "json",
            "responseBody":
`={
  "results": [
    {
      "toolCallId": "{{ $('Webhook').item.json.body.message.toolCalls[0].id }}",
      "result": "{{ $json.output }}"
    }
  ]
}`
          },
          "type": "n8n-nodes-base.respondToWebhook",
          "typeVersion": 1,
          "position": [64, 416],
          "id": rid(),
          "name": "Respond to Webhook"
        },
        {
          "parameters": {
            "resource": "calendar",
            "calendar": { "__rl": true, "value": calId, "mode": "list" },
            "timeMin": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Start_Time', ``, 'string') }}",
            "timeMax": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('End_Time', ``, 'string') }}",
            "options": {}
          },
          "type": "n8n-nodes-base.googleCalendarTool",
          "typeVersion": 1,
          "position": [-144, 624],
          "id": rid(),
          "name": "check availability"
        }
      ],
      "connections": {
        "Webhook": { "main": [[{ "node": "AI Agent", "type": "main", "index": 0 }]] },
        "OpenAI Chat Model": { "ai_languageModel": [[{ "node": "AI Agent", "type": "ai_languageModel", "index": 0 }]] },
        "AI Agent": { "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]] },
        "check availability": { "ai_tool": [[{ "node": "AI Agent", "type": "ai_tool", "index": 0 }]] }
      },
      "active": false,
      "settings": { "executionOrder": "v1" },
      "id": wfId,
      "tags": []
    };
  };

  AOS.buildBookAppointment = (v)=>{
    const calId = v.calendarId || "primary";
    const webhookPath = "book_appointment";
    const wfId = rid();

    return {
      "name": "bookAppointment",
      "nodes": [
        {
          "parameters": {
            "promptType": "define",
            "text":
`=You are an appointment booking AI Agent. Use the "Create an event in Google Calendar" tool after collecting: full_name, email, phone_number, service_type, and a confirmed time.

Current time: {{ $now }}

Duration: 1 hour (end = start + 1h)

If the event has been scheduled, respond conversationally:
"Hey there — you're booked for {{ $fromAI('Start','', 'string') }}. See you then!"`
          },
          "type": "@n8n/n8n-nodes-langchain.agent",
          "typeVersion": 2,
          "position": [-820, 160],
          "id": rid(),
          "name": "AI Agent"
        },
        {
          "parameters": {
            "model": { "__rl": true, "mode": "list", "value": "gpt-4.1-mini" },
            "options": {}
          },
          "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
          "typeVersion": 1,
          "position": [-920, 400],
          "id": rid(),
          "name": "OpenAI Chat Model"
        },
        {
          "parameters": {
            "calendar": { "__rl": true, "value": calId, "mode": "list" },
            "start": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Start','', 'string') }}",
            "end": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('End','', 'string') }}",
            "additionalFields": {
              "attendees": [
                "={{ $('Webhook').item.json.body.message.toolCalls[0].function.arguments.email }}"
              ],
              "description": "=Details:\\nname: {{ $json.body.message.toolCallList[0].function.arguments.full_name }}\\nService: {{ $('Webhook').item.json.body.message.toolCalls[0].function.arguments.service_type }}\\nTime: {{ $json.body.message.toolCallList[0].function.arguments.time }}\\nEmail: {{ $('Webhook').item.json.body.message.toolCalls[0].function.arguments.email }}",
              "summary": "=New Appointment for {{ $json.body.message.toolCallList[0].function.arguments.full_name }} at {{ $json.body.message.toolCallList[0].function.arguments.time }}"
            }
          },
          "type": "n8n-nodes-base.googleCalendarTool",
          "typeVersion": 1,
          "position": [-660, 400],
          "id": rid(),
          "name": "Create an event in Google Calendar"
        },
        {
          "parameters": {
            "respondWith": "json",
            "responseBody":
`={
  "results": [
    {
      "toolCallId": "{{ $('Webhook').item.json.body.message.toolCalls[0].id }}",
      "result": "{{ $json.output }}"
    }
  ]
}`
          },
          "type": "n8n-nodes-base.respondToWebhook",
          "typeVersion": 1,
          "position": [-360, 240],
          "id": rid(),
          "name": "Respond to Webhook"
        },
        {
          "parameters": {
            "httpMethod": "POST",
            "path": webhookPath,
            "responseMode": "responseNode",
            "options": {}
          },
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 2,
          "position": [-1100, 220],
          "id": "Webhook",
          "name": "Webhook"
        }
      ],
      "connections": {
        "OpenAI Chat Model": { "ai_languageModel": [[{ "node": "AI Agent", "type": "ai_languageModel", "index": 0 }]] },
        "Create an event in Google Calendar": { "ai_tool": [[{ "node": "AI Agent", "type": "ai_tool", "index": 0 }]] },
        "AI Agent": { "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]] },
        "Webhook": { "main": [[{ "node": "AI Agent", "type": "main", "index": 0 }]] }
      },
      "active": false,
      "settings": { "executionOrder": "v1" },
      "id": wfId,
      "tags": []
    };
  };

  AOS.truncate = trunc;
  window.AOS = AOS;
})();
