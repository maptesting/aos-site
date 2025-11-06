// js/demoChat.js
(function () {
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

    const typingBubble = () => {
      const div = document.createElement('div');
      div.className = 'flex gap-3 items-start opacity-80';
      div.innerHTML = `<div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div>
                       <div data-msg>Ava is typing</div>`;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;

      // animate dots …
      const label = div.querySelector('[data-msg]');
      let dots = 0;
      const iv = setInterval(() => {
        dots = (dots + 1) % 4;
        label.textContent = 'Ava is typing' + '.'.repeat(dots);
      }, 350);

      return {
        el: div,
        set(text){ label.textContent = text; div.classList.remove('opacity-80'); },
        stop(){ clearInterval(iv); }
      };
    };

    const send = async (e) => {
      e?.preventDefault?.(); e?.stopPropagation?.();
      const msg = chatInput.value.trim();
      if (!msg) return;

      bubble(msg, false);
      chatInput.value = '';
      history.push({ role: 'user', content: msg });

      const t = typingBubble();
      try {
        const res = await fetch('/api/demoChat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history })
        });
        if (!res.ok) throw new Error(await res.text());
        const { reply } = await res.json();
        t.stop();
        t.set(reply);
        history.push({ role: 'assistant', content: reply });
      } catch (err) {
        console.error(err);
        t.stop();
        t.set('Sorry — I had trouble responding. Please try again.');
      } finally {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    };

    chatForm.addEventListener('submit', send);
    chatSend.addEventListener('click', send);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
