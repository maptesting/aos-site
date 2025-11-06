// js/wireBuilder.js
(function () {
  const $ = (id) => document.getElementById(id);

  function getValues(form) {
    const v = Object.fromEntries(new FormData(form).entries());
    if (!v.timezone) {
      try { v.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
    }
    if (!v.agentName) v.agentName = "Alex";
    if (!v.language) v.language = "English";
    return v;
  }

  function enableDownloads(v, prompt) {
    const availJSON = window.AOS.buildCheckAvailability(v);
    const bookJSON  = window.AOS.buildBookAppointment(v);

    $('downloadPromptBtn').onclick = () => {
      const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${(v.bizName||'AI_Receptionist')}_prompt.txt` });
      a.click(); URL.revokeObjectURL(url);
    };

    $('downloadAvailBtn').onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(availJSON, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement('a'), { href: url, download: "checkAvailability.json" });
      a.click(); URL.revokeObjectURL(url);
    };

    $('downloadBookBtn').onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(bookJSON, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement('a'), { href: url, download: "bookAppointment.json" });
      a.click(); URL.revokeObjectURL(url);
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
    if (!window.AOS) return; // builders.js must be loaded

    const form = $('aiForm');
    const previewBtn = $('previewBtn');
    const ttsBtn = $('ttsBtn');

    previewBtn.addEventListener('click', () => {
      const v = getValues(form);
      const prompt = window.AOS.buildPrompt(v);
      $('promptOut').textContent = window.AOS.truncate(prompt);

      // enable buttons
      ['downloadPromptBtn','downloadAvailBtn','downloadBookBtn'].forEach(id => $(id).disabled = false);
      enableDownloads(v, prompt);
      $('notice').textContent = "Downloads ready. Import into n8n → connect Google Calendar Tool + OpenAI creds.";
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
