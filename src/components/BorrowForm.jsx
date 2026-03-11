import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const BorrowForm = () => {
    // Core State
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);

    // Selection State
    // No more selectedSchool lock. selectedPersonnel is now an array of objects: { name, school, ... }
    const [selectedPersonnel, setSelectedPersonnel] = useState([]);



    // Reason State
    const [reasons, setReasons] = useState([]);
    const [otherReason, setOtherReason] = useState('');
    const [isOtherReasonChecked, setIsOtherReasonChecked] = useState(false);

    const navigate = useNavigate();

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (globalSearchQuery.trim().length >= 2) {
                performSearch(globalSearchQuery);
            } else {
                setSearchResults([]);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [globalSearchQuery]);

    const performSearch = async (query) => {
        setLoadingSearch(true);
        try {
            const res = await fetch(`/api/search-personnel?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleSelectPerson = (person) => {
        // Check duplication
        const exists = selectedPersonnel.some(p => p.name === person.name && p.school === person.school);
        if (exists) {
            // Optional: Alert or just ignore
            setGlobalSearchQuery('');
            setSearchResults([]);
            return;
        }

        setSelectedPersonnel([...selectedPersonnel, { ...person, isManual: false }]);
        setGlobalSearchQuery('');
        setSearchResults([]);
    };

    const handleRemovePerson = (index) => {
        const newSelection = [...selectedPersonnel];
        newSelection.splice(index, 1);
        setSelectedPersonnel(newSelection);
    };

    const handleReasonChange = (e) => {
        const { value, checked } = e.target;
        if (value === 'other') {
            setIsOtherReasonChecked(checked);
            if (!checked) setOtherReason('');
        } else {
            if (checked) {
                setReasons([...reasons, value]);
            } else {
                setReasons(reasons.filter(r => r !== value));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (selectedPersonnel.length === 0) {
            alert('กรุณาเลือกรายชื่ออย่างน้อย 1 คน');
            return;
        }

        let finalReasons = [...reasons];
        if (isOtherReasonChecked && otherReason.trim()) {
            finalReasons.push(otherReason.trim());
        }

        if (finalReasons.length === 0) {
            alert('กรุณาระบุเหตุผลการขออย่างน้อย 1 ข้อ');
            return;
        }

        try {
            const res = await fetch('/api/borrow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: selectedPersonnel, // Send full objects with names and schools
                    reason: finalReasons.join(', ')
                })
            });
            const result = await res.json();
            if (result.success) {
                alert(`บันทึกข้อมูลเรียบร้อย! (${selectedPersonnel.length} รายการ)`);
                navigate('/');
            } else {
                alert('เกิดข้อผิดพลาดในการบันทึก');
            }
        } catch (err) {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
    };

    return (
        <div className="container" style={{ position: 'relative', maxWidth: '800px', paddingBottom: '100px' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <ThemeToggle />
            </div>
            <h1>ยืม กพ.7</h1>

            {/* 1. Global Search Section */}
            <div className="form-group" style={{ marginBottom: '30px' }}>
                <label style={{ fontSize: '1.2rem', marginBottom: '10px', display: 'block' }}>
                    1. ค้นหารายชื่อ (ไม่จำกัดโรงเรียน)
                </label>
                <div style={{ position: 'relative', display: 'flex', gap: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            placeholder="พิมพ์ชื่อคุณครู (ไม่ต้องระบุคำนำหน้า)... เช่น สมชาย"
                            value={globalSearchQuery}
                            onChange={(e) => setGlobalSearchQuery(e.target.value)}
                            className="form-control"
                            style={{
                                fontSize: '1.1rem',
                                padding: '14px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        />
                        {loadingSearch && (
                            <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)' }}>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                    <div style={{
                        marginTop: '10px',
                        background: 'var(--card-bg)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-color)',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        <div style={{ padding: '8px 16px', background: 'var(--header-bg)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            ผลการค้นหา {searchResults.length} รายการ
                        </div>
                        {searchResults.map(person => (
                            <div
                                key={`${person.school}-${person.id}`}
                                onClick={() => handleSelectPerson(person)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--input-bg)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{person.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        {person.position} • <span style={{ color: 'var(--primary-color)' }}>{person.school}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: '1.5rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>+</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                {/* 2. Selected Personnel Display */}
                {selectedPersonnel.length > 0 && (
                    <div className="form-group slide-in-up">
                        <label>2. รายการที่เลือก ({selectedPersonnel.length} คน)</label>
                        <div style={{
                            background: 'var(--card-bg)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden'
                        }}>
                            {selectedPersonnel.map((person, index) => (
                                <div key={person.name + index} style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                                            {index + 1}. {person.name}
                                            {person.isManual && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#ffc107', color: 'black', padding: '2px 6px', borderRadius: '4px' }}>พิมพ์เอง</span>}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {person.school}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePerson(index)}
                                        style={{
                                            background: '#ffefef',
                                            border: '1px solid #ffcccc',
                                            borderRadius: '6px',
                                            padding: '6px 12px',
                                            color: '#d9534f',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        ลบ
                                    </button>
                                </div>
                            ))}
                            {/* Clear All */}
                            <div style={{ padding: '10px', textAlign: 'center', background: 'rgba(0,0,0,0.03)' }}>
                                <button type="button" onClick={() => setSelectedPersonnel([])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
                                    ล้างรายการทั้งหมด
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Reasons */}
                {selectedPersonnel.length > 0 && (
                    <div className="form-group slide-in-up" style={{ animationDelay: '0.1s' }}>
                        <label>3. ระบุเหตุผลการขอยืม</label>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                                {['ขอใบอนุญาตประกอบวิชาชีพ', 'ขอเลื่อนวิทยฐานะ', 'ประกอบคำร้องขอย้าย', 'ขอมีเครื่องราชอิสริยาภรณ์', 'ขอสมัครงาน', 'ขอลาออก', 'สมัครสมาชิกสหกรณ์ออมทรัพย์ครู', 'ส่งผลงาน', 'ส่งครูดีเด่น', 'ส่งข้าราชการดีเด่น', 'แนบสรุปครูผู้ช่วย ก.พ.7'].map(r => (
                                    <label key={r} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: reasons.includes(r) ? '1px solid var(--primary-color)' : '1px solid transparent',
                                        background: reasons.includes(r) ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="checkbox"
                                            value={r}
                                            onChange={handleReasonChange}
                                            checked={reasons.includes(r)}
                                            style={{ width: '18px', height: '18px', marginRight: '10px', accentColor: 'var(--primary-color)' }}
                                        />
                                        {r}
                                    </label>
                                ))}
                            </div>
                            <div style={{ marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                                <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="checkbox"
                                        value="other"
                                        onChange={handleReasonChange}
                                        checked={isOtherReasonChecked}
                                        style={{ width: '18px', height: '18px', marginRight: '10px', accentColor: 'var(--primary-color)' }}
                                    />
                                    เหตุผลอื่นๆ:
                                    <input
                                        type="text"
                                        className="form-control"
                                        style={{ marginLeft: '10px', flex: 1, padding: '8px' }}
                                        placeholder="โปรดระบุ"
                                        disabled={!isOtherReasonChecked}
                                        value={otherReason}
                                        onChange={(e) => setOtherReason(e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit */}
                {selectedPersonnel.length > 0 && (
                    <button type="submit" className="btn-submit slide-in-up" style={{ animationDelay: '0.2s', marginTop: '20px' }}>
                        บันทึกการยืม ({selectedPersonnel.length} ท่าน)
                    </button>
                )}
            </form>
            <Link to="/" className="back-link">กลับหน้าหลัก</Link>

            {/* Simple CSS animation style for slide-in */}
            <style>{`
                @keyframes slideInUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .slide-in-up {
                    animation: slideInUp 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default BorrowForm;
