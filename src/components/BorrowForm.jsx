import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { Search, Building2, Users, Check, X, Plus, Trash2, CheckCircle2 } from 'lucide-react';

const BorrowForm = () => {
    // 1. Search Query & Data
    const [searchQuery, setSearchQuery] = useState('');
    const [schools, setSchools] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // 2. Active School Selection (เมื่อผู้ใช้เลือกหรือพิมพ์ตรงชื่อโรงเรียน)
    const [activeSchool, setActiveSchool] = useState('');
    const [schoolPersonnel, setSchoolPersonnel] = useState([]);
    const [loadingPersonnel, setLoadingPersonnel] = useState(false);

    // Selection choice: 'all' (เลือกครูทั้งหมดในโรงเรียน) vs 'partial' (เลือกเฉพาะบางรายชื่อ)
    const [selectionScope, setSelectionScope] = useState('all');
    const [selectedTeacherIds, setSelectedTeacherIds] = useState(new Set());
    const [teacherFilterQuery, setTeacherFilterQuery] = useState('');
    const [addFeedback, setAddFeedback] = useState('');

    // 3. Overall Selected Personnel (Cart)
    const [selectedPersonnel, setSelectedPersonnel] = useState([]);

    // 4. Reason State
    const [reasons, setReasons] = useState([]);
    const [otherReason, setOtherReason] = useState('');
    const [isOtherReasonChecked, setIsOtherReasonChecked] = useState(false);

    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    // Load Schools on Mount
    useEffect(() => {
        fetch('/api/schools')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setSchools(data);
            })
            .catch(err => console.error('Error fetching schools:', err));
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter matching schools from client-side schools list
    const matchingSchools = useMemo(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 1) return [];
        const q = searchQuery.trim().toLowerCase();
        return schools.filter(s => s.toLowerCase().includes(q));
    }, [schools, searchQuery]);

    // Debounced search for teachers/personnel from API
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) {
                performSearch(searchQuery.trim());
                setShowDropdown(true);
            } else {
                setSearchResults([]);
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const performSearch = async (query) => {
        setLoadingSearch(true);
        try {
            const res = await fetch(`/api/search-personnel?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoadingSearch(false);
        }
    };

    // Load Personnel when a school is chosen
    const handleSelectSchool = async (schoolName) => {
        setActiveSchool(schoolName);
        setShowDropdown(false);
        setTeacherFilterQuery('');
        setAddFeedback('');
        setLoadingPersonnel(true);

        try {
            const res = await fetch(`/api/personnel/${encodeURIComponent(schoolName)}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                setSchoolPersonnel(data);
                // Default: select all teachers
                const allIds = new Set(data.map(p => p.id));
                setSelectedTeacherIds(allIds);
                setSelectionScope('all');
            } else {
                setSchoolPersonnel([]);
                setSelectedTeacherIds(new Set());
            }
        } catch (err) {
            console.error('Error loading personnel:', err);
            setSchoolPersonnel([]);
            setSelectedTeacherIds(new Set());
        } finally {
            setLoadingPersonnel(false);
        }
    };

    // Add directly from search result (single person)
    const handleSelectPersonDirect = (person) => {
        const exists = selectedPersonnel.some(p => p.name === person.name && p.school === person.school);
        if (exists) {
            alert(`มีรายชื่อ ${person.name} อยู่ในรายการแล้ว`);
            return;
        }

        setSelectedPersonnel([...selectedPersonnel, { ...person, isManual: false }]);
        setAddFeedback(`เพิ่ม ${person.name} เรียบร้อยแล้ว`);
        setTimeout(() => setAddFeedback(''), 3000);
        setShowDropdown(false);
    };

    // Switch between 'all' and 'partial'
    const handleScopeChange = (newScope) => {
        setSelectionScope(newScope);
        if (newScope === 'all') {
            setSelectedTeacherIds(new Set(schoolPersonnel.map(p => p.id)));
        }
    };

    // Toggle individual teacher in partial mode
    const handleToggleTeacher = (id) => {
        const next = new Set(selectedTeacherIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedTeacherIds(next);
    };

    // Filter teachers in selected school
    const filteredSchoolPersonnel = useMemo(() => {
        if (!teacherFilterQuery.trim()) return schoolPersonnel;
        const q = teacherFilterQuery.trim().toLowerCase();
        return schoolPersonnel.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.position && p.position.toLowerCase().includes(q))
        );
    }, [schoolPersonnel, teacherFilterQuery]);

    // Add selected teachers from active school to borrow list
    const handleAddSchoolTeachersToBorrow = () => {
        const teachersToAdd = selectionScope === 'all'
            ? schoolPersonnel
            : schoolPersonnel.filter(p => selectedTeacherIds.has(p.id));

        if (teachersToAdd.length === 0) {
            alert('กรุณาเลือกรายชื่อครูอย่างน้อย 1 คน');
            return;
        }

        let addedCount = 0;
        const updated = [...selectedPersonnel];

        teachersToAdd.forEach(teacher => {
            const exists = updated.some(p => p.name === teacher.name && p.school === activeSchool);
            if (!exists) {
                updated.push({
                    id: `${activeSchool}-${teacher.id}`,
                    name: teacher.name,
                    position: teacher.position || '',
                    school: activeSchool,
                    isManual: false
                });
                addedCount++;
            }
        });

        setSelectedPersonnel(updated);
        const skipped = teachersToAdd.length - addedCount;
        setAddFeedback(`เพิ่ม ${addedCount} ท่านเรียบร้อย${skipped > 0 ? ` (มีในรายการแล้ว ${skipped} ท่าน)` : ''}`);
        setTimeout(() => setAddFeedback(''), 3500);
    };

    // Remove single person from cart
    const handleRemovePerson = (index) => {
        const next = [...selectedPersonnel];
        next.splice(index, 1);
        setSelectedPersonnel(next);
    };

    // Handle reasons
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

    // Submit Borrow
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
                    items: selectedPersonnel,
                    reason: finalReasons.join(', ')
                })
            });
            const result = await res.json();
            if (result.success) {
                alert(`บันทึกข้อมูลเรียบร้อย! (${selectedPersonnel.length} รายการ)`);
                navigate('/');
            } else {
                alert('เกิดข้อผิดพลาดในการบันทึก: ' + (result.error || 'กรุณาลองใหม่'));
            }
        } catch (err) {
            alert('เชื่อมต่อ Server ไม่ได้');
        }
    };

    return (
        <div className="container" style={{ position: 'relative', maxWidth: '850px', paddingBottom: '100px', textAlign: 'left' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <ThemeToggle />
            </div>
            <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>ยืม ก.พ. 7</h1>

            {/* 1. Main Search Bar Section */}
            <div className="form-group" style={{ marginBottom: '24px' }} ref={dropdownRef}>
                <label style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={20} color="var(--primary-color)" />
                    1. ค้นหารายชื่อ หรือ พิมพ์ชื่อโรงเรียน
                </label>

                {/* Search Input with explicit guidance */}
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="พิมพ์ชื่อคุณครู หรือ พิมพ์ชื่อโรงเรียนได้ด้วย... เช่น สมชาย หรือ อนุบาลชัยนาท"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        className="form-control"
                        style={{
                            width: '100%',
                            paddingLeft: '44px',
                            paddingRight: searchQuery ? '40px' : '14px',
                            paddingTop: '14px',
                            paddingBottom: '14px',
                            fontSize: '1.05rem',
                            borderRadius: '10px',
                            border: '2px solid var(--primary-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-color)',
                            boxShadow: '0 2px 10px rgba(52, 152, 219, 0.15)'
                        }}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSearchResults([]);
                                setShowDropdown(false);
                            }}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Clear Guidance / Tip Banner */}
                <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)'
                }}>
                    <span>
                        💡 <strong>คำแนะนำ:</strong> สามารถพิมพ์ชื่อโรงเรียนเพื่อเลือกยืมครูทั้งโรงเรียน หรือพิมพ์ชื่อครูรายคนได้โดยตรง
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>หรือเลือกจาก:</span>
                        <select
                            value={activeSchool}
                            onChange={(e) => {
                                if (e.target.value) handleSelectSchool(e.target.value);
                            }}
                            style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--card-bg)',
                                color: 'var(--text-color)',
                                fontSize: '0.85rem',
                                maxWidth: '200px'
                            }}
                        >
                            <option value="">-- โรงเรียนทั้งหมด ({schools.length}) --</option>
                            {schools.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* Dropdown Results (Matching Schools + Matching Personnel) */}
                {showDropdown && (matchingSchools.length > 0 || searchResults.length > 0 || loadingSearch) && (
                    <div style={{
                        marginTop: '8px',
                        background: 'var(--card-bg)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 28px rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-color)',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        position: 'relative',
                        zIndex: 100
                    }}>
                        {/* Section A: Matching Schools (คลิกเพื่อเลือกทั้งโรงเรียนหรือบางคน) */}
                        {matchingSchools.length > 0 && (
                            <div style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <div style={{
                                    padding: '8px 16px',
                                    background: 'rgba(52, 152, 219, 0.1)',
                                    color: 'var(--primary-color)',
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Building2 size={16} />
                                    โรงเรียนที่พบ ({matchingSchools.length} แห่ง) — คลิกเพื่อเลือกครูทั้ง รร. หรือเลือกบางคน
                                </div>
                                {matchingSchools.map((school) => (
                                    <div
                                        key={school}
                                        onClick={() => handleSelectSchool(school)}
                                        style={{
                                            padding: '12px 18px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: '1px solid var(--border-color)',
                                            background: activeSchool === school ? 'var(--active-bg)' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = activeSchool === school ? 'var(--active-bg)' : 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Building2 size={16} color="var(--primary-color)" />
                                            <span style={{ fontWeight: '600', fontSize: '1rem' }}>{school}</span>
                                        </div>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            background: 'var(--primary-color)',
                                            color: '#fff',
                                            padding: '3px 8px',
                                            borderRadius: '6px'
                                        }}>
                                            เลือกโรงเรียนนี้ →
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Section B: Matching Teachers */}
                        {loadingSearch && (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <span className="spinner-border spinner-border-sm" role="status" style={{ marginRight: '8px' }}></span>
                                กำลังค้นหารายชื่อ...
                            </div>
                        )}

                        {!loadingSearch && searchResults.length > 0 && (
                            <div>
                                <div style={{
                                    padding: '8px 16px',
                                    background: 'var(--hover-bg)',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Users size={16} />
                                    คุณครูที่พบ ({searchResults.length} คน) — คลิกเพื่อเพิ่มรายคน
                                </div>
                                {searchResults.map((person) => (
                                    <div
                                        key={`${person.school}-${person.id}`}
                                        onClick={() => handleSelectPersonDirect(person)}
                                        style={{
                                            padding: '12px 18px',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem' }}>{person.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {person.position} • <span style={{ color: 'var(--primary-color)' }}>{person.school}</span>
                                            </div>
                                        </div>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: 'rgba(52, 152, 219, 0.1)',
                                            color: 'var(--primary-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold'
                                        }}>
                                            +
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. Active School Control Panel (แผงเลือกครูทั้งหมด หรือ เลือกบางรายชื่อ) */}
            {loadingPersonnel && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    <span className="spinner-border spinner-border-sm" role="status" style={{ marginRight: '8px' }}></span>
                    กำลังโหลดรายชื่อครูใน {activeSchool}...
                </div>
            )}

            {!loadingPersonnel && activeSchool && schoolPersonnel.length > 0 && (
                <div className="slide-in-up" style={{
                    background: 'var(--card-bg)',
                    borderRadius: '14px',
                    border: '2px solid var(--primary-color)',
                    padding: '20px',
                    boxShadow: '0 4px 16px rgba(52, 152, 219, 0.15)',
                    marginBottom: '26px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building2 size={20} color="var(--primary-color)" />
                            โรงเรียน: <span style={{ color: 'var(--primary-color)' }}>{activeSchool}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                                (มีครูทั้งหมด {schoolPersonnel.length} ท่าน)
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveSchool('');
                                setSchoolPersonnel([]);
                                setSelectedTeacherIds(new Set());
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <X size={14} /> ปิดแผงโรงเรียนนี้
                        </button>
                    </div>

                    {/* Prominent Selection Choice: เลือกครูทั้งหมด vs เลือกบางรายชื่อ */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '12px',
                        marginBottom: '18px'
                    }}>
                        {/* Option 1: เลือกครูทั้งหมด */}
                        <div
                            onClick={() => handleScopeChange('all')}
                            style={{
                                padding: '14px 18px',
                                borderRadius: '10px',
                                border: `2px solid ${selectionScope === 'all' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                background: selectionScope === 'all' ? 'rgba(52, 152, 219, 0.1)' : 'var(--input-bg)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <input
                                type="radio"
                                name="selectionScope"
                                checked={selectionScope === 'all'}
                                onChange={() => handleScopeChange('all')}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                            />
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: selectionScope === 'all' ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                    เลือกชื่อครูทั้งหมดในโรงเรียน
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    เหมาทั้งโรงเรียน ({schoolPersonnel.length} คน)
                                </div>
                            </div>
                        </div>

                        {/* Option 2: เลือกเฉพาะบางรายชื่อ */}
                        <div
                            onClick={() => handleScopeChange('partial')}
                            style={{
                                padding: '14px 18px',
                                borderRadius: '10px',
                                border: `2px solid ${selectionScope === 'partial' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                background: selectionScope === 'partial' ? 'rgba(52, 152, 219, 0.1)' : 'var(--input-bg)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}
                        >
                            <input
                                type="radio"
                                name="selectionScope"
                                checked={selectionScope === 'partial'}
                                onChange={() => handleScopeChange('partial')}
                                style={{ width: '20px', height: '20px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                            />
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: selectionScope === 'partial' ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                    เลือกเฉพาะบางรายชื่อ
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    ติ๊กเลือกรายคน ({selectedTeacherIds.size} / {schoolPersonnel.length} คน)
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* If Partial Scope: Show Checkbox list */}
                    {selectionScope === 'partial' && (
                        <div style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            marginBottom: '16px'
                        }}>
                            {/* Filter & Helpers */}
                            <div style={{
                                padding: '10px 14px',
                                background: 'var(--hover-bg)',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                                flexWrap: 'wrap'
                            }}>
                                <input
                                    type="text"
                                    placeholder={`ค้นหาชื่อใน ${activeSchool}...`}
                                    value={teacherFilterQuery}
                                    onChange={(e) => setTeacherFilterQuery(e.target.value)}
                                    style={{
                                        flex: 1,
                                        minWidth: '180px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--input-bg)',
                                        color: 'var(--text-color)',
                                        fontSize: '0.9rem'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTeacherIds(new Set(schoolPersonnel.map(p => p.id)))}
                                        style={{
                                            fontSize: '0.85rem',
                                            padding: '5px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--card-bg)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        เลือกทั้งหมด
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTeacherIds(new Set())}
                                        style={{
                                            fontSize: '0.85rem',
                                            padding: '5px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--card-bg)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ยกเลิกทั้งหมด
                                    </button>
                                </div>
                            </div>

                            {/* Checkbox Rows */}
                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                {filteredSchoolPersonnel.map((teacher, idx) => {
                                    const isChecked = selectedTeacherIds.has(teacher.id);
                                    const isAlreadyInCart = selectedPersonnel.some(p => p.name === teacher.name && p.school === activeSchool);

                                    return (
                                        <div
                                            key={teacher.id || idx}
                                            onClick={() => handleToggleTeacher(teacher.id)}
                                            style={{
                                                padding: '10px 14px',
                                                borderBottom: '1px solid var(--border-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                background: isChecked ? 'rgba(52, 152, 219, 0.08)' : 'transparent',
                                                transition: 'background 0.15s'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isChecked) e.currentTarget.style.background = 'var(--hover-bg)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = isChecked ? 'rgba(52, 152, 219, 0.08)' : 'transparent';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: '600', fontSize: '0.98rem' }}>
                                                        {teacher.name}
                                                        {isAlreadyInCart && (
                                                            <span style={{
                                                                marginLeft: '8px',
                                                                fontSize: '0.75rem',
                                                                background: 'rgba(52, 152, 219, 0.15)',
                                                                color: 'var(--primary-color)',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                อยู่ในรายการแล้ว
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        {teacher.position || 'ครู'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action Button: เพิ่มลงในรายการยืม */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>
                            จำนวนที่จะเพิ่ม:{' '}
                            <strong style={{ color: 'var(--primary-color)', fontSize: '1.1rem' }}>
                                {selectionScope === 'all' ? schoolPersonnel.length : selectedTeacherIds.size}
                            </strong>{' '}
                            ท่าน ({selectionScope === 'all' ? 'เหมาทั้งโรงเรียน' : 'เลือกบางท่าน'})
                        </div>

                        <button
                            type="button"
                            onClick={handleAddSchoolTeachersToBorrow}
                            disabled={selectionScope === 'partial' && selectedTeacherIds.size === 0}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: (selectionScope === 'all' || selectedTeacherIds.size > 0) ? 'var(--primary-color)' : '#ccc',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 22px',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: (selectionScope === 'all' || selectedTeacherIds.size > 0) ? 'pointer' : 'not-allowed',
                                boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Plus size={18} />
                            เพิ่ม {selectionScope === 'all' ? schoolPersonnel.length : selectedTeacherIds.size} ท่านลงในรายการยืม
                        </button>
                    </div>

                    {/* Feedback Toast */}
                    {addFeedback && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 16px',
                            background: '#d4edda',
                            color: '#155724',
                            fontSize: '0.95rem',
                            fontWeight: '500',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <CheckCircle2 size={18} />
                            {addFeedback}
                        </div>
                    )}
                </div>
            )}

            {/* 3. Selected Personnel Cart (รายการที่จะขอยืม) */}
            <form onSubmit={handleSubmit}>
                <div className="form-group slide-in-up" style={{ marginBottom: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{ fontSize: '1.1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={18} color="var(--primary-color)" />
                            2. รายการที่จะขอยืม ({selectedPersonnel.length} คน)
                        </label>
                        {selectedPersonnel.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedPersonnel([])}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent-color)',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <Trash2 size={14} />
                                ล้างรายการทั้งหมด
                            </button>
                        )}
                    </div>

                    {selectedPersonnel.length === 0 ? (
                        <div style={{
                            padding: '30px',
                            textAlign: 'center',
                            border: '2px dashed var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-muted)',
                            background: 'var(--input-bg)'
                        }}>
                            ยังไม่มีรายชื่อที่เลือก — พิมพ์ชื่อโรงเรียนเพื่อเลือกยืมครูทั้งโรงเรียน หรือพิมพ์ชื่อคุณครูในช่องค้นหาด้านบน
                        </div>
                    ) : (
                        <div style={{
                            background: 'var(--card-bg)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px var(--shadow-color)'
                        }}>
                            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                {selectedPersonnel.map((person, index) => (
                                    <div key={person.name + index} style={{
                                        padding: '11px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: index % 2 === 0 ? 'rgba(0,0,0,0.015)' : 'transparent'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                                                {index + 1}. {person.name}
                                                {person.isManual && (
                                                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#ffc107', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>
                                                        พิมพ์เอง
                                                    </span>
                                                )}
                                                {person.position && !person.isManual && (
                                                    <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '6px' }}>
                                                        ({person.position})
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>
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
                                                padding: '4px 10px',
                                                color: '#d9534f',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <X size={14} />
                                            ลบ
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Reasons (Visible when personnel are selected) */}
                {selectedPersonnel.length > 0 && (
                    <div className="form-group slide-in-up" style={{ animationDelay: '0.1s', marginBottom: '28px' }}>
                        <label style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '10px', display: 'block' }}>
                            3. ระบุเหตุผลการขอยืม
                        </label>
                        <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
                                {[
                                    'ขอใบอนุญาตประกอบวิชาชีพ',
                                    'ขอเลื่อนวิทยฐานะ',
                                    'ประกอบคำร้องขอย้าย',
                                    'ขอมีเครื่องราชอิสริยาภรณ์',
                                    'ขอสมัครงาน',
                                    'ขอลาออก',
                                    'สมัครสมาชิกสหกรณ์ออมทรัพย์ครู',
                                    'ส่งผลงาน',
                                    'ส่งครูดีเด่น',
                                    'ส่งข้าราชการดีเด่น',
                                    'แนบสรุปครูผู้ช่วย ก.พ.7'
                                ].map(r => (
                                    <label key={r} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: reasons.includes(r) ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                        background: reasons.includes(r) ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        fontSize: '0.95rem'
                                    }}>
                                        <input
                                            type="checkbox"
                                            value={r}
                                            onChange={handleReasonChange}
                                            checked={reasons.includes(r)}
                                            style={{ width: '17px', height: '17px', marginRight: '10px', accentColor: 'var(--primary-color)' }}
                                        />
                                        {r}
                                    </label>
                                ))}
                            </div>
                            <div style={{ marginTop: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                                <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', fontSize: '0.95rem' }}>
                                    <input
                                        type="checkbox"
                                        value="other"
                                        onChange={handleReasonChange}
                                        checked={isOtherReasonChecked}
                                        style={{ width: '17px', height: '17px', marginRight: '10px', accentColor: 'var(--primary-color)' }}
                                    />
                                    เหตุผลอื่นๆ:
                                    <input
                                        type="text"
                                        className="form-control"
                                        style={{
                                            marginLeft: '10px',
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--input-bg)',
                                            color: 'var(--text-color)'
                                        }}
                                        placeholder="โปรดระบุเหตุผล..."
                                        disabled={!isOtherReasonChecked}
                                        value={otherReason}
                                        onChange={(e) => setOtherReason(e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                {selectedPersonnel.length > 0 && (
                    <button
                        type="submit"
                        className="btn-submit slide-in-up"
                        style={{
                            animationDelay: '0.15s',
                            marginTop: '10px',
                            width: '100%',
                            padding: '14px',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            borderRadius: '10px',
                            backgroundColor: 'var(--primary-color)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)'
                        }}
                    >
                        บันทึกการยืม ({selectedPersonnel.length} ท่าน)
                    </button>
                )}
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Link to="/" className="back-link" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.95rem' }}>
                    ← กลับหน้าหลัก
                </Link>
            </div>

            <style>{`
                @keyframes slideInUp {
                    from { transform: translateY(16px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .slide-in-up {
                    animation: slideInUp 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default BorrowForm;