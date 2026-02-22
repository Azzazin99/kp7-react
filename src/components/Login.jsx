import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap } from 'lucide-react';

// Animated particle/spark canvas background
function TeslaCanvas() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const particles = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.6 + 0.2,
        }));

        let animId;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw arcing electric lines between close particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(0,200,255,${0.15 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            // Draw particles
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,200,255,${p.alpha})`;
                ctx.fill();

                p.x += p.dx;
                p.y += p.dy;
                if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            });
            animId = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0, left: 0,
                width: '100%', height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
            }}
        />
    );
}

const Login = () => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [arcActive, setArcActive] = useState(false);
    const navigate = useNavigate();

    // Periodic arc flash on the top bar
    useEffect(() => {
        const interval = setInterval(() => {
            setArcActive(true);
            setTimeout(() => setArcActive(false), 300);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();
            if (data.success && data.token) {
                sessionStorage.setItem('adminToken', data.token);
                navigate('/admin');
            } else {
                setError(data.error || 'รหัสผ่านไม่ถูกต้อง');
            }
        } catch (err) {
            setError('การเชื่อมต่อล้มเหลว กรุณาลองใหม่');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at center, #0a0f1a 0%, #050811 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Courier New', monospace",
            position: 'relative',
            overflow: 'hidden',
        }}>
            <TeslaCanvas />

            {/* Back button */}
            <button
                onClick={() => navigate('/')}
                style={{
                    position: 'fixed',
                    top: '24px',
                    left: '24px',
                    zIndex: 100,
                    background: 'transparent',
                    border: '1px solid rgba(0,200,255,0.3)',
                    color: 'rgba(0,200,255,0.7)',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    fontSize: '12px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                    e.target.style.borderColor = 'rgba(0,200,255,0.8)';
                    e.target.style.color = '#00c8ff';
                    e.target.style.boxShadow = '0 0 12px rgba(0,200,255,0.3)';
                }}
                onMouseLeave={e => {
                    e.target.style.borderColor = 'rgba(0,200,255,0.3)';
                    e.target.style.color = 'rgba(0,200,255,0.7)';
                    e.target.style.boxShadow = 'none';
                }}
            >
                ← BACK
            </button>

            {/* Main card */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                width: '400px',
                maxWidth: '90vw',
            }}>
                {/* Electric arc bar at top */}
                <div style={{
                    height: '4px',
                    background: arcActive
                        ? 'linear-gradient(90deg, transparent, #ffffff, #00c8ff, #ffffff, transparent)'
                        : 'linear-gradient(90deg, transparent, #00c8ff44, transparent)',
                    boxShadow: arcActive
                        ? '0 0 20px 4px #00c8ff, 0 0 40px 8px rgba(0,200,255,0.4)'
                        : '0 0 8px rgba(0,200,255,0.2)',
                    transition: 'all 0.1s ease',
                    borderRadius: '2px 2px 0 0',
                }} />

                <div style={{
                    background: 'linear-gradient(160deg, rgba(10,20,40,0.95) 0%, rgba(5,10,20,0.98) 100%)',
                    border: '1px solid rgba(0,200,255,0.15)',
                    borderTop: 'none',
                    padding: '40px 36px 36px',
                    borderRadius: '0 0 4px 4px',
                    boxShadow: '0 0 60px rgba(0,200,255,0.07), inset 0 1px 0 rgba(0,200,255,0.05)',
                }}>
                    {/* Icon */}
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(0,200,255,0.15) 0%, rgba(0,200,255,0.02) 70%)',
                            border: '1px solid rgba(0,200,255,0.3)',
                            boxShadow: '0 0 20px rgba(0,200,255,0.15)',
                            marginBottom: '18px',
                        }}>
                            <Zap size={28} color="#00c8ff" strokeWidth={1.5} />
                        </div>

                        <div style={{
                            fontFamily: "'Courier New', monospace",
                            fontSize: '12px',
                            letterSpacing: '4px',
                            color: 'rgba(0,200,255,0.6)',
                            textTransform: 'uppercase',
                            marginBottom: '6px',
                        }}>
                            SECURE ACCESS TERMINAL
                        </div>
                        <div style={{
                            fontSize: '26px',
                            fontWeight: '700',
                            color: '#e8f4ff',
                            letterSpacing: '3px',
                            textTransform: 'uppercase',
                        }}>
                            KP.7 ADMIN
                        </div>
                    </div>

                    {/* Divider */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '28px',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(0,200,255,0.1)' }} />
                        <span style={{ fontSize: '12px', color: 'rgba(0,200,255,0.5)', letterSpacing: '3px' }}>AUTHENTICATE</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(0,200,255,0.1)' }} />
                    </div>

                    <form onSubmit={handleLogin}>
                        <label style={{
                            display: 'block',
                            fontSize: '12px',
                            letterSpacing: '3px',
                            color: 'rgba(0,200,255,0.6)',
                            marginBottom: '10px',
                            textTransform: 'uppercase',
                        }}>
                            ACCESS CODE
                        </label>

                        <div style={{ position: 'relative', marginBottom: error ? '12px' : '24px' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="• • • • • •"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '14px 48px 14px 16px',
                                    background: 'rgba(0,200,255,0.03)',
                                    border: '1px solid rgba(0,200,255,0.2)',
                                    borderRadius: '2px',
                                    color: '#00c8ff',
                                    fontSize: '18px',
                                    letterSpacing: '4px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    fontFamily: "'Courier New', monospace",
                                    transition: 'all 0.2s ease',
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = 'rgba(0,200,255,0.6)';
                                    e.target.style.boxShadow = '0 0 20px rgba(0,200,255,0.1), inset 0 0 20px rgba(0,200,255,0.03)';
                                    e.target.style.background = 'rgba(0,200,255,0.05)';
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = 'rgba(0,200,255,0.2)';
                                    e.target.style.boxShadow = 'none';
                                    e.target.style.background = 'rgba(0,200,255,0.03)';
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(0,200,255,0.4)',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.2s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#00c8ff'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,200,255,0.4)'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {error && (
                            <div style={{
                                fontSize: '11px',
                                color: '#ff4a6e',
                                letterSpacing: '1px',
                                marginBottom: '20px',
                                padding: '8px 12px',
                                border: '1px solid rgba(255,74,110,0.2)',
                                background: 'rgba(255,74,110,0.05)',
                                borderRadius: '2px',
                            }}>
                                ⚡ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '14px',
                                background: loading
                                    ? 'rgba(0,200,255,0.05)'
                                    : 'linear-gradient(135deg, rgba(0,200,255,0.12) 0%, rgba(0,160,220,0.08) 100%)',
                                border: '1px solid rgba(0,200,255,0.35)',
                                borderRadius: '2px',
                                color: loading ? 'rgba(0,200,255,0.4)' : '#00c8ff',
                                fontSize: '15px',
                                fontWeight: '700',
                                letterSpacing: '4px',
                                textTransform: 'uppercase',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontFamily: "'Courier New', monospace",
                                boxShadow: loading ? 'none' : '0 0 20px rgba(0,200,255,0.1)',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => {
                                if (!loading) {
                                    e.target.style.background = 'linear-gradient(135deg, rgba(0,200,255,0.2) 0%, rgba(0,160,220,0.15) 100%)';
                                    e.target.style.boxShadow = '0 0 30px rgba(0,200,255,0.2), 0 0 60px rgba(0,200,255,0.08)';
                                    e.target.style.borderColor = 'rgba(0,200,255,0.6)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!loading) {
                                    e.target.style.background = 'linear-gradient(135deg, rgba(0,200,255,0.12) 0%, rgba(0,160,220,0.08) 100%)';
                                    e.target.style.boxShadow = '0 0 20px rgba(0,200,255,0.1)';
                                    e.target.style.borderColor = 'rgba(0,200,255,0.35)';
                                }
                            }}
                        >
                            {loading ? '[ AUTHENTICATING... ]' : '⚡ INITIATE ACCESS'}
                        </button>
                    </form>

                    {/* Footer */}
                    <div style={{
                        marginTop: '28px',
                        paddingTop: '18px',
                        borderTop: '1px solid rgba(0,200,255,0.07)',
                        textAlign: 'center',
                        fontSize: '11px',
                        letterSpacing: '2px',
                        color: 'rgba(0,200,255,0.3)',
                        textTransform: 'uppercase',
                    }}>
                        AUTHORIZED PERSONNEL ONLY · HIGH VOLTAGE SYSTEM
                    </div>
                </div>

                {/* Bottom glow line */}
                <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.2), transparent)',
                    boxShadow: '0 2px 12px rgba(0,200,255,0.1)',
                }} />
            </div>
        </div>
    );
};

export default Login;
