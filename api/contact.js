// Mainstreet Advisory — "Tell us about your deal" form handler (Vercel serverless, Resend)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const dealSize = body['deal-size'] || body.dealSize || 'Not specified';
  const service = body.service || 'Not specified';
  const message = (body.message || '').trim();
  if (!name || !email) return res.status(400).json({ error: 'Missing required fields' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const send = (payload) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  try {
    const notifyRes = await send({
      from: 'Mainstreet Advisory <matt@calnan.co>',
      to: ['matt@calnan.co'],
      reply_to: email,
      subject: 'Contact Form — mainstreetfirm.com: ' + name + ' (' + dealSize + ')',
      html: '<h2>New deal inquiry — Mainstreet Advisory</h2>'
        + '<p><strong>Name:</strong> ' + esc(name) + '</p>'
        + '<p><strong>Email:</strong> ' + esc(email) + '</p>'
        + '<p><strong>Deal size:</strong> ' + esc(dealSize) + '</p>'
        + '<p><strong>Service:</strong> ' + esc(service) + '</p>'
        + '<p><strong>Message:</strong><br>' + esc(message).replace(/\n/g, '<br>') + '</p>'
    });
    if (!notifyRes.ok) {
      const detail = await notifyRes.text();
      console.error('Resend notify failed:', notifyRes.status, detail);
      return res.status(500).json({ error: 'Email send failed' });
    }
    await send({
      from: 'Matt Calnan, CPA <matt@calnan.co>',
      to: [email],
      subject: 'Thanks for reaching out — Mainstreet Advisory',
      html: '<p>Hi ' + esc(name) + ',</p>'
        + '<p>Thanks for telling us about your deal. I have your details and will follow up within one business day with next steps and a scope for the financial due diligence you need.</p>'
        + '<p>If it is time-sensitive, reply to this email or book a call directly: <a href="https://calendly.com/mattcalnan">calendly.com/mattcalnan</a>.</p>'
        + '<p>Best,<br>Matt Calnan, CPA, CMA<br>Mainstreet Advisory<br>www.mainstreetfirm.com</p>'
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
};
