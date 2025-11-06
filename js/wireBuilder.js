// js/wireBuilder.js
(function () {
  const $ = (id) => document.getElementById(id);

  // keep the latest values + prompt in memory (so we never read from preview DOM)
  let lastValues = null;
  let lastFullPrompt = "";

  function getValues(form) {
    const v = Object.fromEntries(new FormData(form).entries());
    if (!v.timezone) { try { v.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {} }
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
    showSuccess._t = setTimeout(()=> el.classList.add('hidden'), 2500);
  }

  function enableDownloads(v, fullPrompt) {
    // always use the full prompt kept in memory
    $('downloadPromptBtn').onclick = () => {
      const blob = new Blob([fullPrompt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `${(v.bizName||'AI_Receptionist')}_prompt.txt`
      });
      a.click();
      URL.revokeObjectURL(url);
      // show toast
      setTimeout(() => showSuccess('Prompt downloaded ✅'), 0);
    };

    $('downloadAvailBtn').onclick = () => {
      const json = window.AOS.buildCheckAvailability(v);
      const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement('a'), { href: url, download: "checkAvailability.json" });
      a.click();
      URL.revokeObjectURL(url);
      setTimeout(() => showSuccess('checkAvailability.json downloaded ✅'), 0);
    };

    $('downloadBookBtn').onclick = () => {
      const json = window.AOS.buildBookAppointment(v);
      const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement('a'), { href: url, download: "bookAppointment.json" });
      a.click();
      URL.revokeObjectURL(url);
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

  function wire() {
    if (!window.AOS) return;

    const form = $('aiForm');
    const previewBtn = $('previewBtn');
    const ttsBtn = $('ttsBtn');
    const spinner = $('previewSpinner');

    previewBtn.addEventListener('click', async () => {
      // show spinner, and keep it visible at least 400ms
      previewBtn.disabled = true;
      spinner?.classList.remove('hidden');
      const minWait = new Promise(res => setTimeout(res, 400));

      try {
        // compute full prompt (not truncated)
        lastValues = getValues(form);
        lastFullPrompt = window.AOS.buildPrompt(lastValues);

        // preview shows truncated version only
        $('promptOut').textContent = window.AOS.truncate(lastFullPrompt);

        // enable download buttons
        ['downloadPromptBtn','downloadAvailBtn','downloadBookBtn'].forEach(id => $(id).disabled = false);
        enableDownloads(lastValues, lastFullPrompt);
        $('notice').textContent = "Downloads ready. Import into n8n → connect Google Calendar Tool + OpenAI creds.";
      } finally {
        await minWait; // ensure spinner is perceivable
        spinner?.classList.add('hidden');
        previewBtn.disabled = false;
      }
    });

    ttsBtn.addEventListener('click', async () => {
      const v = getValues(form);
      await previewTTS(v);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
