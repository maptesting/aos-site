// js/demoChat.js
(function(){
  const chatBox = document.getElementById('chatBox');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  // simple local AI demo (mock replies)
  const replies = [
    { q: /price|cost|clean/i, a: "A standard cleaning is $99, or $149 with whitening. Would you like to book one?" },
    { q: /open|hour/i, a: "We're open Mon–Sat, 9am to 6pm. What time works best for you?" },
    { q: /book|appointment/i, a: "Sure thing! Can I get your full name and a phone number to confirm?" },
    { q: /insurance/i, a: "We accept most PPO dental plans including Delta, MetLife, and Aetna." },
    { q: /.*/, a: "Absolutely — I can help with that. Could you tell me a bit more?" }
  ];

  function appendMessage(text, fromAI=false) {
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-start';
    div.innerHTML = fromAI
      ? `<div class="w-8 h-8 rounded-full bg-brand-500 grid place-items-center">🤖</div><div>${text}</div>`
      : `<div class="w-8 h-8 rounded-full bg-white/10 grid place-items-center">👤</div><div>${text}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  chatForm.addEventListener('submit', e=>{
    e.preventDefault();
    const msg = chatInput.value.trim();
    if(!msg) return;
    appendMessage(msg, false);
    chatInput.value = '';
    setTimeout(()=>{
      const match = replies.find(r=>r.q.test(msg));
      appendMessage(match?.a || "I'm not sure I caught that — could you rephrase?", true);
    }, 600 + Math.random()*400);
  });
})();
