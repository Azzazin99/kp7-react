import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import { useNavigate } from 'react-router-dom';
import { Trash2, Eye, EyeOff, Download, FileText, AlertCircle, History, Gamepad2, ChevronLeft, ChevronRight, LayoutDashboard, BarChart3, ClipboardList, ScrollText, Users, Home, Settings, LogOut } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

const ResizableHeader = ({ children, style, ...props }) => {
    const thRef = useRef(null);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        startX.current = e.clientX;
        startWidth.current = thRef.current.offsetWidth;

        const onMouseMove = (e) => {
            const diff = e.clientX - startX.current;
            thRef.current.style.width = Math.max(50, startWidth.current + diff) + 'px';
            thRef.current.style.minWidth = Math.max(50, startWidth.current + diff) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    return (
        <th ref={thRef} style={{ ...style, position: 'relative' }} {...props}>
            {children}
            <span
                onMouseDown={onMouseDown}
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '5px',
                    cursor: 'col-resize',
                    userSelect: 'none',
                }}
            />
        </th>
    );
};

const AdminDashboard = () => {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [transactions, setTransactions] = useState([]);

    const fetchWithAuth = async (url, options = {}) => {
        const token = sessionStorage.getItem('adminToken');
        const demoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
        if (!token && !demoMode) {
            navigate('/login');
            throw new Error('No token found');
        }
        if (demoMode) {
            // In demo mode, don't make real API calls
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        try {
            const res = await fetch(url, { ...options, headers });
            if (res.status === 401) {
                sessionStorage.removeItem('adminToken');
                navigate('/login');
                throw new Error('Unauthorized');
            }
            return res;
        } catch (err) {
            throw err;
        }
    };
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [trendRange, setTrendRange] = useState('7D');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Advanced Filters
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
    const [schoolFilter, setSchoolFilter] = useState('');
    const [allSchools, setAllSchools] = useState([]);

    // Reports & Audit
    const [reportData, setReportData] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [overdueItems, setOverdueItems] = useState([]);

    // User Management
    const [users, setUsers] = useState([]);
    const [showUserForm, setShowUserForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ username: '', password: '', role: 'user', email: '', name: '' });

    const [dataLoadError, setDataLoadError] = useState('');

    const [rowsPerPage, setRowsPerPage] = useState(15);

    // Column visibility
    const allColumns = [
        { key: 'timestamp', label: 'วันที่ยืม' },
        { key: 'school', label: 'โรงเรียน' },
        { key: 'name', label: 'ชื่อ-สกุล' },
        { key: 'phone', label: 'เบอร์โทร' },
        { key: 'position', label: 'ตำแหน่ง' },
        { key: 'coordCenter', label: 'ศูนย์ฯ' },
        { key: 'folderNo', label: 'เลขแฟ้ม' },
        { key: 'reason', label: 'เหตุผล' },
        { key: 'status', label: 'สถานะ' },
    ];
    const [visibleColumns, setVisibleColumns] = useState(
        () => new Set(allColumns.map(c => c.key))
    );
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const REFRESH_INTERVAL_MS = 30000;

    // ===== DEMO MODE =====
    const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';

    const DEMO_TRANSACTIONS = [
        { rowIndex: 2, timestamp: '03/03/2569 09:15', school: 'โรงเรียนอนุบาลชัยนาท', name: 'นางสาวสมใจ รักเรียน', phone: '081-234-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-001', reason: 'ต่อใบอนุญาตประกอบวิชาชีพ', status: 'Returned', returnTimestamp: '05/03/2569 14:30' },
        { rowIndex: 3, timestamp: '05/03/2569 10:42', school: 'โรงเรียนวัดธรรมามูล', name: 'นายประสิทธิ์ ใจดี', phone: '089-567-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-002', reason: 'ทำวิทยฐานะ', status: 'Borrowed' },
        { rowIndex: 4, timestamp: '07/03/2569 08:30', school: 'โรงเรียนชุมชนวัดดักคะนน', name: 'นางวิภา สุขสันต์', phone: '092-345-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-003', reason: 'ต่อใบอนุญาตประกอบวิชาชีพ', status: 'Returned', returnTimestamp: '08/03/2569 10:00' },
        { rowIndex: 5, timestamp: '08/03/2569 13:20', school: 'โรงเรียนวัดศรีวิชัย', name: 'นายวิชัย มานะ', phone: '085-678-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-004', reason: 'ขอมีบัตรประจำตัวเจ้าหน้าที่ของรัฐ', status: 'Borrowed' },
        { rowIndex: 6, timestamp: '09/03/2569 09:00', school: 'โรงเรียนบ้านหนองแค', name: 'นางสาวพรทิพย์ แก้วใส', phone: '063-890-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-005', reason: 'ทำวิทยฐานะ', status: 'Returned', returnTimestamp: '10/03/2569 11:15' },
        { rowIndex: 7, timestamp: '10/03/2569 10:15', school: 'โรงเรียนวัดหนองจิก', name: 'นายอนุชา ก้าวหน้า', phone: '097-123-xxxx', position: 'ครูผู้ช่วย', coordCenter: '', folderNo: 'กพ.7-006', reason: 'ต่อใบอนุญาตประกอบวิชาชีพ', status: 'Borrowed' },
        { rowIndex: 8, timestamp: '10/03/2569 14:45', school: 'โรงเรียนอนุบาลหันคา', name: 'นางมาลี ศรีสุข', phone: '088-456-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-007', reason: 'ประกอบการเกษียณอายุราชการ', status: 'Returned', returnTimestamp: '11/03/2569 09:30' },
        { rowIndex: 9, timestamp: '11/03/2569 08:50', school: 'โรงเรียนวัดคลองบุญนาค', name: 'นายธีรพงศ์ พัฒนา', phone: '064-789-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-008', reason: 'โอนย้ายสังกัด', status: 'Borrowed' },
        { rowIndex: 10, timestamp: '11/03/2569 11:30', school: 'โรงเรียนชุมชนวัดดักคะนน', name: 'นางนิตยา รุ่งเรือง', phone: '091-012-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-009', reason: 'ต่อใบอนุญาตประกอบวิชาชีพ', status: 'Returned', returnTimestamp: '11/03/2569 16:00' },
        { rowIndex: 11, timestamp: '12/03/2569 09:20', school: 'โรงเรียนวัดใหญ่', name: 'นายสมชาย ขยันดี', phone: '082-345-xxxx', position: 'ครู', coordCenter: '', folderNo: 'กพ.7-010', reason: 'ทำวิทยฐานะ', status: 'Borrowed' },
    ];

    const DEMO_OVERDUE = DEMO_TRANSACTIONS.filter(t => t.status === 'Borrowed');

    const DEMO_AUDIT_LOGS = [
        { timestamp: '12/03/2569 09:20', user: 'ระบบ', action: 'BORROW', details: 'นายสมชาย ขยันดี ยืม กพ.7-010' },
        { timestamp: '11/03/2569 16:00', user: 'ระบบ', action: 'RETURN', details: 'นางนิตยา รุ่งเรือง คืน กพ.7-009' },
        { timestamp: '11/03/2569 11:30', user: 'ระบบ', action: 'BORROW', details: 'นางนิตยา รุ่งเรือง ยืม กพ.7-009' },
        { timestamp: '11/03/2569 08:50', user: 'ระบบ', action: 'BORROW', details: 'นายธีรพงศ์ พัฒนา ยืม กพ.7-008' },
        { timestamp: '10/03/2569 14:45', user: 'ระบบ', action: 'BORROW', details: 'นางมาลี ศรีสุข ยืม กพ.7-007' },
        { timestamp: '10/03/2569 10:15', user: 'admin', action: 'LOGIN', details: 'เข้าสู่ระบบสำเร็จ' },
    ];
    // ===== END DEMO MODE =====

    useEffect(() => {
        if (isDemo) {
            // Demo mode: use fake data, skip API calls
            setTransactions(DEMO_TRANSACTIONS);
            setFilteredTransactions(DEMO_TRANSACTIONS);
            setOverdueItems(DEMO_OVERDUE);
            setAuditLogs(DEMO_AUDIT_LOGS);
            setLastUpdated(new Date());
            setAllSchools([...new Set(DEMO_TRANSACTIONS.map(t => t.school))]);
            return;
        }
        loadData();
        loadSchools();
        loadOverdueItems();
        const interval = setInterval(() => {
            loadData();
            loadOverdueItems();
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (activeTab === 'reports') loadReports();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'audit') loadAuditLogs();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'users') loadUsers();
    }, [activeTab]);

    const loadData = async () => {
        try {
            const res = await fetchWithAuth(`/api/transactions?_t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (res.status === 401) {
                setTransactions([]);
                setFilteredTransactions([]);
                return;
            }
            if (!res.ok) {
                const text = await res.text();
                console.error('Fetch error:', text);
                return;
            }
            const errMsg = res.headers.get('X-Data-Error');
            if (errMsg) setDataLoadError(errMsg);
            else setDataLoadError('');
            const data = await res.json();
            const sorted = Array.isArray(data) ? data : [];
            setTransactions(sorted);
            setFilteredTransactions(sorted);
            setLastUpdated(new Date());
            setSelectedItems(new Set());
        } catch (err) {
            console.error('Load data error:', err);
            const msg = err.message || 'ไม่สามารถโหลดข้อมูลได้';
            if (msg === 'Unauthorized' || msg === 'No token found') return;
            const hint = (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
                ? ' — ตรวจสอบว่าเปิด API แล้วหรือยัง'
                : '';
            setDataLoadError(msg + hint);
        }
    };

    const loadSchools = async () => {
        try {
            const res = await fetch(`/api/schools?_t=${Date.now()}`);
            const data = await res.json();
            setAllSchools(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadReports = async () => {
        try {
            const res = await fetchWithAuth(`/api/reports/summary?period=month&_t=${Date.now()}`);
            const data = await res.json();
            setReportData(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadAuditLogs = async () => {
        try {
            const res = await fetchWithAuth(`/api/audit-log?_t=${Date.now()}`);
            const data = await res.json();
            setAuditLogs(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadOverdueItems = async () => {
        try {
            const res = await fetchWithAuth(`/api/reminders/overdue?_t=${Date.now()}`);
            const data = await res.json();
            setOverdueItems(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadUsers = async () => {
        try {
            const res = await fetchWithAuth(`/api/users?_t=${Date.now()}`);
            const data = await res.json();
            setUsers(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveUser = async () => {
        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
            const method = editingUser ? 'PUT' : 'POST';

            const res = await fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userForm)
            });

            if (res.ok) {
                alert('บันทึกสำเร็จ');
                setShowUserForm(false);
                setEditingUser(null);
                setUserForm({ username: '', password: '', role: 'user', email: '', name: '' });
                loadUsers();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาด');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('ยืนยันการลบผู้ใช้?')) return;

        try {
            const res = await fetchWithAuth(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert('ลบสำเร็จ');
                loadUsers();
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาด');
        }
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setUserForm({
            username: user.username,
            password: '',
            role: user.role,
            email: user.email || '',
            name: user.name || ''
        });
        setShowUserForm(true);
    };

    const handleSendOverdueNotifications = async () => {
        if (!confirm('ส่งอีเมลแจ้งเตือนรายการค้างส่งทั้งหมด?')) return;

        try {
            const res = await fetchWithAuth('/api/email/notify-overdue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            alert(`ส่งอีเมลสำเร็จ ${result.results?.filter(r => r.success).length || 0} ฉบับ`);
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาด');
        }
    };

    const handleExportExcel = () => {
        const params = new URLSearchParams();
        if (dateFilter.start) params.append('startDate', dateFilter.start);
        if (dateFilter.end) params.append('endDate', dateFilter.end);
        if (schoolFilter) params.append('school', schoolFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);

        window.open(`/api/export/excel?${params.toString()}`, '_blank');
    };

    const handleExportPDF = () => {
        const params = new URLSearchParams();
        if (dateFilter.start) params.append('startDate', dateFilter.start);
        if (dateFilter.end) params.append('endDate', dateFilter.end);
        if (schoolFilter) params.append('school', schoolFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);

        window.open(`/api/export/pdf?${params.toString()}`, '_blank');
    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        applyFilters(query);
    };

    const applyFilters = (searchQuery = '') => {
        let filtered = [...transactions];

        // Text search
        if (searchQuery) {
            filtered = filtered.filter(item => {
                const school = (item.school || '').toLowerCase();
                const name = (item.name || item.personnelName || '').toLowerCase();
                const reason = (item.reason || '').toLowerCase();
                return school.includes(searchQuery) || name.includes(searchQuery) || reason.includes(searchQuery);
            });
        }

        // Date filter
        if (dateFilter.start || dateFilter.end) {
            filtered = filtered.filter(item => {
                const txDate = parseThaiDate(item.timestamp);
                if (!txDate) return false;
                if (dateFilter.start && txDate < new Date(dateFilter.start)) return false;
                if (dateFilter.end && txDate > new Date(dateFilter.end)) return false;
                return true;
            });
        }

        // School filter
        if (schoolFilter) {
            filtered = filtered.filter(item => item.school === schoolFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        setFilteredTransactions(filtered);
        setCurrentPage(1);
        setSelectedItems(new Set());
    };

    const parseThaiDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            const parts = dateStr.split(' ')[0].split('/');
            if (parts.length === 3) {
                return new Date(parts[2] - 543, parts[1] - 1, parts[0]);
            }
        } catch (e) { }
        return null;
    };

    useEffect(() => {
        applyFilters(searchTerm);
    }, [dateFilter, schoolFilter, statusFilter, transactions]);

    // Bulk Selection Logic
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Select all currently filtered items that are 'Borrowed'
            const borrowIds = new Set(
                filteredTransactions
                    .filter(item => item.status === 'Borrowed')
                    .map(item => item.rowIndex)
            );
            setSelectedItems(borrowIds);
        } else {
            setSelectedItems(new Set());
        }
    };

    const handleSelectItem = (rowIndex) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(rowIndex)) newSet.delete(rowIndex);
        else newSet.add(rowIndex);
        setSelectedItems(newSet);
    };

    const handleBulkReturn = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`ยืนยันคืนของทั้งหมด ${selectedItems.size} รายการ?`)) return;

        try {
            const res = await fetchWithAuth('/api/bulk-return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndices: Array.from(selectedItems) })
            });
            const result = await res.json();
            if (result.success) {
                alert('คืนของเรียบร้อยแล้ว!');
                loadData();
            } else alert('Error: ' + result.error);
        } catch (err) {
            alert('Server error');
        }
    };

    const handleReturn = async (rowIndex) => {
        if (!confirm('ยืนยันว่ารายการนี้คืนของแล้ว?')) return;
        try {
            const res = await fetchWithAuth('/api/return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex })
            });
            const result = await res.json();
            if (result.success) loadData();
            else alert('Error: ' + result.error);
        } catch (err) {
            alert('Server error');
        }
    };

    const handleDelete = async (rowIndex) => {
        if (!confirm('⚠️ คำเตือน: คุณต้องการ "ลบ" รายการนี้อย่างถาวรใช่หรือไม่?\n(ข้อมูลใน Google Sheet จะหายไปเลย กู้คืนไม่ได้)')) return;

        // Double confirm
        if (!confirm('ยืนยันเป็นครั้งสุดท้าย ลบจริงหรือไม่?')) return;

        try {
            const res = await fetchWithAuth('/api/delete-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndex })
            });
            const result = await res.json();
            if (result.success) {
                alert('ลบรายการเรียบร้อยแล้ว');
                loadData();
            } else alert('Error: ' + result.error);
        } catch (err) {
            alert('Server error');
        }
    };

    const handleCleanData = async () => {
        if (!confirm('ต้องการจัดระเบียบข้อมูล "เหตุผลการยืม" อัตโนมัติหรือไม่?')) return;
        try {
            const res = await fetchWithAuth('/api/clean-reasons', {
                method: 'POST'
            });
            const result = await res.json();
            if (result.success) {
                alert(`จัดระเบียบเรียบร้อย! แก้ไขไปทั้งหมด ${result.updatedCount} รายการ`);
                loadData();
            } else alert('Error: ' + result.error);
        } catch (err) {
            alert('Server error');
        }
    };

    // Stats
    const total = transactions.length;
    const active = transactions.filter(i => i.status === 'Borrowed').length;
    const returned = total - active;

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
    const startIdx = (currentPage - 1) * rowsPerPage;
    const currentItems = filteredTransactions.slice(startIdx, startIdx + rowsPerPage);

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 7; // Show max 7 page numbers

        if (totalPages <= maxVisible) {
            // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show smart pagination with ellipsis
            if (currentPage <= 4) {
                // Show first pages
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                // Show last pages
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                // Show middle pages
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    // Chart Options based on Theme
    const getChartOptions = () => {
        const textColor = theme === 'dark' ? '#e0e0e0' : '#333333';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            },
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            }
        };
    };

    // Charts Data Preparation
    // ... (rest of the file remains same, need to update table rendering below handles)

    // ... inside return ...


    // Charts Data Preparation
    const prepareTrendData = () => {
        const trendData = {};
        const labels = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let startDate = new Date(today);
        let granularity = 'day';

        if (trendRange === '7D') startDate.setDate(today.getDate() - 6);
        else if (trendRange === '1M') startDate.setDate(today.getDate() - 29);
        else if (trendRange === '1Y') {
            startDate.setFullYear(today.getFullYear() - 1);
            startDate.setDate(1);
            granularity = 'month';
        } else if (trendRange === 'ALL') {
            startDate = new Date(0);
            granularity = 'month';
        }

        // Helper to parse Thai Date
        const parseThaiDate = (ts) => {
            if (!ts) return null;
            try {
                const parts = ts.split(' ')[0].split('/');
                if (parts.length === 3) {
                    return new Date(parts[2] - 543, parts[1] - 1, parts[0]);
                }
            } catch (e) { }
            return null;
        };

        if (granularity === 'day') {
            let d = new Date(startDate);
            while (d <= today) {
                const str = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                labels.push(str);
                trendData[str] = 0;
                d.setDate(d.getDate() + 1);
            }
        } else {
            if (trendRange === 'ALL' && transactions.length > 0) {
                let minDate = today;
                transactions.forEach(i => {
                    const d = parseThaiDate(i.timestamp);
                    if (d && d < minDate) minDate = d;
                });
                startDate = new Date(minDate);
                startDate.setDate(1);
            }
            let d = new Date(startDate);
            const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            while (d <= endMonth) {
                const str = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                if (!labels.includes(str)) {
                    labels.push(str);
                    trendData[str] = 0;
                    d.setMonth(d.getMonth() + 0); // Correct logic for loop
                }
                d.setMonth(d.getMonth() + 1);
            }
        }

        transactions.forEach(i => {
            const d = parseThaiDate(i.timestamp);
            if (!d || d < startDate) return;
            let key;
            if (granularity === 'day') key = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            else key = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
            if (trendData.hasOwnProperty(key)) trendData[key]++;
        });

        return {
            labels,
            datasets: [{
                label: 'จำนวนรายการที่ยืม',
                data: labels.map(l => trendData[l]),
                borderColor: '#3498db',
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.5)');
                    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.0)');
                    return gradient;
                },
                fill: true,
                tension: 0.4
            }]
        };
    };

    const prepareDoughnutData = (field) => {
        const counts = {};
        transactions.forEach(i => {
            const val = i[field] || 'ไม่ระบุ';
            counts[val] = (counts[val] || 0) + 1;
        });
        // Sort
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(x => x[0]);
        const data = sorted.map(x => x[1]);
        const colors = [
            '#9b59b6', '#3498db', '#e67e22', '#2ecc71', '#f1c40f', '#e74c3c', '#34495e',
            '#1abc9c', '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
        ];

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 10
            }],
            // Custom property for legend rendering
            rawCounts: sorted,
            colors: colors
        };
    };

    const reasonData = prepareDoughnutData('reason');
    const schoolData = prepareDoughnutData('school');
    const positionData = prepareDoughnutData('position');

    // Custom Legend Component
    const CustomLegend = ({ data }) => (
        <div className="custom-legend">
            {data.rawCounts.map((item, idx) => {
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                const percent = Math.round((item[1] / total) * 100);
                return (
                    <div key={idx} className="legend-item">
                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                            <span className="legend-color" style={{ backgroundColor: data.colors[idx % data.colors.length] }}></span>
                            <span className="legend-label" title={item[0]}>{item[0]}</span>
                        </div>
                        <span className="legend-value">{item[1]} ({percent}%)</span>
                    </div>
                );
            })}
        </div>
    );

    // Dashboard View
    // ... (existing code)

    return (
        <div className="dashboard-layout">
            {/* Mobile Sidebar Overlay */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            ></div>

            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    {!sidebarCollapsed && <span>KP.7 System</span>}
                    {sidebarCollapsed && <span>KP7</span>}
                </div>
                <nav className="sidebar-menu">
                    <div className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} title="Dashboard">
                        <LayoutDashboard size={20} />
                        <span className="menu-label">Dashboard</span>
                    </div>
                    <div className={`menu-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }} title="Dashboard & Analytics">
                        <BarChart3 size={20} />
                        <span className="menu-label">Dashboard & Analytics</span>
                    </div>
                    <div className={`menu-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => { setActiveTab('audit'); setIsSidebarOpen(false); }} title="Audit Log">
                        <ScrollText size={20} />
                        <span className="menu-label">Audit Log</span>
                    </div>
                    <div className={`menu-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} title="User Management">
                        <Users size={20} />
                        <span className="menu-label">User Management</span>
                    </div>
                    <Link to="/" className="menu-item" title="กลับหน้าหลัก">
                        <Home size={20} />
                        <span className="menu-label">กลับหน้าหลัก</span>
                    </Link>
                    <div className="menu-item" title="ออกจากระบบ" onClick={() => {
                        if (window.confirm('ต้องการออกจากระบบ?')) {
                            sessionStorage.removeItem('adminToken');
                            navigate('/login');
                        }
                    }} style={{ color: '#e74c3c' }}>
                        <LogOut size={20} />
                        <span className="menu-label">ออกจากระบบ</span>
                    </div>
                </nav>
                <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'ขยาย' : 'ย่อ'}>
                    {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    {!sidebarCollapsed && <span className="menu-label">ย่อเมนู</span>}
                </button>
                <div className="sidebar-footer">{!sidebarCollapsed && <span>&copy; 2025 KP.7 Admin</span>}</div>
            </aside>

            <main className="main-content">
                <div className="top-bar">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {/* Hamburger Button */}
                        <button className="hamburger-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                            ☰
                        </button>
                        <h1 className="page-title">
                            {activeTab === 'dashboard' ? 'ภาพรวม (Dashboard)' :
                                activeTab === 'analytics' ? 'สถิติ (Analytics)' :
                                    activeTab === 'reports' ? 'รายงาน (Reports)' :
                                        activeTab === 'audit' ? 'Audit Log' :
                                            activeTab === 'users' ? 'User Management' : 'Dashboard'}
                        </h1>
                        {overdueItems.length > 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                background: '#e74c3c',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '0.9rem'
                            }}>
                                <AlertCircle size={16} />
                                <span>มีรายการค้างส่ง {overdueItems.length} รายการ</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <ThemeToggle />
                        <div className="user-info" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Refresh Indicator */}
                            {lastUpdated && (
                                <span style={{ fontSize: '0.8rem', color: '#2ecc71' }}>
                                    <span style={{ marginRight: '5px' }}>●</span>
                                    {lastUpdated.toLocaleTimeString('th-TH')}
                                </span>
                            )}

                            <span style={{ display: window.innerWidth > 768 ? 'block' : 'none' }}>Admin</span>
                            <button
                                onClick={() => { loadData(); loadOverdueItems(); }}
                                style={{
                                    background: 'var(--card-bg)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-color)',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                รีเฟรช
                            </button>
                        </div>
                    </div>
                </div>

                <div className="content-scroll">
                    {activeTab === 'dashboard' && (
                        <div id="dashboardView">
                            {dataLoadError && (
                                <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#fef3cd', border: '1px solid #ffc107', borderRadius: '8px', color: '#856404' }}>
                                    ไม่สามารถโหลดข้อมูลได้: {dataLoadError}
                                </div>
                            )}
                            <div className="stats-grid">
                                {/* ... (Existing Stats Cards) ... */}
                                <div className="stat-card" style={{ borderLeftColor: '#3498db' }}>
                                    <div className="stat-info">
                                        <h3>{total}</h3>
                                        <p>รายการทั้งหมด</p>
                                    </div>
                                </div>
                                <div className="stat-card" style={{ borderLeftColor: '#e67e22' }}>
                                    <div className="stat-info">
                                        <h3>{active}</h3>
                                        <p>ค้างส่ง (Active)</p>
                                    </div>
                                </div>
                                <div className="stat-card" style={{ borderLeftColor: '#2ecc71' }}>
                                    <div className="stat-info">
                                        <h3>{returned}</h3>
                                        <p>คืนแล้ว (Returned)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="table-container">
                                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '8px 14px', borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--card-bg)', color: 'var(--text-color)',
                                                cursor: 'pointer', fontSize: '0.9rem'
                                            }}
                                        >
                                            <Settings size={16} /> คอลัมน์
                                        </button>
                                        {showColumnMenu && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                                                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                                                borderRadius: '8px', boxShadow: '0 4px 12px var(--shadow-color)',
                                                zIndex: 50, padding: '8px 0', minWidth: '180px'
                                            }}>
                                                {allColumns.map(col => (
                                                    <label key={col.key} style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        padding: '6px 14px', cursor: 'pointer', fontSize: '0.9rem',
                                                        color: 'var(--text-color)'
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns.has(col.key)}
                                                            onChange={() => toggleColumn(col.key)}
                                                        />
                                                        {col.label}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="ค้นหาชื่อ, โรงเรียน..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            handleSearch(e);
                                        }}
                                        className="form-control"
                                        style={{ maxWidth: '300px' }}
                                    />
                                </div>

                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        onChange={handleSelectAll}
                                                        checked={filteredTransactions.length > 0 && filteredTransactions
                                                            .filter(i => i.status === 'Borrowed')
                                                            .every(i => selectedItems.has(i.rowIndex)) && selectedItems.size > 0
                                                        }
                                                    />
                                                </th>
                                                {visibleColumns.has('timestamp') && <ResizableHeader>วันที่ยืม</ResizableHeader>}
                                                {visibleColumns.has('school') && <ResizableHeader>โรงเรียน</ResizableHeader>}
                                                {visibleColumns.has('name') && <ResizableHeader>ชื่อ-สกุล</ResizableHeader>}
                                                {visibleColumns.has('phone') && <ResizableHeader>เบอร์โทร</ResizableHeader>}
                                                {visibleColumns.has('position') && <ResizableHeader>ตำแหน่ง</ResizableHeader>}
                                                {visibleColumns.has('coordCenter') && <ResizableHeader>ศูนย์ฯ</ResizableHeader>}
                                                {visibleColumns.has('folderNo') && <ResizableHeader>เลขแฟ้ม</ResizableHeader>}
                                                {visibleColumns.has('reason') && <ResizableHeader>เหตุผล</ResizableHeader>}
                                                {visibleColumns.has('status') && <ResizableHeader>สถานะ</ResizableHeader>}
                                                <th>จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.map((item) => (
                                                <tr key={item.rowIndex} className={selectedItems.has(item.rowIndex) ? 'selected-row' : ''}>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {item.status === 'Borrowed' && (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(item.rowIndex)}
                                                                onChange={() => handleSelectItem(item.rowIndex)}
                                                            />
                                                        )}
                                                    </td>
                                                    {visibleColumns.has('timestamp') && <td data-label="วันที่ยืม">{item.timestamp ? item.timestamp.split(' ')[0] : '-'}</td>}
                                                    {visibleColumns.has('school') && <td data-label="โรงเรียน">{item.school}</td>}
                                                    {visibleColumns.has('name') && <td data-label="ชื่อ-สกุล">{item.name}</td>}
                                                    {visibleColumns.has('phone') && <td data-label="เบอร์โทร" style={{ color: '#3498db' }}>{item.phone || '-'}</td>}
                                                    {visibleColumns.has('position') && <td data-label="ตำแหน่ง">{item.position || '-'}</td>}
                                                    {visibleColumns.has('coordCenter') && <td data-label="ศูนย์ฯ" style={{ color: '#27ae60', fontWeight: 'bold' }}>{item.coordCenter}</td>}
                                                    {visibleColumns.has('folderNo') && <td data-label="เลขแฟ้ม" style={{ color: '#e67e22', fontWeight: 'bold' }}>{item.folderNo}</td>}
                                                    {visibleColumns.has('reason') && <td data-label="เหตุผล">{item.reason}</td>}
                                                    {visibleColumns.has('status') && (
                                                        <td data-label="สถานะ">
                                                            {item.status === 'Borrowed' ? (
                                                                <span className="status-badge status-borrowed">ค้างส่ง</span>
                                                            ) : (
                                                                <span className="status-badge status-returned">คืนแล้ว</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td data-label="จัดการ">
                                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                                                            {item.status === 'Borrowed' && (
                                                                <button onClick={() => handleReturn(item.rowIndex)} className="btn-action btn-return-action">คืนของ</button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDelete(item.rowIndex)}
                                                                className="btn-action btn-delete"
                                                                title="ลบรายการ"
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: '1px solid transparent',
                                                                    color: 'var(--text-muted)',
                                                                    padding: '6px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    transition: 'all 0.2s',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.color = '#e74c3c';
                                                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.color = 'var(--text-muted)';
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }}
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="pagination">
                                    <div className="pagination-left">
                                        <span className="page-info">
                                            แสดง {startIdx + 1} - {Math.min(startIdx + rowsPerPage, filteredTransactions.length)} จาก {filteredTransactions.length} รายการ
                                        </span>
                                        <select
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                setRowsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="rows-per-page-select"
                                            style={{
                                                marginLeft: '15px',
                                                padding: '6px 10px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--card-bg)',
                                                color: 'var(--text-color)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value={15}>15 ต่อหน้า</option>
                                            <option value={30}>30 ต่อหน้า</option>
                                            <option value={50}>50 ต่อหน้า</option>
                                            <option value={100}>100 ต่อหน้า</option>
                                        </select>
                                    </div>
                                    <div className="pagination-right">
                                        <button
                                            className="btn-page"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            title="หน้าแรก"
                                        >
                                            ««
                                        </button>
                                        <button
                                            className="btn-page"
                                            onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                                            disabled={currentPage === 1}
                                            title="หน้าก่อน"
                                        >
                                            ‹
                                        </button>

                                        {getPageNumbers().map((page, idx) => {
                                            if (page === '...') {
                                                return <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>;
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    className={`btn-page ${currentPage === page ? 'active' : ''}`}
                                                    onClick={() => setCurrentPage(page)}
                                                    title={`หน้า ${page}`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}

                                        <button
                                            className="btn-page"
                                            onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            title="หน้าถัดไป"
                                        >
                                            ›
                                        </button>
                                        <button
                                            className="btn-page"
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            title="หน้าสุดท้าย"
                                        >
                                            »»
                                        </button>
                                        <span className="page-total" style={{ marginLeft: '10px', color: 'var(--text-muted)' }}>
                                            หน้า {currentPage} / {totalPages || 1}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div id="analyticsView" className="charts-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {reportData && (
                                <div className="stats-grid" style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'
                                }}>
                                    <div className="stat-card glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                                        <h3 style={{ fontSize: '32px', color: '#3498db', margin: '0 0 8px 0' }}>{reportData.total}</h3>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>รายการยืมทั้งหมด</p>
                                    </div>
                                    <div className="stat-card glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                                        <h3 style={{ fontSize: '32px', color: '#e74c3c', margin: '0 0 8px 0' }}>{reportData.borrowed}</h3>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>ยังค้างส่ง</p>
                                    </div>
                                    <div className="stat-card glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                                        <h3 style={{ fontSize: '32px', color: '#2ecc71', margin: '0 0 8px 0' }}>{reportData.returned}</h3>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>คืนแล้ว</p>
                                    </div>
                                </div>
                            )}

                            <div className="glass-card">
                                <div className="chart-header">
                                    แนวโน้มการยืม
                                    <div className="filter-group">
                                        {['ALL', '1Y', '1M', '7D'].map(r => (
                                            <button key={r} className={`filter-btn ${trendRange === r ? 'active' : ''}`} onClick={() => setTrendRange(r)}>{r}</button>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ height: '300px' }}>
                                    <Line data={prepareTrendData()} options={getChartOptions()} />
                                </div>
                            </div>

                            <div className="charts-grid-layout">
                                <div className="glass-card">
                                    <div className="chart-header">สัดส่วนเหตุผลการยืม</div>
                                    <div className="chart-with-legend">
                                        <div className="chart-container">
                                            <Doughnut data={reasonData} options={{ cutout: '60%', plugins: { legend: { display: false } } }} />
                                        </div>
                                        <CustomLegend data={reasonData} />
                                    </div>
                                </div>
                                <div className="glass-card">
                                    <div className="chart-header">สัดส่วนโรงเรียนที่ยืม</div>
                                    <div className="chart-with-legend">
                                        <div className="chart-container">
                                            <Doughnut data={schoolData} options={{ cutout: '60%', plugins: { legend: { display: false } } }} />
                                        </div>
                                        <CustomLegend data={schoolData} />
                                    </div>
                                </div>
                                <div className="glass-card">
                                    <div className="chart-header">สัดส่วนตามตำแหน่ง (คนที่มายืม)</div>
                                    <div className="chart-with-legend">
                                        <div className="chart-container">
                                            <Doughnut data={positionData} options={{ cutout: '60%', plugins: { legend: { display: false } } }} />
                                        </div>
                                        <CustomLegend data={positionData} />
                                    </div>
                                </div>
                            </div>

                            {reportData && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '8px' }}>
                                    <div className="glass-card" style={{ padding: '24px' }}>
                                        <h3 style={{ marginBottom: '20px', fontSize: '16px', color: 'var(--text-color)' }}>รายการตามตำแหน่ง (Top 10)</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {(() => {
                                                const byPos = {};
                                                transactions.forEach(t => {
                                                    const p = t.position || '-';
                                                    byPos[p] = (byPos[p] || 0) + 1;
                                                });
                                                const sorted = Object.entries(byPos).sort((a, b) => b[1] - a[1]).slice(0, 10);
                                                const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
                                                return sorted.map(([pos, count]) => (
                                                    <div key={pos}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                                            <span>{pos}</span>
                                                            <span style={{ fontWeight: 'bold' }}>{count}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: '#9b59b6', borderRadius: '3px' }} />
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                    <div className="glass-card" style={{ padding: '24px' }}>
                                        <h3 style={{ marginBottom: '20px', fontSize: '16px', color: 'var(--text-color)' }}>รายการตามโรงเรียน (Top 10)</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {(() => {
                                                const sorted = Object.entries(reportData.bySchool).sort((a, b) => b[1] - a[1]).slice(0, 10);
                                                const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
                                                return sorted.map(([school, count]) => (
                                                    <div key={school}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>{school}</span>
                                                            <span style={{ fontWeight: 'bold' }}>{count}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: '#3498db', borderRadius: '3px' }} />
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                    <div className="glass-card" style={{ padding: '24px' }}>
                                        <h3 style={{ marginBottom: '20px', fontSize: '16px', color: 'var(--text-color)' }}>รายการตามเหตุผล (Top 10)</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {(() => {
                                                const sorted = Object.entries(reportData.byReason).sort((a, b) => b[1] - a[1]).slice(0, 10);
                                                const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
                                                return sorted.map(([reason, count]) => (
                                                    <div key={reason}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>{reason}</span>
                                                            <span style={{ fontWeight: 'bold' }}>{count}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: '#e67e22', borderRadius: '3px' }} />
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'audit' && (
                        <div id="auditView" className="glass-card" style={{ padding: '20px' }}>
                            <h2 style={{ marginBottom: '20px' }}>Audit Log</h2>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>วันที่/เวลา</th>
                                            <th>ผู้ใช้</th>
                                            <th>การกระทำ</th>
                                            <th>รายละเอียด</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogs.length > 0 ? (
                                            auditLogs.map((log, idx) => (
                                                <tr key={idx}>
                                                    <td>{log.timestamp}</td>
                                                    <td>{log.user}</td>
                                                    <td>{log.action}</td>
                                                    <td>{JSON.stringify(log.details)}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                                                    ยังไม่มีข้อมูล Audit Log
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div id="usersView" className="glass-card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2>User Management</h2>
                                <button
                                    onClick={() => {
                                        setShowUserForm(true);
                                        setEditingUser(null);
                                        setUserForm({ username: '', password: '', role: 'user', email: '', name: '' });
                                    }}
                                    className="btn-action"
                                    style={{ backgroundColor: '#3498db', color: 'white' }}
                                >
                                    + เพิ่มผู้ใช้
                                </button>
                            </div>

                            {showUserForm && (
                                <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', background: 'var(--card-bg)' }}>
                                    <h3>{editingUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            value={userForm.username}
                                            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                        />
                                        <input
                                            type="password"
                                            placeholder={editingUser ? 'Password (เว้นว่างถ้าไม่เปลี่ยน)' : 'Password'}
                                            value={userForm.password}
                                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                        />
                                        <select
                                            value={userForm.role}
                                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            value={userForm.email}
                                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Name"
                                            value={userForm.name}
                                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                        <button onClick={handleSaveUser} className="btn-action" style={{ backgroundColor: '#2ecc71', color: 'white' }}>
                                            บันทึก
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowUserForm(false);
                                                setEditingUser(null);
                                            }}
                                            className="btn-action"
                                            style={{ backgroundColor: '#95a5a6', color: 'white' }}
                                        >
                                            ยกเลิก
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Username</th>
                                            <th>Role</th>
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length > 0 ? (
                                            users.map((user) => (
                                                <tr key={user.id}>
                                                    <td>{user.username}</td>
                                                    <td><span className={`status-badge ${user.role === 'admin' ? 'status-borrowed' : 'status-returned'}`}>{user.role}</span></td>
                                                    <td>{user.email || '-'}</td>
                                                    <td>{user.name || '-'}</td>
                                                    <td>
                                                        <button
                                                            onClick={() => handleEditUser(user)}
                                                            className="btn-action"
                                                            style={{ marginRight: '5px', padding: '4px 8px', fontSize: '0.8rem' }}
                                                        >
                                                            แก้ไข
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="btn-action"
                                                            style={{ backgroundColor: '#e74c3c', color: 'white', padding: '4px 8px', fontSize: '0.8rem' }}
                                                        >
                                                            ลบ
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                                                    ยังไม่มีผู้ใช้
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {overdueItems.length > 0 && (
                                <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '8px' }}>
                                    <h3>แจ้งเตือนรายการค้างส่ง</h3>
                                    <p>มีรายการค้างส่ง {overdueItems.length} รายการ</p>
                                    <button
                                        onClick={handleSendOverdueNotifications}
                                        className="btn-action"
                                        style={{ backgroundColor: '#e74c3c', color: 'white', marginTop: '10px' }}
                                    >
                                        ส่งอีเมลแจ้งเตือนทั้งหมด
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
