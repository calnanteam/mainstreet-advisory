// Mainstreet Advisory: Outreach Setter Round 2 submission handler (Vercel serverless, Resend)
// Same pattern as api/contact.js: origin check, honeypot, notify Matt, confirm to the candidate.

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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

    const b = req.body || {};
    if ((b.website || '').trim()) return res.status(200).json({ success: true });

    const v = (k) => String(b[k] || '').trim().slice(0, 4000);
    const f = {
        name: v('name'), email: v('email'), linkedin: v('linkedin'), broker: v('broker'),
        script1: v('script1'), script2: v('script2'), targets: v('targets'),
        recording: v('recording'), timezone: v('timezone'), src: v('src'),
        consent: v('consent'), rules: v('rules')
    };
    const required = ['name', 'email', 'linkedin', 'broker', 'script1', 'script2', 'targets', 'recording', 'timezone'];
    if (required.some((k) => !f[k]) || f.consent !== 'yes' || f.rules !== 'yes') {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const block = (label, val) => '<p><strong>' + label + '</strong><br>' + esc(val).replace(/\n/g, '<br>') + '</p>';
    const words = (s) => (s.match(/\S+/g) || []).length;
    const send = (payload) => fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    try {
        const notify = await send({
            from: 'Mainstreet Advisory <notifications@mail.mainstreetfirm.com>',
            to: ['matt@calnan.co'],
            reply_to: f.email,
            subject: 'Setter Round 2: ' + f.name,
            html: '<h2>Outreach Setter Round 2 submission</h2>'
                + block('Name', f.name)
                + block('Email', f.email)
                + block('Their LinkedIn', f.linkedin)
                + block('Broker picked (LinkedIn)', f.broker)
                + block('Script 1, personalized (' + f.script1.length + ' chars)', f.script1)
                + block('Script 2, personalized (' + words(f.script2) + ' words)', f.script2)
                + block('Three prospect types', f.targets)
                + block('Recording', f.recording)
                + block('Time zone and availability', f.timezone)
                + block('Source', f.src || 'none')
                + '<p>Consent to recording review: yes. Agreed to the rules: yes.</p>'
        });
        if (!notify.ok) {
            console.error('Resend notify failed:', notify.status, await notify.text());
            return res.status(500).json({ error: 'Email send failed' });
        }
        await send({
            from: 'Matt Calnan <notifications@mail.mainstreetfirm.com>',
            to: [f.email],
            reply_to: 'matt@calnan.co',
            subject: 'Got your Round 2',
            html: '<p>Hi ' + esc(f.name.split(' ')[0]) + ',</p>'
                + '<p>Thanks, I have your Round 2. I will be in touch within a few days.</p>'
                + '<p>Matt<br>Mainstreet Advisory</p>'
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('setter-round2 handler error:', err.message);
        return res.status(500).json({ error: 'Internal error' });
    }
};
