// public/js/wire.js
import { AOS as CORE } from './aos-core.js';

const $ = (id) => document.getElementById(id);

function getValues(form) {
  const v = Object.fromEntries(new FormData(form).entries());
  try { v.timezone ||= Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  v.agentName ||= "Alex";
  v.language  ||= "English";
  return v;
}

async function previewTTS(v) {
  const text = `Hey, this is ${v.agentName || 'Alex'} with ${v.bizName || 'your business'}. How can I help you today?`;
  const res
