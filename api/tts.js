// /api/tts.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { text, voice_id, model_id = 'eleven_multilingual_v2', voice_settings } = req.body || {};
    if (!text) return res.status(400).send('Missing text');
    const voiceId = voice_id || 'uju3wxzG5OhpWcoi3SMy'; // default
    const xiKey = process.env.sk_91a69a3752a0ad4a80bacce3e9f38137cf85f555f9b4b912;
    if (!xiKey) return res.status(500).send('Server missing ELEVENLABS_API_KEY');

    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': xiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        model_id,
        text,
        voice_settings: {
          stability: voice_settings?.stability ?? 0.5,
          similarity_boost: voice_settings?.similarity_boost ?? 0.7
        }
      })
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(()=>'');
      return res.status(resp.status).send(errTxt || 'TTS failed');
    }

    // Stream back the MP3 to the browser
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    const arrayBuf = await resp.arrayBuffer();
    res.send(Buffer.from(arrayBuf));
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
}
