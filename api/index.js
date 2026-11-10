import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { getSheets, readSheet, appendRow, updateRow, deleteRow, SHEET_NAMES } from './sheets.js';
import XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const app = express();

// Security Hardening Headers
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '1mb' }));

// Timing-Safe String Comparison (Prevents Side-Channel Timing Attacks)
function timingSafeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// Token-based Auth Middleware
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '369369').trim();
const AUTH_TOKEN = crypto.createHash('sha256').update(ADMIN_PASSWORD + 'kp7-salt').digest('hex');

// In-Memory Login Rate Limiter (Brute-force protection: max 5 failed attempts per IP / min)
const loginAttempts = new Map();
function loginRateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { failed: 0, resetTime: now + 60000 };

    if (now > entry.resetTime) {
        entry.failed = 0;
        entry.resetTime = now + 60000;
    }

    if (entry.failed >= 5) {
        const waitSec = Math.ceil((entry.resetTime - now) / 1000);
        return res.status(429).json({
            success: false,
            error: `เข้าสู่ระบบผิดพลาดเกินกำหนด กรุณารอ ${waitSec} วินาทีก่อนลองใหม่`
        });
    }

    req._loginEntry = entry;
    req._clientIp = ip;
    next();
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (!timingSafeCompare(token, AUTH_TOKEN)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
}

app.post('/api/login', loginRateLimiter, (req, res) => {
    const { password } = req.body;
    if (password && timingSafeCompare(password, ADMIN_PASSWORD)) {
        if (req._loginEntry) loginAttempts.delete(req._clientIp);
        return res.json({ success: true, token: AUTH_TOKEN });
    }
    if (req._loginEntry) {
        req._loginEntry.failed++;
        loginAttempts.set(req._clientIp, req._loginEntry);
    }
    return res.status(401).json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' });
});

const USE_MOCK_DATA = false;

const PN = SHEET_NAMES.PERSONNEL;
const TX = SHEET_NAMES.TRANSACTIONS;
const NEWS = SHEET_NAMES.NEWS;
const AUDIT = SHEET_NAMES.AUDIT;

async function logAudit(action, details, user = 'admin') {
    if (USE_MOCK_DATA) return;
    try {
        const client = await getSheets();
        if (!client) return;
        const timestamp = new Date().toLocaleString('th-TH');
        await appendRow(AUDIT, [timestamp, user, action, JSON.stringify(details)]);
    } catch (error) {
        console.error('Failed to log audit:', error);
    }
}

const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    }
};
const transporter = nodemailer.createTransport(emailConfig);

async function getUsers() {
    return [];
}

async function sendEmail(to, subject, text, html) {
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        console.log('Email not configured, skipping send');
        return { success: false, message: 'Email not configured' };
    }
    try {
        await transporter.sendMail({ from: emailConfig.auth.user, to, subject, text, html });
        return { success: true };
    } catch (error) {
        console.error('Send email error:', error);
        return { success: false, error: error.message };
    }
}

const apiUsage = { totalRequests: 0, requestsByEndpoint: {}, lastReset: Date.now(), requestsLast100Seconds: [] };
app.use('/api', (req, res, next) => {
    const endpoint = req.path;
    apiUsage.totalRequests++;
    apiUsage.requestsByEndpoint[endpoint] = (apiUsage.requestsByEndpoint[endpoint] || 0) + 1;
    const now = Date.now();
    apiUsage.requestsLast100Seconds.push(now);
    apiUsage.requestsLast100Seconds = apiUsage.requestsLast100Seconds.filter(ts => now - ts < 100000);
    next();
});

const mockSchools = ["โรงเรียนอนุบาลชัยนาท", "โรงเรียนวัดบรมธาตุ", "โรงเรียนบ้านหนองแค"];
const mockPersonnel = [
    { id: "1", name: "นายสมชาย ใจดี", school: "โรงเรียนอนุบาลชัยนาท", position: "ครู" },
    { id: "2", name: "นางสาวสมหญิง รักเรียน", school: "โรงเรียนอนุบาลชัยนาท", position: "ครู" },
];
let mockTransactions = [
    { id: 1, rowIndex: 1, timestamp: '25/11/2568 09:00:00', school: 'โรงเรียนอนุบาลชัยนาท', name: 'นายสมชาย ใจดี', reason: 'สมัครสอบ', status: 'Borrowed', returnTimestamp: '', coordCenter: '-', folderNo: '-', position: 'ครู' }
];
let mockNews = [
    { timestamp: '11/12/2568 10:00:00', title: 'ประกาศผลสอบ', content: 'รายละเอียด...', image: '' },
];

function isHeaderRow(row) {
    if (!row || !row[0]) return false;
    const first = String(row[0]).trim();
    return first === 'หน่วยงาน' || first === 'school' || first === 'วันที่' || first === 'timestamp' || /^[A-Za-z]/.test(first);
}

async function getPersonnelRows() {
    let raw = await readSheet(PN);
    if (raw.length === 0) raw = await readSheet('Personnel');
    const start = raw.length > 0 && isHeaderRow(raw[0]) ? 1 : 0;
    return raw.slice(start).map((row, i) => ({
        school: (row[0] || '').trim(),
        name: (row[1] || '').trim(),
        position: (row[2] || '').trim(),
        coordCenter: (row[3] || '').trim() || '-',
        folderNo: (row[4] || '').trim() || '-',
        rowIndex: start + i + 1
    })).filter(r => r.school || r.name);
}

async function getTransactionRows() {
    let raw = await readSheet(TX);
    const start = raw.length > 0 && isHeaderRow(raw[0]) ? 1 : 0;
    return raw.slice(start).map((row, i) => ({
        rowIndex: start + i + 1,
        timestamp: (row[0] || '').trim(),
        school: (row[1] || '').trim(),
        name: (row[2] || '').trim(),
        reason: (row[3] || '').trim(),
        status: (row[4] || '').trim() || 'Borrowed',
        returnTimestamp: (row[5] || '').trim()
    })).filter(r => r.timestamp);
}

function buildPersonnelMap(personnelRows) {
    const map = {};
    for (const p of personnelRows) {
        const key = `${p.school}|${p.name}`;
        map[key] = p;
    }
    return map;
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running', env: process.env.VERCEL ? 'Vercel' : 'Local' });
});

app.get('/api/check-db', async (req, res) => {
    const result = { SPREADSHEET_ID: process.env.SPREADSHEET_ID ? 'SET' : 'NOT SET', GOOGLE_CREDENTIALS: process.env.GOOGLE_CREDENTIALS ? 'SET' : 'NOT SET' };
    try {
        const client = await getSheets();
        result.client = client ? 'OK' : 'NULL (getSheets returned null)';
        if (client) {
            const meta = await client.sheets.spreadsheets.get({ spreadsheetId: client.spreadsheetId });
            result.sheetNames = (meta.data.sheets || []).map(s => s.properties.title);
            const data = await client.sheets.spreadsheets.values.get({ spreadsheetId: client.spreadsheetId, range: 'Transactions!A1:F3' });
            result.txRows = (data.data.values || []).length;
            result.txSample = (data.data.values || [])[0] || null;
        }
        result.ok = true;
    } catch (e) {
        result.ok = false;
        result.error = e.message;
    }
    res.json(result);
});

app.get('/api/schools', async (req, res) => {
    if (USE_MOCK_DATA) return res.json(mockSchools);
    try {
        const rows = await getPersonnelRows();
        const schools = [...new Set(rows.map(r => r.school).filter(Boolean))].sort();
        if (schools.length === 0) {
            const txRows = await getTransactionRows();
            const fromTx = [...new Set(txRows.map(r => r.school).filter(Boolean))].sort();
            return res.json(fromTx);
        }
        res.json(schools);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch schools' });
    }
});

app.get('/api/personnel/:school', async (req, res) => {
    const { school } = req.params;
    if (USE_MOCK_DATA) {
        return res.json(mockPersonnel.filter(p => p.school === school));
    }
    try {
        const rows = await getPersonnelRows();
        const filtered = rows.filter(r => r.school === school);
        return res.json(filtered.map((r, i) => ({ id: String(r.rowIndex), name: r.name, school: r.school, position: r.position })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch personnel' });
    }
});

app.get('/api/search-personnel', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    if (USE_MOCK_DATA) {
        return res.json(mockPersonnel.filter(p => p.name.includes(q)));
    }
    try {
        const rows = await getPersonnelRows();
        const lower = String(q).toLowerCase();
        const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(lower) || (r.school || '').toLowerCase().includes(lower)).slice(0, 50);
        return res.json(filtered.map(r => ({ id: String(r.rowIndex), school: r.school, name: r.name, position: r.position })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search personnel' });
    }
});

app.post('/api/borrow', async (req, res) => {
    const { items, reason } = req.body;
    const timestamp = new Date().toLocaleString('th-TH');
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
    }
    if (USE_MOCK_DATA) {
        items.forEach(item => {
            mockTransactions.push({ id: Date.now(), rowIndex: mockTransactions.length + 2, timestamp, school: item.school || 'Unspecified', name: item.name, reason, status: 'Borrowed', returnTimestamp: '', coordCenter: '-', folderNo: '-', position: '' });
        });
        return res.json({ success: true });
    }
    try {
        for (const item of items) {
            await appendRow(TX, [timestamp, item.school || 'Unspecified', item.name || '', reason || '', 'Borrowed', '']);
        }
        await logAudit('BORROW', { count: items.length, reason }, 'system');
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save borrow' });
    }
});

app.get('/api/active-borrows', requireAuth, async (req, res) => {
    const { search } = req.query;
    if (USE_MOCK_DATA) {
        const active = mockTransactions.filter(t => t.status === 'Borrowed' && t.name.includes(search || ''));
        return res.json(active.map(t => ({ rowIndex: t.id, timestamp: t.timestamp, school: t.school, name: t.name, reason: t.reason, status: t.status })));
    }
    try {
        let rows = await getTransactionRows();
        rows = rows.filter(r => r.status === 'Borrowed');
        if (search) rows = rows.filter(r => (r.name || '').includes(search));
        return res.json(rows.map(r => ({ rowIndex: r.rowIndex, timestamp: r.timestamp, school: r.school, name: r.name, reason: r.reason, status: r.status })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active borrows' });
    }
});

app.post('/api/return', requireAuth, async (req, res) => {
    const { rowIndex } = req.body;
    const timestamp = new Date().toLocaleString('th-TH');
    if (USE_MOCK_DATA) {
        const tx = mockTransactions.find(t => t.status === 'Borrowed');
        if (tx) tx.status = 'Returned';
        return res.json({ success: true });
    }
    try {
        const ok = await updateRow(TX, rowIndex, 4, ['Returned', timestamp]);
        if (!ok) return res.status(500).json({ error: 'Failed to update sheet' });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update return' });
    }
});

app.post('/api/delete-transaction', requireAuth, async (req, res) => {
    const { rowIndex } = req.body;
    if (USE_MOCK_DATA) {
        mockTransactions = mockTransactions.filter(t => t.id !== rowIndex);
        return res.json({ success: true });
    }
    try {
        const ok = await deleteRow(TX, rowIndex);
        if (!ok) return res.status(500).json({ error: 'Failed to delete row' });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
    if (USE_MOCK_DATA) {
        return res.json(mockTransactions.map(t => ({ ...t, rowIndex: t.id })));
    }
    try {
        const [txRows, personnelRows] = await Promise.all([getTransactionRows(), getPersonnelRows()]);
        const personMap = buildPersonnelMap(personnelRows);
        const transactions = txRows.map(r => {
            const key = `${r.school}|${r.name}`;
            const p = personMap[key];
            return {
                rowIndex: r.rowIndex,
                timestamp: r.timestamp,
                school: r.school,
                name: r.name,
                reason: r.reason,
                status: r.status,
                returnTimestamp: r.returnTimestamp || '',
                coordCenter: p ? p.coordCenter : '-',
                folderNo: p ? p.folderNo : '-',
                position: p ? p.position : '-'
            };
        });
        res.json(transactions.reverse());
    } catch (error) {
        console.error('GET /api/transactions error:', error.message);
        res.setHeader('X-Data-Error', error.message || String(error));
        res.status(200).json([]);
    }
});

app.post('/api/clean-reasons', requireAuth, async (req, res) => {
    const KEYWORD_MAP = {
        'ขอใบอนุญาตประกอบวิชาชีพ': ['ใบประกอบ', 'ตั๋วครู', 'ต่อใบ'],
        'ขอเลื่อนวิทยฐานะ': ['วิทยฐานะ', 'เลื่อนขั้น', 'คศ'],
        'ประกอบคำร้องขอย้าย': ['ย้าย'],
        'ขอมีเครื่องราชอิสริยาภรณ์': ['เครื่องราช', 'สายสะพาย'],
        'ขอสมัครงาน': ['สมัครงาน'],
        'ขอลาออก': ['ลาออก'],
        'สมัครสมาชิกสหกรณ์ออมทรัพย์ครู': ['สหกรณ์', 'กู้', 'ออมทรัพย์']
    };
    if (USE_MOCK_DATA) return res.json({ success: true, updatedCount: 0 });
    try {
        const rows = await getTransactionRows();
        let updatedCount = 0;
        for (const row of rows) {
            let newReason = row.reason || '';
            for (const [standard, keywords] of Object.entries(KEYWORD_MAP)) {
                if (keywords.some(k => (row.reason || '').includes(k)) && row.reason !== standard) {
                    newReason = standard;
                    break;
                }
            }
            if (newReason !== (row.reason || '')) {
                await updateRow(TX, row.rowIndex, 3, [newReason, row.status, row.returnTimestamp || '']);
                updatedCount++;
            }
        }
        res.json({ success: true, updatedCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to clean data' });
    }
});

app.get('/api/news', async (req, res) => {
    if (USE_MOCK_DATA) return res.json(mockNews);
    try {
        const raw = await readSheet(NEWS);
        const start = raw.length > 0 && isHeaderRow(raw[0]) ? 1 : 0;
        const news = raw.slice(start).map(row => ({
            timestamp: (row[0] || '').trim(),
            title: (row[1] || '').trim(),
            content: (row[2] || '').trim(),
            image: (row[3] || '').trim()
        })).filter(r => r.timestamp || r.title).reverse();
        res.json(news);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

function parseThaiDate(dateStr) {
    if (!dateStr) return null;
    try {
        const parts = String(dateStr).split(' ')[0].split('/');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2], 10) - 543, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
    } catch (e) { }
    return null;
}

function filterByDateRange(transactions, startDate, endDate) {
    return transactions.filter(t => {
        const txDate = parseThaiDate(t.timestamp);
        if (!txDate) return false;
        if (startDate && txDate < new Date(startDate)) return false;
        if (endDate && txDate > new Date(endDate)) return false;
        return true;
    });
}

async function getTransactionsData() {
    if (USE_MOCK_DATA) return mockTransactions;
    try {
        const [txRows, personnelRows] = await Promise.all([getTransactionRows(), getPersonnelRows()]);
        const personMap = buildPersonnelMap(personnelRows);
        return txRows.map(r => {
            const key = `${r.school}|${r.name}`;
            const p = personMap[key];
            return {
                rowIndex: r.rowIndex,
                timestamp: r.timestamp,
                school: r.school,
                name: r.name,
                reason: r.reason,
                status: r.status,
                returnTimestamp: r.returnTimestamp || '',
                coordCenter: p ? p.coordCenter : '-',
                folderNo: p ? p.folderNo : '-'
            };
        });
    } catch (e) {
        return [];
    }
}

app.get('/api/export/excel', async (req, res) => {
    try {
        const { startDate, endDate, school, status } = req.query;
        let transactions = await getTransactionsData();
        if (startDate || endDate) transactions = filterByDateRange(transactions, startDate, endDate);
        if (school) transactions = transactions.filter(t => t.school === school);
        if (status && status !== 'all') transactions = transactions.filter(t => t.status === status);
        const wsData = transactions.map(t => ({
            'วันที่ยืม': t.timestamp,
            'โรงเรียน': t.school,
            'ชื่อ-สกุล': t.name,
            'ศูนย์ฯ': t.coordCenter,
            'เลขแฟ้ม': t.folderNo,
            'เหตุผล': t.reason,
            'สถานะ': t.status,
            'วันที่คืน': t.returnTimestamp || '-'
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'รายการยืม-คืน');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="รายการยืม-คืน_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(buf);
        await logAudit('EXPORT_EXCEL', { count: transactions.length });
    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({ error: 'Failed to export Excel' });
    }
});

app.get('/api/export/pdf', async (req, res) => {
    try {
        const { startDate, endDate, school, status } = req.query;
        let transactions = await getTransactionsData();
        if (startDate || endDate) transactions = filterByDateRange(transactions, startDate, endDate);
        if (school) transactions = transactions.filter(t => t.school === school);
        if (status && status !== 'all') transactions = transactions.filter(t => t.status === status);
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('รายงานการยืม-คืน กพ.7', 14, 15);
        doc.setFontSize(10);
        doc.text(`วันที่พิมพ์: ${new Date().toLocaleString('th-TH')}`, 14, 22);
        doc.text(`จำนวนรายการ: ${transactions.length}`, 14, 27);
        const tableData = transactions.map(t => [t.timestamp, t.school, t.name, t.reason, t.status, t.returnTimestamp || '-']);
        autoTable(doc, {
            head: [['วันที่', 'โรงเรียน', 'ชื่อ-สกุล', 'เหตุผล', 'สถานะ', 'วันที่คืน']],
            body: tableData,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [52, 152, 219] }
        });
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="รายงาน_${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(pdfBuffer);
        await logAudit('EXPORT_PDF', { count: transactions.length });
    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

app.get('/api/reports/summary', requireAuth, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const transactions = await getTransactionsData();
        const now = new Date();
        let startDate = new Date(now);
        if (period === 'month') startDate.setMonth(now.getMonth() - 1);
        else if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);
        else startDate = new Date(0);
        const filtered = transactions.filter(t => {
            const txDate = parseThaiDate(t.timestamp);
            return txDate && txDate >= startDate;
        });
        const stats = {
            total: filtered.length,
            borrowed: filtered.filter(t => t.status === 'Borrowed').length,
            returned: filtered.filter(t => t.status === 'Returned').length,
            bySchool: {},
            byReason: {},
            byMonth: {}
        };
        filtered.forEach(t => {
            stats.bySchool[t.school] = (stats.bySchool[t.school] || 0) + 1;
            stats.byReason[t.reason] = (stats.byReason[t.reason] || 0) + 1;
            const txDate = parseThaiDate(t.timestamp);
            if (txDate) {
                const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
            }
        });
        res.json(stats);
    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

app.get('/api/audit-log', requireAuth, async (req, res) => {
    if (USE_MOCK_DATA) return res.json([]);
    try {
        const raw = await readSheet(AUDIT);
        const start = raw.length > 0 && isHeaderRow(raw[0]) ? 1 : 0;
        const logs = raw.slice(start).map(row => ({
            timestamp: (row[0] || '').trim(),
            user: (row[1] || '').trim(),
            action: (row[2] || '').trim(),
            details: (() => { try { return JSON.parse((row[3] || '{}').trim()); } catch { return {}; } })()
        })).filter(r => r.timestamp && r.action).slice(-500).reverse();
        res.json(logs);
    } catch (error) {
        console.error('Audit log error:', error);
        res.status(500).json([]);
    }
});

app.get('/api/reminders/overdue', requireAuth, async (req, res) => {
    try {
        const transactions = await getTransactionsData();
        const now = new Date();
        const overdueDays = 30;
        const overdue = transactions
            .filter(t => t.status === 'Borrowed')
            .map(t => {
                const borrowDate = parseThaiDate(t.timestamp);
                if (!borrowDate) return null;
                const daysDiff = Math.floor((now - borrowDate) / (1000 * 60 * 60 * 24));
                if (daysDiff > overdueDays) return { ...t, daysOverdue: daysDiff };
                return null;
            })
            .filter(Boolean);
        res.json(overdue);
    } catch (error) {
        console.error('Reminders error:', error);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
});

app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role, email: u.email, name: u.name })));
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

app.post('/api/users', requireAuth, async (req, res) => {
    res.json({ success: true, message: 'User management (optional)' });
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
    res.json({ success: true });
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
    res.json({ success: true });
});

app.post('/api/email/send', requireAuth, async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;
        if (!to || !subject) return res.status(400).json({ error: 'To and subject required' });
        const result = await sendEmail(to, subject, text, html);
        if (result.success) await logAudit('SEND_EMAIL', { to, subject }, 'admin');
        res.json(result);
    } catch (error) {
        console.error('Send email API error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

async function getOverdueItems() {
    const transactions = await getTransactionsData();
    const now = new Date();
    const overdueDays = 30;
    return transactions
        .filter(t => t.status === 'Borrowed')
        .map(t => {
            const borrowDate = parseThaiDate(t.timestamp);
            if (!borrowDate) return null;
            const daysDiff = Math.floor((now - borrowDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > overdueDays) return { ...t, daysOverdue: daysDiff };
            return null;
        })
        .filter(Boolean);
}

app.post('/api/email/notify-overdue', requireAuth, async (req, res) => {
    try {
        const overdue = await getOverdueItems();
        const results = [];
        for (const item of overdue) {
            const email = item.email || '';
            if (email) {
                const subject = `แจ้งเตือน: รายการยืม กพ.7 ค้างส่ง ${item.daysOverdue} วัน`;
                const text = `รายการยืม กพ.7 ของคุณ ${item.name} จาก ${item.school} ค้างส่งมาแล้ว ${item.daysOverdue} วัน กรุณาคืนของโดยเร็ว`;
                const html = `<h2>แจ้งเตือนรายการค้างส่ง</h2><p>รายการยืม กพ.7 ของคุณ <strong>${item.name}</strong> จาก <strong>${item.school}</strong></p><p>ค้างส่งมาแล้ว <strong>${item.daysOverdue}</strong> วัน</p>`;
                const result = await sendEmail(email, subject, text, html);
                results.push({ item: item.name, email, success: result.success });
            }
        }
        await logAudit('SEND_OVERDUE_NOTIFICATIONS', { count: results.length }, 'admin');
        res.json({ success: true, results });
    } catch (error) {
        console.error('Notify overdue error:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

app.get('/api/usage', (req, res) => {
    const now = Date.now();
    const requestsLast100Seconds = apiUsage.requestsLast100Seconds.length;
    res.json({
        totalRequests: apiUsage.totalRequests,
        requestsLast100Seconds,
        requestsPerMinute: Math.round((requestsLast100Seconds / 100) * 60),
        requestsByEndpoint: apiUsage.requestsByEndpoint,
        lastReset: new Date(apiUsage.lastReset).toISOString()
    });
});

app.post('/api/bulk-return', requireAuth, async (req, res) => {
    const { rowIndices } = req.body;
    const timestamp = new Date().toLocaleString('th-TH');
    if (!rowIndices || !Array.isArray(rowIndices) || rowIndices.length === 0) {
        return res.status(400).json({ error: 'No items selected' });
    }
    if (USE_MOCK_DATA) return res.json({ success: true });
    try {
        for (const id of rowIndices) {
            await updateRow(TX, id, 4, ['Returned', timestamp]);
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to bulk return' });
    }
});

app.post('/api/bulk-delete', requireAuth, async (req, res) => {
    const { rowIndices } = req.body;
    if (!rowIndices || !Array.isArray(rowIndices) || rowIndices.length === 0) {
        return res.status(400).json({ error: 'No items selected' });
    }
    const validRows = [...new Set(rowIndices.map(r => parseInt(r, 10)).filter(r => !isNaN(r) && r >= 2))]
        .sort((a, b) => b - a);

    if (validRows.length === 0) {
        return res.status(400).json({ error: 'Invalid row indices' });
    }
    if (USE_MOCK_DATA) return res.json({ success: true, count: validRows.length });
    try {
        for (const rowNum of validRows) {
            await deleteRow(TX, rowNum);
        }
        res.json({ success: true, count: validRows.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to bulk delete' });
    }
});

const PORT = process.env.PORT || 3000;

async function start() {
    const client = await getSheets();
    if (client) console.log('Google Sheets connected');
    else console.warn('Google Sheets not configured (SPREADSHEET_ID / credentials)');
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

start().catch(e => {
    console.error('Start failed:', e);
    process.exit(1);
});

export default app;
