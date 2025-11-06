// /js/builders.js
// AOS builders: preload templates, inject values, and return intact graphs

(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = {
    ready: false,
    tpl: { checkAvailability: null, bookAppointment: null },
  };

  // ---------- utils ----------
  const log = (...a) => console.log("[AOS-builders]", ...a);
  const warn = (...a) => console.warn("[AOS-builders]", ...a);
  const err = (...a) => console.error("[AOS-builders]", ...a);
  const deepClone = (obj) => JSON.parse(JSON.stringify(obj || {}));
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  function deepReplaceStrings(node, replacer) {
    if (node == null) return node;
    if (typeof node === "string") return replacer(node);
    if (Array.isArray(node)) return node.map((v) => deepReplaceStrings(v, replacer));
    if (typeof node === "object") {
      const out = {};
      for (const k of Object.keys(node)) out[k] = deepReplaceStrings(node[k], replacer);
      return out;
    }
    return node;
  }

  function injectKnownNodeParams(graph, map) {
    const g = deepClone(graph);
    try {
      const nodes = Array.isArray(g.nodes) ? g.nodes : g.workflow?.nodes || g.workflow?.data?.nodes || [];
      for (const n of nodes) {
        const p = n.parameters || n.settings || n.config || null;
        if (!p || typeof p !== "object") continue;
        if ("path" in p && typeof p.path === "string" && p.path) p.path = map.WEBHOOK_PATH;
        if ("timezone" in p && typeof p.timezone === "string") p.timezone = map.TIMEZONE;
        if ("calendarId" in p && typeof p.calendarId === "string") p.calendarId = map.CALENDAR_ID;
        if ("email" in p && typeof p.email === "string") p.email = map.EMAIL;

        const promptKeys = ["systemMessage", "systemPrompt", "system", "prompt", "instruction"];
        for (const key of promptKeys) {
          if (key in p && typeof p[key] === "string") p[key] = map.SYSTEM_PROMPT;
        }
      }
    } catch (e) {
      warn("injectKnownNodeParams non-fatal:", e);
    }

    // Global sweep for placeholders
    return deepReplaceStrings(g, (s) =>
      s
        .replace(/\{\{\s*WEBHOOK_PATH\s*\}\}/g, map.WEBHOOK_PATH)
        .replace(/\{\{\s*TIMEZONE\s*\}\}/g, map.TIMEZONE)
        .replace(/\{\{\s*CALENDAR_ID\s*\}\}/g, map.CALENDAR_ID)
        .replace(/\{\{\s*EMAIL\s*\}\}/g, map.EMAIL)
        .replace(/\{\{\s*SYSTEM_PROMPT\s*\}\}/g, map.SYSTEM_PROMPT)
    );
  }

  function buildLongPrompt(v) {
    const tz = v.timezone || "America/New_York";
    const now = new Date().toLocaleString("en-US", {
      timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });

    return [
      `You are ${v.agentName || "Alex"}, a friendly, fast, and professional AI receptionist for ${v.bizName || "the business"}.`,
      `Current time: ${now} (${tz}).`,
      ``,
      `Goals:`,
      `1) Greet naturally. 2) Identify the service needed. 3) Collect full name, phone, and email. 4) Offer times within business hours. 5) Confirm and summarize.`,
      ``,
      `Business Context:`,
      `- Business: ${v.bizName || "N/A"}`,
      `- Location: ${v.location || "N/A"}`,
      `- Industry: ${v.industry || "N/A"}`,
      `- Services: ${v.services || "N/A"}`,
      `- Hours: ${v.hours || "N/A"}`,
      `- Policies: ${v.policies || "None provided"}`,
      ``,
      `Persona & Style:`,
      `- Warm, concise, human. Uses contractions. 1–2 sentences per reply.`,
      `- Proactive and respectful. Avoid jargon. Confirm details clearly.`,
      ``,
      `Calendar & Email:`,
      `- Use Google Calendar to offer/book. Timezone: ${tz}.`,
      `- Send confirmations from ${v.email || "no-reply@example.com"} if configured.`,
      ``,
      `Rules:`,
      `- Never invent times outside business hours. If unclear, ask for the customer's availability.`,
      `- Always confirm final date/time and contact info before closing.`,
      `- If non-service inquiry, capture contact and route to email.`,
    ].join("\n");
  }

  async function loadJSONWithFallback(possibleUrls) {
    const tried = [];
    for (const raw of possibleUrls) {
      const url = raw + (raw.includes("?") ? "&" : "?") + "_ts=" + Date.now();
      try {
        const res = await fetch(url, { cache: "no-cache" });
        tried.push({ url, status: res.status });
        if (res.ok) return res.json();
      } catch {
        tried.push({ url, status: "NETWORK_ERR" });
      }
    }
    const detail = { message: "All template paths failed", tried };
    window.dispatchEvent(new CustomEvent("AOS:loadError", { detail }));
    throw new Error(detail.message + " " + JSON.stringify(tried));
  }

  AOS.init = async function init() {
    if (state.ready) return true;

    const availPaths = [
      "/templates/checkAvailability.json",
      "./templates/checkAvailability.json",
      "/public/templates/checkAvailability.json"
    ];
    const bookPaths = [
      "/templates/bookAppointment.json",
      "./templates/bookAppointment.json",
      "/public/templates/bookAppointment.json"
    ];

    let avail = null, book = null;
    try { avail = await loadJSONWithFallback(availPaths); } catch (e) { warn(e); }
    try { book  = await loadJSONWithFallback(bookPaths); } catch (e) { warn(e); }

    if (!avail || !book) {
      // optional inline fallback
      if (window.AOS_EMBED) {
        avail ||= window.AOS_EMBED.checkAvailability || null;
        book  ||= window.AOS_EMBED.bookAppointment  || null;
      }
    }

    if (!avail || !book) {
      const detail = {
        message: "Templates missing. Ensure they exist and are publicly served.",
        missing: { checkAvailability: !avail, bookAppointment: !book },
        hint: "On Vercel/Next, put files in /public/templates and fetch /templates/filename.json"
      };
      window.dispatchEvent(new CustomEvent("AOS:loadError", { detail }));
      throw new Error(detail.message);
    }

    state.tpl.checkAvailability = avail;
    state.tpl.bookAppointment = book;
    state.ready = true;
    log("Templates loaded.");
    return true;
  };

  AOS.buildPrompt = function buildPrompt(values) {
    if (!state.ready) warn("buildPrompt called before templates ready (ok for prompt).");
    return buildLongPrompt(values || {});
  };

  AOS.buildCheckAvailability = async function buildCheckAvailability(values) {
    if (!state.ready) await AOS.init();
    const tpl = state.tpl.checkAvailability;
    if (!tpl || typeof tpl !== "object") throw new Error("checkAvailability template missing.");
    const v = values || {};
    const map = {
      WEBHOOK_PATH: `/webhook/${slug(v.bizName || "business")}/check-availability`,
      TIMEZONE: v.timezone || "America/New_York",
      CALENDAR_ID: v.calendarId || "primary",
      EMAIL: v.email || "",
      SYSTEM_PROMPT: buildLongPrompt(v)
    };
    return injectKnownNodeParams(tpl, map);
  };

  AOS.buildBookAppointment = async function buildBookAppointment(values) {
    if (!state.ready) await AOS.init();
    const tpl = state.tpl.bookAppointment;
    if (!tpl || typeof tpl !== "object") throw new Error("bookAppointment template missing.");
    const v = values || {};
    const map = {
      WEBHOOK_PATH: `/webhook/${slug(v.bizName || "business")}/book-appointment`,
      TIMEZONE: v.timezone || "America/New_York",
      CALENDAR_ID: v.calendarId || "primary",
      EMAIL: v.email || "",
      SYSTEM_PROMPT: buildLongPrompt(v)
    };
    return injectKnownNodeParams(tpl, map);
  };

  AOS.truncate = function truncate(s, n = 1200) {
    return s && s.length > n ? s.slice(0, n) + " …" : s || "";
  };

  // Preload
  AOS.init().catch((e) => err("Template preload failed:", e));
})();
