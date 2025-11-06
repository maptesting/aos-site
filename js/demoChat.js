// js/demoChat.js
(function () {
  // Run after DOM is ready even if script isn't at the very end
  const start = () => {
    const chatBox   = document.getElementById('chatBox');
    const chatForm  = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatSend  = document.getElementById('chatSend');
    if (!chatBox || !chatForm || !chatInput || !chatSend) return;

    const history = [
      { role: 'assistant', content: 'Hi! This is Ava from BrightSmile Dental — how can I help you today?' }
    ];

    const bubble = (text, fromAI=false) => {
      const div = document.createElement('div');
      div.className = 'flex gap-3 items-start';
      div.innerHTML = fromAI
        ? `<div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div><div data-msg>${text}</div>`
        : `<div class="w-8 h-8 rounded-full bg-white/10 grid place-items-center">👤</div><div data-msg>${text}</div>`;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
      return div;
    };

    const typing = () => {
      const div = document.createElement('div');
      div.className = 'flex gap-3 items-start opacity-80';
      div.innerHTML = `<div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div>
                       <div data-msg>Ava is typing…</div>`;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
      return div;
    };

    const send = async (e) => {
      if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
      const msg = chatInput.value.trim();
      if (!msg) return;

      bubble(msg, false);
      chatInput.value = '';
      history.push({ role: 'user', content: msg });

      const t = typing();
      try {
        const res = await fetch('/api/demoChat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history })
        });
        if (!res.ok) throw new Error(await res.text());
        const { reply } = await res.json();
        t.querySelector('[data-msg]').textContent = reply;
        t.classList.remove('opacity-80');
        history.push({ role: 'assistant', content: reply });
      } catch (err) {
        console.error(err);
        t.querySelector('[data-msg]').textContent = 'Sorry — I had trouble responding. Please try again.';
      } finally {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    };

    // Guard against page reloads in all cases
    chatForm.addEventListener('submit', send);
    chatSend.addEventListener('click', send);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
