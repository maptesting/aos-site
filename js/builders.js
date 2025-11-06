(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = { ready: false, tpl: {} };

  const log = (...a) => console.log('[AOS-builders]', ...a);
  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  async function loadJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }

  AOS.init = async function init() {
    if (state.ready) return;
    const [avail, book] = await Promise.all([
      loadJSON('/templates/checkAvailability.json'),
      loadJSON('/templates/bookAppointment.json')
    ]);
    state.tpl.checkAvailability = avail;
    state.tpl.bookAppointment = book;
    state.ready = true;
    log('✅ Templates loaded');
  };

  function buildPrompt(v) {
    const tz = v.timezone || 'America/New_York';
    const now = new Date().toLocaleString('en-US', {
      timeZone: tz, weekday: 'long', year: 'numeric', month: 'long',
      day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    return [
      `You are ${v.agentName || 'Alex'}, an AI receptionist for ${v.bizName || 'the business'}.`,
      `Current time: ${now} (${tz}).`,
      `Collect name, contact info, and appointment time, then confirm booking.`,
    ].join('\n');
  }

  function inject(graph, v, kind) {
    const g = deepClone(graph);
    const map = {
      WEBHOOK_PATH: kind === 'avail'
        ? `/webhook/${slug(v.bizName || 'business')}/check-availability`
        : `/webhook/${slug(v.bizName || 'business')}/book-appointment`,
      CALENDAR_ID: v.calendarId || 'primary',
      TIMEZONE: v.timezone || 'America/New_York',
      EMAIL: v.email || '',
      SYSTEM_PROMPT: buildPrompt(v),
    };
    // Replace placeholders in string fields
    const replace = (x) =>
      typeof x === 'string'
        ? x
            .replace(/\{\{WEBHOOK_PATH\}\}/g, map.WEBHOOK_PATH)
            .replace(/\{\{TIMEZONE\}\}/g, map.TIMEZONE)
            .replace(/\{\{CALENDAR_ID\}\}/g, map.CALENDAR_ID)
            .replace(/\{\{EMAIL\}\}/g, map.EMAIL)
            .replace(/\{\{SYSTEM_PROMPT\}\}/g, map.SYSTEM_PROMPT)
        : x;
    return JSON.parse(JSON.stringify(g), (_, val) => replace(val));
  }

  AOS.buildPrompt = (v) => buildPrompt(v);
  AOS.buildCheckAvailability = async (v) => {
    if (!state.ready) await AOS.init();
    return inject(state.tpl.checkAvailability, v, 'avail');
  };
  AOS.buildBookAppointment = async (v) => {
    if (!state.ready) await AOS.init();
    return inject(state.tpl.bookAppointment, v, 'book');
  };

  // preload
  AOS.init().catch(console.error);
})();
