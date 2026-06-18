import { useState } from 'react';
import { PlaneTakeoff, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      await onLogin(email.trim().toLowerCase(), password);
    } catch (err) {
      console.error(err);
      let errMsg = 'Error al iniciar sesión. Inténtalo de nuevo.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Credenciales incorrectas o usuario no registrado.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'El formato del correo electrónico no es válido.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary)',
      backgroundImage: 
        'radial-gradient(at 0% 0%, hsla(239, 84%, 67%, 0.12) 0px, transparent 50%),' +
        'radial-gradient(at 100% 100%, hsla(188, 86%, 53%, 0.09) 0px, transparent 50%)',
      fontFamily: 'var(--font-sans)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* Radar grid effect in background */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        border: '1px dashed rgba(6, 182, 212, 0.05)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ width: '400px', height: '400px', borderRadius: '50%', border: '1px dashed rgba(6, 182, 212, 0.03)' }} />
        <div style={{ width: '200px', height: '200px', borderRadius: '50%', border: '1px dashed rgba(6, 182, 212, 0.02)' }} />
      </div>

      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--glass-shadow)',
        border: '1px solid var(--color-border)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        animation: 'fadeIn 0.4s ease',
        zIndex: 10
      }}>
        
        {/* Brand header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.15)'
          }}>
            <PlaneTakeoff size={32} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: '800', marginTop: '0.5rem', letterSpacing: '-0.02em' }}>
            AirControl <span style={{ color: 'var(--accent-cyan)' }}>SKBO</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Torre de Control de Eldorado · Bogotá
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            color: 'var(--status-danger)',
            fontSize: '0.82rem',
            fontWeight: '500',
            animation: 'fadeIn 0.2s ease'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label htmlFor="login-email" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Mail size={13} style={{ color: 'var(--text-muted)' }} /> Correo Electrónico
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="Ej: admin@aircontrol.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Lock size={13} style={{ color: 'var(--text-muted)' }} /> Contraseña
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.8rem',
              fontWeight: '700',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>


      </div>
    </div>
  );
}
