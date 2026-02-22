import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { Search, CheckCircle } from 'lucide-react';

const ReturnForm = () => {
    const [borrows, setBorrows] = useState([]);
    const [filteredBorrows, setFilteredBorrows] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetch('/api/active-borrows')
            .then(res => res.json())
            .then(data => {
                setBorrows(data);
                setFilteredBorrows(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchTerm(query);
        const filtered = borrows.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.school.toLowerCase().includes(query)
        );
        setFilteredBorrows(filtered);
        // Optional: Clear selection on search or keep it? 
        // Better UX to keep selection if possible, but for simplicity let's keep it.
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = new Set(filteredBorrows.map(item => item.rowIndex));
            setSelectedItems(allIds);
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

    const handleSubmit = async () => {
        if (selectedItems.size === 0) {
            alert('กรุณาเลือกรายการที่จะคืน');
            return;
        }
        if (!confirm(`ยืนยันคืน กพ.7 จำนวน ${selectedItems.size} รายการ?`)) return;

        try {
            const res = await fetch('/api/bulk-return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIndices: Array.from(selectedItems) })
            });
            const result = await res.json();
            if (result.success) {
                alert('บันทึกการคืนเรียบร้อยแล้ว!');
                navigate('/');
            } else {
                alert('เกิดข้อผิดพลาด: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
    };

    const isAllSelected = filteredBorrows.length > 0 && filteredBorrows.every(item => selectedItems.has(item.rowIndex));

    return (
        <div className="container" style={{ position: 'relative', maxWidth: '800px' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <ThemeToggle />
            </div>

            <h1 style={{ marginBottom: '10px' }}>แจ้งคืน กพ.7</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>ค้นหาชื่อของคุณและเลือกรายการที่ต้องการคืน</p>

            <div className="glass-card" style={{ padding: '20px' }}>
                {/* Search Box */}
                <div className="form-group" style={{ position: 'relative' }}>
                    <Search size={20} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="พิมพ์ชื่อ หรือ โรงเรียน เพื่อค้นหา..."
                        value={searchTerm}
                        onChange={handleSearch}
                        style={{ paddingLeft: '45px' }}
                    />
                </div>

                {/* Header Controls */}
                {!loading && filteredBorrows.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                                style={{ width: '18px', height: '18px' }}
                            />
                            <span style={{ fontWeight: 600 }}>เลือกทั้งหมด ({filteredBorrows.length})</span>
                        </label>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            เลือกแล้ว: <strong style={{ color: 'var(--accent-color)' }}>{selectedItems.size}</strong> รายการ
                        </span>
                    </div>
                )}

                {/* List */}
                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>กำลังโหลดรายการค้างคืน...</div>
                    ) : filteredBorrows.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            {searchTerm ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีรายการค้างคืนในระบบ'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredBorrows.map(item => (
                                <div
                                    key={item.rowIndex}
                                    className={`borrow-item-card ${selectedItems.has(item.rowIndex) ? 'selected' : ''}`}
                                    onClick={() => handleSelectItem(item.rowIndex)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '15px',
                                        padding: '15px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        background: selectedItems.has(item.rowIndex) ? 'rgba(52, 152, 219, 0.1)' : 'var(--card-bg)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        borderColor: selectedItems.has(item.rowIndex) ? 'var(--accent-color)' : 'var(--border-color)'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.has(item.rowIndex)}
                                        onChange={() => { }} // Handled by parent div click
                                        style={{ width: '20px', height: '20px', flexShrink: 0, pointerEvents: 'none' }} // Prevent double trigger
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-color)' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {item.school} • ยืมเมื่อ: {item.timestamp}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <div style={{ marginTop: '20px' }}>
                    <button
                        onClick={handleSubmit}
                        className="btn-submit"
                        disabled={selectedItems.size === 0}
                        style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: selectedItems.size > 0 ? '#2ecc71' : 'var(--border-color)',
                            cursor: selectedItems.size > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        <CheckCircle size={20} />
                        คืน กพ.7 ({selectedItems.size})
                    </button>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link to="/" className="back-link">← กลับหน้าหลัก</Link>
            </div>

            <style>{`
                .borrow-item-card:hover {
                    border-color: var(--accent-color) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
            `}</style>
        </div>
    );
};

export default ReturnForm;
