import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const Home = () => {
    return (
        <div className="container" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <ThemeToggle />
            </div>
            <h1>ระบบยืม-คืน กพ.7<br /><small style={{ fontSize: '0.6em', color: 'var(--text-muted)' }}>สพป. ชัยนาท</small></h1>

            <Link to="/borrow" className="btn-large btn-borrow">
                📖 ยืม กพ.7
            </Link>

            <Link to="/return" className="btn-large btn-return">
                ↩️ คืน กพ.7
            </Link>

            <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <Link to="/admin" style={{ color: '#95a5a6', textDecoration: 'none', fontSize: '0.9em' }}>
                    🔒 สำหรับเจ้าหน้าที่ (Admin)
                </Link>
            </div>
        </div>
    );
};

export default Home;
