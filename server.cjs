require('dotenv').config({ path: ['.env.local', '.env'] });
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Token-based Auth Middleware
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '369369').trim();
const AUTH_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD + 'kp7-salt').digest('hex');

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== AUTH_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
}

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true, token: AUTH_TOKEN });
    }
    return res.status(401).json({ success: false, error: 'Invalid password' });
});

app.use(express.static(path.join(__dirname, 'dist'))); // Serve static files from 'dist' directory

// Configuration
const SPREADSHEET_ID = '1v-b42PSXONWdchsyj9RWy_IVeCAoTCKOnn0SOEFh20E'; // Real Sheet ID
const SERVICE_ACCOUNT_FILE = './credentials.json'; // User must place this file
const SHEET_MASTER = 'Master_Personnel';
const SHEET_TRANSACTIONS = 'Transactions';

// Mock Data (for initial testing without credentials)
const USE_MOCK_DATA = false; // Set to false when real credentials are ready

const mockSchools = [
    "โรงเรียนอนุบาลชัยนาท",
    "โรงเรียนวัดบรมธาตุ",
    "โรงเรียนบ้านหนองแค"
];

const mockPersonnel = [
    { id: "1", name: "นายสมชาย ใจดี", school: "โรงเรียนอนุบาลชัยนาท", position: "ครู" },
    { id: "2", name: "นางสาวสมหญิง รักเรียน", school: "โรงเรียนอนุบาลชัยนาท", position: "ครู" },
    { id: "3", name: "นายมานะ อดทน", school: "โรงเรียนวัดบรมธาตุ", position: "ผอ." },
    { id: "4", name: "นางมานี มีตา", school: "โรงเรียนบ้านหนองแค", position: "ครูธุรการ" }
];

let mockTransactions = [
    {
        id: 'mock-1',
        timestamp: '25/11/2568 09:00:00',
        school: 'โรงเรียนอนุบาลชัยนาท',
        name: 'นายสมชาย ใจดี',
        reason: 'สมัครสอบ',
        status: 'Borrowed'
    }
];

// Google Sheets Client
async function getSheetsClient() {
    let auth;

    // Check for Environment Variable (Render/Cloud)
    // Check for Environment Variable (Render/Cloud)
    if (process.env.GOOGLE_CREDENTIALS) {
        console.log("Attempting to use GOOGLE_CREDENTIALS from Env");
        try {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
            // Fix private key newlines if they are escaped (common issue in Vercel)
            if (credentials.private_key) {
                credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
            }
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } catch (error) {
            console.error("Error parsing GOOGLE_CREDENTIALS:", error);
            throw error;
        }
    } else {
        console.log("No GOOGLE_CREDENTIALS found, falling back to local file");
        // Fallback to local file
        auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }

    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
}

// Routes

// 1. Get All Schools
app.get('/api/schools', async (req, res) => {
    try {
        const sheets = await getSheetsClient();
        // Real Data: Column A is School (หน่วยงาน) - Based on user feedback
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MASTER}!A2:A`,
        });
        const rows = response.data.values || [];
        const schools = [...new Set(rows.map(row => row[0]))].filter(Boolean); // Unique schools
        res.json(schools);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch schools' });
    }
});

// 2. Get Personnel by School
app.get('/api/personnel/:school', async (req, res) => {
    const { school } = req.params;
    if (USE_MOCK_DATA) {
        const personnel = mockPersonnel.filter(p => p.school === school);
        return res.json(personnel);
    }
    try {
        const sheets = await getSheetsClient();
        // Real Data: Col A=School, Col B=Name, Col C=Position
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MASTER}!A2:C`,
        });
        const rows = response.data.values || [];
        const personnel = rows
            .filter(row => row[0] === school) // Filter by School (Col A)
            .map((row, index) => ({
                id: index.toString(),
                name: row[1], // Name (Col B)
                position: row[2] || '' // Position (Col C)
            }));
        res.json(personnel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch personnel' });
    }
});

// 2.5 Global Search Personnel
app.get('/api/search-personnel', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    if (USE_MOCK_DATA) {
        const results = mockPersonnel.filter(p => p.name.includes(q));
        return res.json(results);
    }

    try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MASTER}!A2:C`,
        });
        const rows = response.data.values || [];
        const results = rows
            .map((row, index) => ({
                id: index.toString(),
                school: row[0],
                name: row[1],
                position: row[2] || ''
            }))
            .filter(p => p.name && p.name.includes(q))
            .slice(0, 50); // Limit results

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search personnel' });
    }
});

// 3. Borrow (Save Transaction)
app.post('/api/borrow', async (req, res) => {
    // New Payload: { items: [{name, school, ...}], reason: "..." }
    const { items, reason } = req.body;
    const timestamp = new Date().toLocaleDateString('th-TH');

    // Basic Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
    }

    if (USE_MOCK_DATA) {
        items.forEach(item => {
            const newTx = {
                id: Date.now().toString() + Math.random(),
                timestamp,
                school: item.school,
                name: item.name,
                reason,
                status: 'Borrowed'
            };
            mockTransactions.push(newTx);
        });
        return res.json({ success: true, message: 'Saved to mock DB' });
    }

    try {
        // Prepare bulk values: one row per item
        // [Timestamp, School, Name, Reason, Status, ReturnTimestamp]
        const values = items.map(item => [
            timestamp,
            item.school || 'Unspecified',
            item.name,
            reason,
            'Borrowed',
            ''
        ]);

        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TRANSACTIONS}!A:F`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: values
            },
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save transaction' });
    }
});

// 4. Get Active Borrows (for Returning)
app.get('/api/active-borrows', async (req, res) => {
    const { search } = req.query; // Search by name
    if (USE_MOCK_DATA) {
        const active = mockTransactions.filter(t => t.status === 'Borrowed' && t.name.includes(search || ''));
        return res.json(active);
    }
    // Implementation for real sheets would involve reading Transactions and filtering
    // For simplicity in this POC, we'll skip complex sheet filtering query here
    // and just read all and filter in memory (okay for < 10k rows)
    try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TRANSACTIONS}!A2:F`,
        });
        const rows = response.data.values || [];
        // Columns: 0=Time, 1=School, 2=Name, 3=Reason, 4=Status, 5=ReturnTime
        const active = rows
            .map((row, index) => ({ rowIndex: index + 2, timestamp: row[0], school: row[1], name: row[2], reason: row[3], status: row[4] }))
            .filter(item => item.status === 'Borrowed');

        if (search) {
            const filtered = active.filter(item => item.name.includes(search));
            return res.json(filtered);
        }
        res.json(active);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active borrows' });
    }
});

// 5. Return (Update Transaction)
app.post('/api/return', async (req, res) => {
    // ... (existing implementation)
    const { rowIndex } = req.body;
    const timestamp = new Date().toLocaleDateString('th-TH');

    if (USE_MOCK_DATA) {
        const tx = mockTransactions.find(t => t.status === 'Borrowed');
        if (tx) tx.status = 'Returned';
        return res.json({ success: true });
    }

    try {
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TRANSACTIONS}!E${rowIndex}:F${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Returned', timestamp]] },
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// 5.5 Delete Transaction
app.post('/api/delete-transaction', async (req, res) => {
    // ... existing delete logic ...
    const { rowIndex } = req.body;
    // ...
});

// 5.6 Bulk Return
app.post('/api/bulk-return', async (req, res) => {
    const { rowIndices } = req.body;
    const timestamp = new Date().toLocaleDateString('th-TH');

    if (!rowIndices || !Array.isArray(rowIndices) || rowIndices.length === 0) {
        return res.status(400).json({ error: 'No items selected' });
    }

    if (USE_MOCK_DATA) {
        // Mock update
        return res.json({ success: true, count: rowIndices.length });
    }

    try {
        const sheets = await getSheetsClient();
        const data = rowIndices.map(rowIndex => ({
            range: `${SHEET_TRANSACTIONS}!E${rowIndex}:F${rowIndex}`,
            values: [['Returned', timestamp]]
        }));

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: data
            }
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to bulk return' });
    }
});

// 6. Get All Transactions (for Admin History)
app.get('/api/transactions', authMiddleware, async (req, res) => {
    if (USE_MOCK_DATA) {
        return res.json(mockTransactions.map(t => ({
            ...t,
            coordCenter: 'ศูนย์ทดสอบ',
            folderNo: '99/99'
        })));
    }
    try {
        const sheets = await getSheetsClient();

        // Parallel Fetch: Transactions AND Master_Personnel
        const [txRes, personnelRes] = await Promise.all([
            sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_TRANSACTIONS}!A2:F`,
            }),
            sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_MASTER}!A2:F`, // A=School, B=Name, C=Pos, D=Center, E=Folder, F=Phone
            })
        ]);

        const txRows = txRes.data.values || [];
        const personnelRows = personnelRes.data.values || [];

        // Build Personnel Lookup Map: Key = "Name|School" -> Value = { center, folder }
        const personnelMap = new Map();
        personnelRows.forEach(row => {
            if (row[1]) { // If name exists
                const key = `${row[1].trim()}|${row[0] ? row[0].trim() : ''}`;
                personnelMap.set(key, {
                    position: row[2] || '-',
                    coordCenter: row[3] || '-',
                    folderNo: row[4] || '-',
                    phone: row[5] || '-'
                });

                // Backup key: just name (in case school in transaction mismatch slightly)
                // Only set if not exists to prefer precise match
                const nameKey = row[1].trim();
                if (!personnelMap.has(nameKey)) {
                    personnelMap.set(nameKey, {
                        position: row[2] || '-',
                        coordCenter: row[3] || '-',
                        folderNo: row[4] || '-',
                        phone: row[5] || '-'
                    });
                }
            }
        });

        // Map Transactions with Lookups
        const transactions = txRows.map((row, index) => {
            const school = row[1] ? row[1].trim() : '';
            const name = row[2] ? row[2].trim() : '';
            const lookupKey = `${name}|${school}`;

            // Try precise match first, then loose match by name
            const details = personnelMap.get(lookupKey) || personnelMap.get(name) || { position: '-', coordCenter: '-', folderNo: '-', phone: '-' };

            return {
                rowIndex: index + 2,
                timestamp: row[0],
                school: row[1],
                name: row[2],
                position: details.position,
                reason: row[3],
                status: row[4],
                returnTimestamp: row[5],
                coordCenter: details.coordCenter,
                folderNo: details.folderNo,
                phone: details.phone
            };
        });

        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// 7. Clean Data (Auto-Categorize Reasons)
app.post('/api/clean-reasons', async (req, res) => {
    const KEYWORD_MAP = {
        'ขอใบอนุญาตประกอบวิชาชีพ': ['ใบประกอบ', 'ตั๋วครู', 'ต่อใบ'],
        'ขอเลื่อนวิทยฐานะ': ['วิทยฐานะ', 'เลื่อนขั้น', 'คศ'],
        'ประกอบคำร้องขอย้าย': ['ย้าย'],
        'ขอมีเครื่องราชอิสริยาภรณ์': ['เครื่องราช', 'สายสะพาย'],
        'ขอสมัครงาน': ['สมัครงาน'],
        'ขอลาออก': ['ลาออก'],
        'สมัครสมาชิกสหกรณ์ออมทรัพย์ครู': ['สหกรณ์', 'กู้', 'ออมทรัพย์']
    };

    if (USE_MOCK_DATA) {
        let count = 0;
        mockTransactions.forEach(tx => {
            for (const [standard, keywords] of Object.entries(KEYWORD_MAP)) {
                if (keywords.some(k => tx.reason.includes(k)) && tx.reason !== standard) {
                    tx.reason = standard;
                    count++;
                    break;
                }
            }
        });
        return res.json({ success: true, updatedCount: count });
    }

    try {
        const sheets = await getSheetsClient();
        // 1. Fetch all reasons (Col D)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TRANSACTIONS}!D2:D`,
        });
        const rows = response.data.values || [];

        const updates = [];
        let updatedCount = 0;

        // 2. Analyze and prepare updates
        rows.forEach((row, index) => {
            const currentReason = row[0] || '';
            let newReason = currentReason;
            let matched = false;

            for (const [standard, keywords] of Object.entries(KEYWORD_MAP)) {
                if (keywords.some(k => currentReason.includes(k)) && currentReason !== standard) {
                    newReason = standard;
                    matched = true;
                    break;
                }
            }

            if (matched) {
                updatedCount++;
                // Prepare batch update for this specific cell
                updates.push({
                    range: `${SHEET_TRANSACTIONS}!D${index + 2}`, // +2 because 1-based and header
                    values: [[newReason]]
                });
            }
        });

        if (updates.length > 0) {
            // 3. Execute Batch Update
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });
        }

        res.json({ success: true, updatedCount });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to clean data' });
    }
});

// 8. User Management (Stub)
app.get('/api/users', authMiddleware, (req, res) => {
    // Return dummy admin user
    res.json([{ id: 1, username: 'admin', role: 'admin', name: 'Administrator' }]);
});

app.post('/api/users', authMiddleware, (req, res) => res.json({ success: true }));
app.put('/api/users/:id', authMiddleware, (req, res) => res.json({ success: true }));
app.delete('/api/users/:id', authMiddleware, (req, res) => res.json({ success: true }));

// 9. Audit Log (Stub)
app.get('/api/audit-log', authMiddleware, (req, res) => {
    res.json([]);
});

// 10. Reports (Stub)
app.get('/api/reports/summary', authMiddleware, (req, res) => {
    res.json({
        total: 0,
        borrowed: 0,
        returned: 0,
        bySchool: {},
        byReason: {}
    });
});

// 11. Reminders (Stub)
app.get('/api/reminders/overdue', authMiddleware, (req, res) => {
    res.json([]);
});

app.post('/api/email/notify-overdue', authMiddleware, (req, res) => {
    res.json({ results: [] });
});

// Catch-all handler for any request that doesn't match the above
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Export for Vercel
if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Mode: ${USE_MOCK_DATA ? 'MOCK DATA' : 'LIVE GOOGLE SHEETS'}`);
    });
}
