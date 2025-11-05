// api/diag.js
module.exports = async (req, res) => {
  const has = Boolean(process.env.ELEVENLABS_API_KEY);
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    ok: true,
    has_ELEVENLABS_API_KEY: has,
    node: process.version,
    cwd: process.cwd()
  }));
};
