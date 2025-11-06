// /api/demoChat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { messages = [], biz = {} } = await req.json?.() || req.body || {};

    const sys = [
      `You are Ava, a friendly, professional front-desk receptionist at BrightSmile Dental Clinic.`,
      `Location: 215 Maple Ave, Midtown. Hours: Mon–Sat 9am–6pm.`,
      `Services: cleaning, whitening, exam & x-rays, fillings, crowns, emergency visits.`,
      `Pricing (ballpark): cleaning $99, whitening add-on $149, exam+xray $129.`,
      `Style: short, natural (1–2 sentences), helpful, never robotic.`,
      `If asked to book, collect: full name, phone, email, preferred time. Offer 2–3 options if needed.`,
      `Avoid medical advice; suggest seeing the dentist for diagnosis.`,
      biz?.note ? `Special note: ${biz.note}` : ``,
    ].filter(Boolean).join('\n');

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0.6,
      messages: [
        { role: 'system', content: sys },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(()=> '');
      return res.status(resp.status).send(txt || 'OpenAI error');
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Sorry, I had trouble responding.';
    res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
}
