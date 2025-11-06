<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AOS — AI Receptionist Prompt Pack (Free Builder)</title>

  <!-- SEO + Social -->
  <meta name="description" content="Build your own AI Receptionist in 30 seconds — free. Generate prompts, workflows, and voice previews for any business.">
  <meta property="og:title" content="AOS — Free AI Receptionist Builder">
  <meta property="og:description" content="Generate a custom AI receptionist instantly — prompt, workflows, and voice demo included.">
  <meta property="og:image" content="https://yourdomain.com/og-preview.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Favicon -->
  <link rel="icon" href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤖</text></svg>'>

  <!-- Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Plausible Analytics -->
  <script async src="https://plausible.io/js/pa-Q4KaToxxaS4kAgA27RHba.js"></script>
  <script>
    window.plausible = window.plausible || function(){(plausible.q = plausible.q || []).push(arguments)};
    plausible.init = plausible.init || function(i){plausible.o = i || {}};
    plausible.init();
  </script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { brand: { 500: "#556dff", 600: "#3d4fe6" }, ink: "#0b0f1a" },
          boxShadow: { soft: "0 8px 30px rgba(0,0,0,.18)" }
        }
      }
    }
  </script>
  <style>
    body{background:#0b0f1a;color:#fff}
    .gradient{background:
      radial-gradient(1200px 600px at 20% -10%, rgba(85,109,255,.25), transparent 60%),
      radial-gradient(1000px 600px at 100% 0%, rgba(34,42,130,.35), transparent 60%);}
    .glass{backdrop-filter:blur(10px);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
    .code{white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace}
    input,textarea{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.9rem 1rem}
    input::placeholder,textarea::placeholder{color:rgba(255,255,255,.4)}
    input:focus,textarea:focus{outline:none;box-shadow:0 0 0 2px rgba(85,109,255,.5)}
  </style>
</head>
<body>
  <header class="gradient border-b border-white/10">
    <div class="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-brand-500 grid place-items-center">🤖</div>
        <div>
          <div class="font-semibold">AOS</div>
          <div class="text-white/60 text-xs">AI Optimization Solutions</div>
        </div>
      </div>
      <a href="#builder" class="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600">Build Free</a>
    </div>
  </header>

  <!-- Hero -->
  <section class="relative gradient overflow-hidden">
    <div class="mx-auto max-w-7xl px-4 pt-20 pb-16 md:pt-24 md:pb-24">
      <div class="grid md:grid-cols-2 gap-16 items-start">
        <!-- Left side -->
        <div>
          <h1 class="text-4xl md:text-5xl font-extrabold leading-tight">
            AI Receptionist Prompt Pack — <span class="text-brand-500">Free Builder</span>
          </h1>
          <p class="mt-6 text-white/70 max-w-2xl leading-relaxed">
            Answer a few questions about your business. Get a production-ready System Prompt (preview) and
            download two <b>n8n</b> workflows — <em>checkAvailability</em> and <em>bookAppointment</em>.
            Works with any industry, anywhere.
          </p>
          <div class="mt-8">
            <a href="#builder" class="px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600">Start Building</a>
          </div>
        </div>

        <!-- Live Demo Chat -->
        <div class="glass rounded-2xl p-6 md:p-8 shadow-soft mt-6 md:mt-0" id="demoChat">
          <div class="text-sm text-white/60 mb-2">Talk to Ava — Receptionist at BrightSmile Dental Clinic</div>
          <div id="chatBox" class="h-64 overflow-y-auto bg-black/20 rounded-xl p-3 space-y-3 text-sm border border-white/10">
            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div>
              <div>Hi! This is Ava from BrightSmile Dental — how can I help you today?</div>
            </div>
          </div>
          <form id="chatForm" class="mt-3 flex gap-2" action="javascript:void(0)" autocomplete="off">
            <input id="chatInput" type="text" placeholder="Type your message..." class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" required>
            <button id="chatSend" type="button" class="bg-brand-500 hover:bg-brand-600 rounded-xl px-4 py-2 text-sm font-medium">Send</button>
          </form>
        </div>
      </div>
    </div>
  </section>

  <!-- Builder -->
  <section id="builder" class="py-24 md:py-32 scroll-mt-28">
    <div class="max-w-6xl mx-auto px-4">
      <h2 class="text-center text-3xl font-bold mb-10 text-white">Build your AI Receptionist here 👇</h2>
      <div class="glass rounded-2xl p-6 md:p-10">
        <div class="flex items-start justify-between gap-12 flex-col lg:flex-row">
          <!-- Form -->
          <div class="w-full lg:w-1/2">
            <h3 class="text-2xl font-semibold mb-4">Your Business</h3>
            <form id="aiForm" class="grid gap-4 mt-4">
              <input name="bizName" placeholder="Business Name" required>
              <input name="location" placeholder="Location / Service area" required>
              <input name="industry" placeholder="Industry (e.g., salon, rentals, clinic)" required>
              <input name="services" placeholder="Services (comma-separated)" required>
              <div class="grid md:grid-cols-2 gap-4">
                <input name="agentName" placeholder="Agent Name" value="Alex">
                <input name="language" placeholder="Language" value="English">
              </div>
              <div class="grid md:grid-cols-2 gap-4">
                <input name="hours" placeholder="Hours (e.g., Mon–Sat 9–6)">
                <input name="timezone" placeholder="Timezone (e.g., America/New_York)">
              </div>
              <div class="grid md:grid-cols-2 gap-4">
                <input name="calendarId" placeholder="Google Calendar ID (e.g., primary)">
                <input name="email" type="email" placeholder="Confirmation email sender (optional)">
              </div>
              <textarea name="policies" rows="2" placeholder="Policies / deposits / refunds (optional)"></textarea>

              <div class="mt-3 flex gap-3 flex-wrap">
                <button type="button" id="previewBtn" class="px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 font-medium inline-flex items-center gap-2">
                  <span id="previewSpinner" class="hidden inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  <span>Generate Preview</span>
                </button>
                <button type="button" id="ttsBtn" class="px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 font-medium">▶ Hear AI Greeting</button>
              </div>
            </form>
          </div>

          <!-- Preview -->
          <div class="w-full lg:w-1/2">
            <div class="glass rounded-2xl p-5 h-full">
              <h3 class="text-xl font-semibold">System Prompt — Preview</h3>
              <div class="text-xs text-white/60">Preview only (truncated)</div>
              <div id="promptOut" class="code text-sm bg-black/30 rounded-xl p-4 border border-white/10 min-h-[280px] mt-3"></div>

              <div class="mt-6">
                <h4 class="text-sm font-semibold text-white/80 mb-2">Downloads</h4>
                <div class="flex flex-wrap gap-2">
                  <button id="downloadPromptBtn" class="px-4 py-2 rounded-xl bg-brand-500/80 hover:bg-brand-600 font-medium disabled:opacity-50" disabled>Download Full Prompt (.txt)</button>
                  <button id="downloadAvailBtn" class="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 disabled:opacity-50" disabled>Download: checkAvailability.json</button>
                  <button id="downloadBookBtn" class="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 disabled:opacity-50" disabled>Download: bookAppointment.json</button>
                </div>
                <div id="successMsg" class="hidden mt-3 text-sm text-green-400">Downloaded ✅</div>
              </div>

              <div class="mt-6">
                <div id="audioWrap" class="hidden">
                  <audio id="audio" controls class="w-full"></audio>
                  <a id="audioDownload" download="ai-greeting.mp3" class="inline-block mt-2 text-sm underline decoration-blue-400">Download audio</a>
                </div>
                <div id="notice" class="mt-2 text-xs text-white/60"></div>
                <div id="debug" class="mt-2 text-xs text-red-400"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="text-center text-sm text-white/50 mt-8">
        After import, attach your Google Calendar OAuth2 and OpenAI credentials in n8n.
      </p>
    </div>
  </section>

  <footer class="py-10 text-center text-white/40 text-sm">
    © <span id="year"></span> AOS — AI Optimization Solutions
  </footer>

  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>

  <!-- Try to load your external builders (optional). If it fails, fallbacks below will handle it. -->
  <script src="/js/builders.js" defer></script>
  <script src="/js/demoChat.js" defer></script>

  <!-- ✅ Local FALLBACK for AOS builders: ensures buttons always work -->
  <script>
  (function(){
    // If external builders haven't defined AOS, provide minimal local ones
    window.AOS = window.AOS || {};
    // robust truncate
    if (typeof window.AOS.truncate !== 'function') {
      window.AOS.truncate = function (s, n = 900) {
        if (!s || typeof s !== 'string') return '';
        return s.length > n ? s.slice(0, n) + "\\n\\n…(preview truncated)" : s;
      };
    }
    // production-ready long prompt (fallback)
    if (typeof window.AOS.buildPrompt !== 'function') {
      window.AOS.buildPrompt = function(v){
        const agent     = v.agentName || "Alex";
        const biz       = v.bizName || "Your Business";
        const ind       = v.industry || "services";
        const loc       = v.location || "your city";
        const lang      = v.language || "English";
        const tz        = v.timezone || "America/New_York";
        const hours     = v.hours || "09:00–18:00";
        const services  = v.services || "General consultation";
        const emailFrom = v.email || "our email";
        const calendarId= v.calendarId || "primary";
        const policies  = v.policies || "Be courteous; confirm details before booking.";

        return `# Role
You are **${agent}**, a friendly, professional AI receptionist for **"${biz}"**, a **${ind}** business in **${loc}**. You speak **${lang}**. Your job is to greet, qualify, check availability, and book appointments while answering common questions about the business.

# Current Time
Use the current time and assume local timezone **${tz}** unless the user states otherwise.

# Tools (call them only when needed)
- **check_availability(timeISO)** → n8n webhook tool that checks the Google Calendar for **${calendarId}** within working hours.
- **book_appointment(full_name, email, phone_number, service_type, timeISO)** → n8n webhook tool that creates a calendar event.

**All times you send to tools must be ISO 8601**.

# Objectives
1. Determine if the user wants info or to book.
2. If booking, collect: full name, email, phone, service type, preferred date/time (ISO).
3. Check availability first; suggest alternatives if needed.
4. Confirm the booking and provide a concise summary.

# Business Context
- **Services**: ${services}
- **Working Hours**: ${hours} (${tz})
- **Policies/Notes**: ${policies}

# Flow
1) Greet & clarify intent in 1 sentence.
2) If a time is given, normalize it to ${tz} and call **check_availability**.
3) If free → collect missing fields → call **book_appointment**.
4) If busy → offer 2–3 nearby options → proceed to booking.
5) Close: confirm and say a confirmation email will be sent from **${emailFrom}**.

# Do & Don’t
- Keep replies short (1–2 sentences).
- Use ${tz} in human talk; ISO for tools.
- Don’t disclose tool internals or book without required fields.

# Examples
User: “Can you do Friday 3pm?”
You: “Sure — one sec while I check Friday 3:00 PM ${tz}. If that’s taken, I’ll suggest alternatives.”`;
      };
    }
    // JSON workflow fallbacks (non-empty placeholders so downloads work)
    if (typeof window.AOS.buildCheckAvailability !== 'function') {
      window.AOS.buildCheckAvailability = function(v){
        const tz = v.timezone || 'America/New_York';
        return {
          name: "checkAvailability",
          version: "fallback",
          settings: { timezone: tz },
          nodes: [{ name:"Webhook (check_availability)", type:"webhook" }],
          connections: {}
        };
      };
    }
    if (typeof window.AOS.buildBookAppointment !== 'function') {
      window.AOS.buildBookAppointment = function(v){
        const tz = v.timezone || 'America/New_York';
        return {
          name: "bookAppointment",
          version: "fallback",
          settings: { timezone: tz },
          nodes: [{ name:"Webhook (book_appointment)", type:"webhook" }],
          connections: {}
        };
      };
    }
  })();
  </script>

  <!-- ✅ Fail-safe binder for Preview & TTS -->
  <script>
  (function () {
    const $ = (id) => document.getElementById(id);

    function setDebug(msg){
      const d = $('debug'); if (d) d.textContent = msg || '';
      console.log('[AOS]', msg);
    }

    async function previewTTS(v) {
      const text = `Hey, this is ${v.agentName || 'Alex'} with ${v.bizName || 'your business'}. How can I help you today?`;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice_id: '21m00Tcm4TlvDq8ikWAM',
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.7 }
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      $('audio').src = url;
      $('audioWrap').classList.remove('hidden');
      $('audio').play().catch(()=>{});
      $('audioDownload').href = url;
    }

    function getValues(form) {
      const v = Object.fromEntries(new FormData(form).entries());
      try { v.timezone ||= Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
      v.agentName ||= "Alex";
      v.language  ||= "English";
      return v;
    }

    function enableDownloads(v, fullPrompt) {
      const success = (msg) => {
        const el = $('successMsg'); if (!el) return;
        el.textContent = msg || 'Downloaded ✅';
        el.classList.remove('hidden');
        clearTimeout(success._t);
        success._t = setTimeout(()=>el.classList.add('hidden'), 2500);
      };

      const setDL = (id, data, name, type) => {
        const btn = $(id); if (!btn) return;
        btn.onclick = () => {
          const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
          if (!text || text.length < 20 || text === "{}") {
            alert('Could not generate ' + name + '. Please click “Generate Preview” again.');
            return;
          }
          const url = URL.createObjectURL(new Blob([text], { type }));
          const a = Object.assign(document.createElement('a'), { href: url, download: name });
          a.click(); URL.revokeObjectURL(url);
          success(name + ' downloaded ✅');
        };
      };

      // full prompt .txt
      setDL('downloadPromptBtn', fullPrompt, `${(v.bizName||'AI_Receptionist')}_prompt.txt`, 'text/plain;charset=utf-8');
      // workflow jsons (built fresh at click time to avoid staleness)
      setDL('downloadAvailBtn', window.AOS.buildCheckAvailability(v), 'checkAvailability.json', 'application/json');
      setDL('downloadBookBtn',  window.AOS.buildBookAppointment(v),  'bookAppointment.json', 'application/json');
    }

    function ready() {
      return $('aiForm') && $('previewBtn') && $('ttsBtn') &&
             $('promptOut') && $('downloadPromptBtn') && $('downloadAvailBtn') && $('downloadBookBtn') &&
             window.AOS && typeof window.AOS.buildPrompt === 'function' && typeof window.AOS.truncate === 'function';
    }

    function bind(attempt=0) {
      if (!ready()) {
        if (attempt % 10 === 0) setDebug('Waiting for AOS/DOM…');
        if (attempt < 100) return setTimeout(()=>bind(attempt+1), 50); // retry up to ~5s
        setDebug('Init failed — reload the page.');
        return;
      }
      setDebug('');

      const form = $('aiForm');
      const previewBtn = $('previewBtn');
      const ttsBtn = $('ttsBtn');
      const spinner = $('previewSpinner');

      let lastFullPrompt = '';

      previewBtn.addEventListener('click', async () => {
        previewBtn.disabled = true;
        spinner?.classList.remove('hidden');
        const minWait = new Promise(r=>setTimeout(r,300));

        try {
          const v = getValues(form);
          lastFullPrompt = window.AOS.buildPrompt(v);
          $('promptOut').textContent = window.AOS.truncate(lastFullPrompt);

          // enable downloads + wire
          ['downloadPromptBtn','downloadAvailBtn','downloadBookBtn'].forEach(id => $(id).disabled = false);
          enableDownloads(v, lastFullPrompt);
          const n = $('notice'); if (n) n.textContent = 'Downloads ready. Import into n8n → connect Google Calendar Tool + OpenAI creds.';
        } catch (e) {
          console.error(e);
          alert('Failed to generate preview. See console for details.');
        } finally {
          await minWait;
          spinner?.classList.add('hidden');
          previewBtn.disabled = false;
        }
      });

      ttsBtn.addEventListener('click', async () => {
        try { await previewTTS(getValues(form)); }
        catch(e){ console.error(e); alert('TTS error. Check /api/tts logs and key.'); }
      });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') bind();
    else document.addEventListener('DOMContentLoaded', bind);
  })();
  </script>
</body>
</html>
