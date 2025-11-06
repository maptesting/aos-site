// js/demoChat.js
(function () {
  const chatBox  = document.getElementById('chatBox');
  const chatForm = document.getElementById('chatForm');
  const chatInput= document.getElementById('chatInput');

  const history = [
    { role: 'assistant', content: 'Hi! This is Ava from BrightSmile Dental — how can I help you today?' }
  ];

  function bubble(text, fromAI=false, replaceLast=false) {
    if (replaceLast) {
      const last = chatBox.lastElementChild;
      if (last) last.querySelector('[data-msg]').textContent = text;
      chatBox.scrollTop = chatBox.scrollHeight;
      return;
    }
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-start';
    div.innerHTML = fromAI
      ? `<div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div><div data-msg>${text}</div>`
      : `<div class="w-8 h-8 rounded-full bg-white/10 grid place-items-center">👤</div><div data-msg>${text}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function typingBubble() {
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-start opacity-80';
    div.innerHTML = `<div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div>
                     <div data-msg>Ava is typing…</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;

    // show user bubble
    bubble(msg, false);
    chatInput.value = '';

    // update history & show typing
    history.push({ role: 'user', content: msg });
    const typing = typingBubble();

    try {
      const res = await fetch('/api/demoChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      if (!res.ok) throw new Error(await res.text());
      const { reply } = await res.json();

      // replace typing with reply
      typing.querySelector('[data-msg]').textContent = reply;
      typing.classList.remove('opacity-80');
      history.push({ role: 'assistant', content: reply });
    } catch (err) {
      typing.querySelector('[data-msg]').textContent = 'Sorry — I had trouble responding. Please try again.';
      console.error(err);
    } finally {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  });
})();
