// /js/builders.js
// AOS builders: preload templates, inject values, and return intact graphs

(function () {
  const AOS = (window.AOS = window.AOS || {});
  const state = {
    ready: false,
    tpl: {
      checkAvailability: null,
      bookAppointment: null,
    },
  };

  // ---------- utils ----------
  const log = (...a) => console.log("[AOS-builders]", ...a);
  const warn = (...a) => console.warn("[AOS-builders]", ...a);
  const err = (...a) => console.error("[AOS-builders]", ...a);

  const deepClone = (obj) => JSON.parse(JSON.stringify(obj || {}));

  const slug = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // Replace strings anywhere in the graph that match our placeholders
  function deepReplaceStrings(node, replacer) {
    if (node == null) return node;
    if (typeof node === "string") {
      return replacer(node);
    }
    if (Array.isArray(node)) {
      return node.map((v) => deepReplaceStrings(v, replacer));
    }
    if (typeof node === "object") {
      const out = {};
      for (const k of Object.keys(node)) {
        out[k] = deepReplaceStrings(node[k], replacer);
      }
      return out;
    }
    return node;
  }

  // Try to smart-inject into common n8n fields too (parameters.path, parameters.timezone, etc.)
  function injectKnownNodeParams(graph, map) {
    // best-effort; keeps ports/links untouched
    const g = deepClone(graph);

    try {
      const nodes = Array.isArray(g.nodes) ? g.nodes : g.workflow?.nodes || g.workflow?.data?.nodes || [];
      for (const n of nodes) {
        const p = n.parameters || n.settings || n.config || null;
        if (!p || typeof p !== "object") continue;

        // Webhook path
        if ("path" in p && typeof p.path === "string" && p.path.trim() !== "") {
          if (p.path.includes("{{") || p.path.includes("WEBHOOK")) {
            p.path = map.WEBHOOK_PATH;
          }
        }

        // Timezone
        if ("timezone" in p && typeof p.timezone === "string") {
          p.timezone = map.TIMEZONE;
        }

        // Calendar ID
        if ("calendarId" in p && typeof p.calendarId === "string") {
          p.calendarId = map.CALENDAR_ID;
        }

        // Email
        if ("email" in p && typeof p.email === "string") {
          p.email = map.EMAIL;
        }

        // System prompt (various nodes: LLM, Agent, etc.)
        const promptKeys = ["systemPrompt", "system", "prompt", "instruction"];
        for (const key of promptKeys) {
          if (key in p && typeof p[key] === "string" && p[key].length < 1000) {
            // Only overwrite if it looks like a placeholder / short default
            p[key] = map.SYSTEM_PROMPT;
          }
        }
      }
    } catch (e) {
      warn("injectKnownNodeParams non-fatal:", e);
    }

    // Also do a global string replace sweep for explicit placeholders
    const replaced = deepReplaceStrings(g, (s) =>
      s
        .replace(/\{\{\s*WEBHOOK_PATH\s*\}\}/g, map.WEBHOOK_PATH)
        .replace(/\{\{\s*TIMEZONE\s*\}\}/g, map.TIMEZONE)
        .replace(/\{\{\s*CALENDAR_ID\s*\}\}/g, map.CALENDAR_ID)
        .replace(/\{\{\s*EMAIL\s*\}\}/g, map.EMAIL)
        .replace(/\{\{\s*SYSTEM_PROMPT\s*\}\}/g, map.SYSTEM_PROMPT)
    );

    return replaced;
  }

  // ---------- LONG prompt builder ----------
  function buildLongPrompt(v) {
    const now = new Date().toLocaleString("en-US", {
      timeZone: v.timezone || "America/New_York",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    return [
      `You are ${v.agentName || "Alex"}, a friendly, fast, and professional AI receptionist for ${v.bizName || "the business"}.`,
      `Current time: ${now} (${v.timezone || "America/New_York"}).`,
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
      `- Warm, concise, human. Uses contractions. 1–2 sentences per reply. No walls of text.`,
      `- Proactive and respectful. Avoid jargon. Confirm details clearly.`,
      ``,
      `Calendar & Email:`,
      `- Use Google Calendar to offer/book. Timezone: ${v.timezone || "America/New_York"}.`,
      `- Send confirmations from ${v.email || "no-reply@example.com"} if configured.`,
      ``,
      `Rules:`,
      `- Never invent times outside business hours. If unclear, ask for the customer's availability.`,
      `- Always confirm final date/time and contact info before closing.`,
      `- If non-service inquiry, capture contact and route to email.`,
    ].join("\n");
  }

  // ---------- public API ----------
  AOS.init = async function init() {
    if (state.ready) return true;

    async function loadJSON(path) {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
      return res.json();
    }

    // Load both templates in parallel
    const [avail, book] = await Promise.all([
      loadJSON("/templates/checkAvailability.json"),
      loadJSON("/templates/bookAppointment.json"),
    ]);

    state.tpl.checkAvailability = avail;
    state.tpl.bookAppointment = book;
    state.ready = true;
    log("Templates preloaded.");
    return true;
  };

  // Build full LONG prompt (string)
  AOS.buildPrompt = function buildPrompt(values) {
    if (!state.ready) warn("buildPrompt called before templates ready (ok, prompt doesn't need them).");
    return buildLongPrompt(values || {});
  };

  // n8n graph: checkAvailability
  AOS.buildCheckAvailability = async function buildCheckAvailability(values) {
    if (!state.ready) await AOS.init();

    const tpl = state.tpl.checkAvailability;
    if (!tpl || typeof tpl !== "object") {
      throw new Error("checkAvailability template missing. Ensure /templates/checkAvailability.json exists and is valid JSON.");
    }

    const v = values || {};
    const map = {
      WEBHOOK_PATH: `/webhook/${slug(v.bizName || "business")}/check-availability`,
      TIMEZONE: v.timezone || "America/New_York",
      CALENDAR_ID: v.calendarId || "primary",
      EMAIL: v.email || "",
      SYSTEM_PROMPT: buildLongPrompt(v),
    };

    // Replace only values; keep graph/node connections untouched
    const graph = injectKnownNodeParams(tpl, map);
    return graph;
  };

  // n8n graph: bookAppointment
  AOS.buildBookAppointment = async function buildBookAppointment(values) {
    if (!state.ready) await AOS.init();

    const tpl = state.tpl.bookAppointment;
    if (!tpl || typeof tpl !== "object") {
      throw new Error("bookAppointment template missing. Ensure /templates/bookAppointment.json exists and is valid JSON.");
    }

    const v = values || {};
    const map = {
      WEBHOOK_PATH: `/webhook/${slug(v.bizName || "business")}/book-appointment`,
      TIMEZONE: v.timezone || "America/New_York",
      CALENDAR_ID: v.calendarId || "primary",
      EMAIL: v.email || "",
      SYSTEM_PROMPT: buildLongPrompt(v),
    };

    const graph = injectKnownNodeParams(tpl, map);
    return graph;
  };

  // Optional helper used by your old page (safe to keep)
  AOS.truncate = function truncate(s, n = 1200) {
    return s && s.length > n ? s.slice(0, n) + " …" : s || "";
  };

  // Preload immediately (so downloads work right after first Preview)
  AOS.init().catch((e) => err("Template preload failed:", e));
})();
