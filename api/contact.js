// Mainstreet Advisory — "Tell us about your deal" form handler (Vercel serverless, Resend)

// Anti-spam: request must actually originate from the site (blocks bots hitting this
// endpoint directly, which is the pattern behind the recent junk "inquiries").
function isAllowedOrigin(req) {
    const check = (val) => {
          if (!val) return false;
          try {
                  const host = new URL(val).hostname;
                  return host === 'mainstreetfirm.com' || host.endsWith('.mainstreetfirm.com') || host.endsWith('.vercel.app');
          } catch (e) {
                  return false;
          }
    };
    return check(req.headers.origin) || check(req.headers.referer);
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!isAllowedOrigin(req)) {
          console.warn('Contact form: rejected request with bad/missing origin', req.headers.origin, req.headers.referer);
          return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body || {};

    // Honeypot: real visitors never see or fill this field (off-screen, no autocomplete).
    // Bots that blindly fill every form field trip it. Pretend success so they don't adapt.
    if ((body.website || '').trim()) {
          console.warn('Contact form: honeypot triggered, dropping silently');
          return res.status(200).json({ success: true });
    }

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
                  from: 'Mainstreet Advisory <notifications@mail.mainstreetfirm.com>',
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
                  from: 'Matt Calnan, CPA <notifications@mail.mainstreetfirm.com>',
                  to: [email],
                  subject: 'Thanks for reaching out — Mainstreet Advisory',
                  html: '<p>Hi ' + esc(name) + ',</p>'
                    + '<p>Thanks for telling us about your deal. I have your details and will follow up within one business day with next steps and a scope for the financial due diligence you need.</p>'
                    + '<p>If it is time-sensitive, reply to this email or book a call directly: <a href="https://calendly.com/calnanreg/mainstreet-advisory-discovery-call">book a 15-minute scoping call</a>.</p>'
                    + '<p>Best,<br>Matt Calnan, CPA, CMA<br>Mainstreet Advisory<br>www.mainstreetfirm.com</p>'
          });
          return res.status(200).json({ success: true });
    } catch (err) {
          console.error('Handler error:', err.message);
          return res.status(500).json({ error: 'Internal error' });
    }
};
