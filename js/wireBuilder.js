// js/wireBuilder.js
(function () {
  const $ = (id) => document.getElementById(id);

  // keep the latest values + full prompt in memory
  let lastValues = null;
  let lastFullPrompt = "";

  function getValues(form) {
    const v = Object.fromEntries(new FormData(form).entries());
    if (!v.timezone) {
      try { v.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
    }
    if (!v.agentName) v.agentName = "Alex";
    if (!v.language) v.language = "English";
    return v;
  }

  function showSuccess(text) {
    const el = $('successMsg');
    if (!el) return;
    el.textContent = text || 'Downloaded ✅';
    el.classList.remove('hidden');
    clearTimeout(showSuccess._t);
    showSuccess._t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  function enableDownloads(v, fullPrompt) {
    // Full Prompt (.txt)
    $('downloadPromptBtn').onclick = () => {
      if (!fullPrompt || fullPrompt.length < 20) {
        alert('Could not generate prompt. Please click “Generate Preview” again.');
        return;
      }
      const blob = new Blob([fullPrompt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url, download: `${(v.bizName || 'AI_Receptionist')}_prompt.txt`
      });
      a.click(); URL.revokeObjectURL(url);
      setTimeout(() => showSuccess('Prompt downloaded ✅'), 0);
    };

    // checkAvailability.json
    $('downloadAvailBtn').onclick = () => {
      const json = (window.AOS && window.AOS.buildCheckAvailability)
        ? window.AOS.buildCheckAvailability(v)
        : {};
      const text = JSON.stringify(json, null, 2);
      if (!text || text.length < 20 || text === "{}") {
        alert('Could not generate checkAvailability.json. Please click “Generate Preview” again.');
        return;
      }
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = Object.assign(document.createElement('a'), {
        href: url, download: "checkAvailability.json"
      });
      a.click(); URL.revokeObjectURL(url);
      setTimeout(() => showSuccess('checkAvailability.json downloaded ✅'), 0);
    };

    // bookAppointment.json
    $('downloadBookBtn').onclick = () => {
      const json = (window.AOS && window.AOS.buildBookAppointment)
        ? window.AOS.buildBookAppointment(v)
        : {};
      const text = JSON.stringify(json, null, 2);
      if (!text || text.length < 20 || text === "{}") {
        alert('Could not generate bookAppointment.json. Please click “Generate Preview” again.');
        return;
      }
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = Object.assign(document.createElement('a'), {
        href: url, download: "bookAppointment.json"
      });
      a.click(); URL.revokeObjectURL(url);
      setTimeout(() => showSuccess('bookAppointment.json downloaded ✅'), 0);
    };
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
    if (!res.ok) {
      alert('TTS error: ' + (await res.text()).slice(0, 200));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    $('audio').src = url;
    $('audioWrap').classList.remove('hidden');
    $('audio').play().catch(()=>{});
    $('audioDownload').href = url;
  }

  // Wait until BOTH DOM elements and AOS builders exist
  function readyChecksOk() {
    return (
      $('aiForm') && $('previewBtn') && $('ttsBtn') &&
      $('promptOut') && $('downloadPromptBtn') && $('downloadAvailBtn') && $('downloadBookBtn') &&
      window.AOS && typeof window.AOS.buildPrompt === 'function'
    );
  }

  function wire(attempt = 0) {
    if (!readyChecksOk()) {
      if (attempt < 100) return setTimeout(() => wire(attempt + 1), 50); // retry up to ~5s
      // hard stop fallback
      console.warn('AOS or DOM not ready — wiring aborted.');
      return;
    }

    const form = $('aiForm');
    const previewBtn = $('previewBtn');
    const ttsBtn = $('ttsBtn');
    const spinner = $('previewSpinner');

    // prevent double-binding
    previewBtn.replaceWith(previewBtn.cloneNode(true));
    ttsBtn.replaceWith(ttsBtn.cloneNode(true));

    const previewBtnFresh = $('previewBtn');
    const ttsBtnFresh = $('ttsBtn');

    // Generate Preview (with spinner + store full prompt)
    previewBtnFresh.addEventListener('click', async () => {
      previewBtnFresh.disabled = true;
      spinner?.classList.remove('hidden');

      const minWait = new Promise(res => setTimeout(res, 300)); // ensure spinner visible
      try {
        lastValues = getValues(form);
        lastFullPrompt = window.AOS.buildPrompt(lastValues);        // full text
        $('promptOut').textContent = window.AOS.truncate(lastFullPrompt); // preview only

        // enable download buttons and wire them
        ['downloadPromptBtn','downloadAvailBtn','downloadBookBtn'].forEach(id => $(id).disabled = false);
        enableDownloads(lastValues, lastFullPrompt);
        if ($('notice')) $('notice').textContent = "Downloads ready. Import into n8n → connect Google Calendar Tool + OpenAI creds.";
      } finally {
        await minWait;
        spinner?.classList.add('hidden');
        previewBtnFresh.disabled = false;
      }
    });

    // Hear AI Greeting (TTS)
    ttsBtnFresh.addEventListener('click', async () => {
      const v = getValues(form);
      await previewTTS(v);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wire());
  } else {
    wire();
  }
})();
