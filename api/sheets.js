/**
 * Google Sheets backend สำหรับระบบยืม-คืน กพ.7
 * ใช้ Service Account: ใส่ credentials ใน credentials.json หรือ GOOGLE_CREDENTIALS (JSON string)
 * ตั้ง SPREADSHEET_ID ใน .env
 */
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let sheetsClient = null;

function getAuth() {
    let creds = null;
    const envCreds = process.env.GOOGLE_CREDENTIALS;
    if (envCreds) {
        try {
            creds = JSON.parse(envCreds);
        } catch (e) {
            console.warn('GOOGLE_CREDENTIALS invalid JSON');
            return null;
        }
    } else {
        const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'credentials.json');
        if (!fs.existsSync(credPath)) {
            console.warn('credentials.json not found and GOOGLE_CREDENTIALS not set');
            return null;
        }
        creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }
    return new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
}

export async function getSheets() {
    if (sheetsClient) return sheetsClient;
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.warn('SPREADSHEET_ID not set');
        return null;
    }
    const auth = await getAuth();
    if (!auth) return null;
    const sheets = google.sheets({ version: 'v4', auth });
    sheetsClient = { sheets, spreadsheetId };
    return sheetsClient;
}

const SHEET_NAMES = {
    PERSONNEL: 'Master_Personnel',
    TRANSACTIONS: 'Transactions',
    NEWS: 'News',
    AUDIT: 'Audit_Log'
};

/** อ่านทั้งชีท (แถวแรกเป็น header ได้) */
export async function readSheet(sheetName, rangeA1) {
    const client = await getSheets();
    if (!client) return [];
    const range = rangeA1 ? `${sheetName}!${rangeA1}` : `${sheetName}!A:Z`;
    try {
        const res = await client.sheets.spreadsheets.values.get({
            spreadsheetId: client.spreadsheetId,
            range
        });
        return (res.data.values || []).map(row => [...(row || [])]);
    } catch (e) {
        console.error('Sheets read error:', e.message);
        return [];
    }
}

/** เพิ่มแถวท้ายชีท */
export async function appendRow(sheetName, values) {
    const client = await getSheets();
    if (!client) return false;
    try {
        await client.sheets.spreadsheets.values.append({
            spreadsheetId: client.spreadsheetId,
            range: `${sheetName}!A:A`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [values] }
        });
        return true;
    } catch (e) {
        console.error('Sheets append error:', e.message);
        return false;
    }
}

/** อัปเดตแถวที่ rowIndex (1-based, 1 = header ดังนั้นแถวข้อมูลแรก = 2) */
export async function updateRow(sheetName, rowIndex, startCol, values) {
    const client = await getSheets();
    if (!client) return false;
    const colLetter = (n) => {
        let s = '';
        while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
        return s;
    };
    const endCol = startCol + values.length - 1;
    const range = `${sheetName}!${colLetter(startCol)}${rowIndex}:${colLetter(endCol)}${rowIndex}`;
    try {
        await client.sheets.spreadsheets.values.update({
            spreadsheetId: client.spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] }
        });
        return true;
    } catch (e) {
        console.error('Sheets update error:', e.message);
        return false;
    }
}

/** ลบแถว (ใช้ได้แต่จะเลื่อนแถว — ถ้าไม่จำเป็นไม่ใช้) */
export async function deleteRow(sheetName, rowIndex) {
    const client = await getSheets();
    if (!client) return false;
    try {
        const meta = await client.sheets.spreadsheets.get({ spreadsheetId: client.spreadsheetId });
        const sheet = (meta.data.sheets || []).find(s => (s.properties.title || '') === sheetName);
        if (!sheet) return false;
        const sheetId = sheet.properties.sheetId;
        await client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: client.spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        return true;
    } catch (e) {
        console.error('Sheets deleteRow error:', e.message);
        return false;
    }
}

export { SHEET_NAMES };
