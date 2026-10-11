// Mainstreet Advisory: Growth Partner application handler (Vercel serverless, Resend)
// Same pattern as api/setter-round2.js and api/contact.js: origin check, honeypot,
// notify Matt, confirm to the applicant. Added: minimum-fill-time trap.
// Nothing blocks an applicant: screening answers are flags for Matt to review at interview.

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
    // Honeypot: real visitors never see this field. Pretend success so bots do not adapt.
    if (String(b.website || '').trim()) return res.status(200).json({ success: true });
    // Time trap: the page sends `elapsed` (ms between page load and submit, measured on the
    // visitor's own clock so clock skew cannot hurt real applicants). Under 4 seconds is a bot.
    const elapsed = Number(b.elapsed);
    if (b.elapsed !== undefined && isFinite(elapsed) && elapsed >= 0 && elapsed < 4000) return res.status(200).json({ success: true });

    const v = (k, max) => String(b[k] == null ? '' : b[k]).trim().slice(0, max || 1500);
    const f = {
        name: v('name', 120).replace(/[\r\n]+/g, ' '),
        email: v('email', 200),
        location: v('location', 120),
        school: v('school', 200),
        gradyear: v('gradyear', 8),
        linkedin: v('linkedin', 300),
        network: v('network', 1500),
        why: v('why', 1500),
        heard: v('heard', 80),
        source: v('source', 400),
        src: v('src', 80),
        pay: v('pay', 20),
        ack: v('ack', 20)
    };

    // Optional multi-select answers. Only known values are kept; nothing here blocks an application.
    const pick = (k, labels) => (Array.isArray(b[k]) ? b[k] : [b[k]]).map((x) => String(x == null ? '' : x)).filter((x) => labels[x]).map((x) => labels[x]);
    const flagLabels = {
        bank_lender: 'Works at or for a bank or lender',
        cpa_firm: 'Works at a CPA, bookkeeping or advisory firm',
        licensed: 'Licensed or regulated professional (lawyer, broker, financial or insurance advisor)'
    };
    const interestLabels = {
        mainstreet: 'Mainstreet Advisory (deal due diligence)',
        ailabs: 'Calnan AI Labs',
        caprate: 'CapRate Advisory (coming soon)',
        unsure: 'Not sure yet'
    };
    const flags = pick('flags', flagLabels);
    if (f.pay === 'questions') flags.push('Has questions about the commission-only structure');
    const interest = pick('interest', interestLabels);

    const required = ['name', 'email', 'location', 'school', 'linkedin', 'network', 'why'];
    if (required.some((k) => !f[k])) return res.status(400).json({ error: 'Missing required fields' });
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(f.email)) return res.status(400).json({ error: 'Invalid email' });
    if (!/linkedin\.com\//i.test(f.linkedin)) return res.status(400).json({ error: 'Invalid LinkedIn URL' });
    // No eligibility knockouts: every complete application is accepted. Flags are reviewed at interview.

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const block = (label, val) => '<p><strong>' + label + '</strong><br>' + esc(val || 'Not provided').replace(/\n/g, '<br>') + '</p>';
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
            subject: 'Growth Partner Application: ' + f.name,
            html: '<h2>Growth Partner application</h2>'
                + block('Name', f.name)
                + block('Email', f.email)
                + block('City and country', f.location)
                + block('School and program', f.school)
                + block('Graduation year', f.gradyear)
                + block('LinkedIn', f.linkedin)
                + block('Who they could introduce us to', f.network)
                + block('Why them', f.why)
                + block('Source (captured from link)', f.source || f.src || 'none (direct)')
                + block('How they say they heard', f.heard)
                + block('Interested in', interest.length ? interest.map((x) => '- ' + x).join('\n') : 'Not answered')
                + block('Flags to review at interview', flags.length ? flags.map((x) => '- ' + x).join('\n') : 'None')
                + block('Contractor acknowledgement (independent contractor, own taxes, answers accurate)', f.ack === 'yes' ? 'Yes' : 'Not ticked')
        });
        if (!notify.ok) {
            console.error('Resend notify failed:', notify.status, await notify.text());
            return res.status(500).json({ error: 'Email send failed' });
        }
        await send({
            from: 'Matt Calnan <notifications@mail.mainstreetfirm.com>',
            to: [f.email],
            reply_to: 'matt@calnan.co',
            subject: 'Got your Growth Partner application',
            html: '<p>Hi ' + esc(f.name.split(' ')[0]) + ',</p>'
                + '<p>Got your application. Thanks for applying to be a Mainstreet Growth Partner.</p>'
                + '<p>We review every application and will email you within 2 business days. If it looks like a fit, the next step is a 15-minute intro call.</p>'
                + '<p>Questions? Just reply to this email.</p>'
                + '<p>Matt<br>Mainstreet Advisory</p>'
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('partners-apply handler error:', err.message);
        return res.status(500).json({ error: 'Internal error' });
    }
};
