import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '', style = {} }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('aircontrol_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aircontrol_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`btn btn-secondary ${className}`}
      style={{
        padding: '0.5rem 0.75rem',
        borderRadius: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.85rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        ...style
      }}
      title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
    >
      {isDark ? (
        <>
          <Sun size={16} style={{ color: '#f59e0b' }} />
          <span>Modo Claro</span>
        </>
      ) : (
        <>
          <Moon size={16} style={{ color: 'var(--accent-indigo)' }} />
          <span>Modo Oscuro</span>
        </>
      )}
    </button>
  );
}
