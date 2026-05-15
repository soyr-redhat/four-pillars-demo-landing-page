import { useState, useEffect } from 'react';

type Props = {
  inline?: boolean;
};

export function ThemeToggle({ inline = false }: Props) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const baseStyle = {
    background: 'var(--white)',
    border: '2px solid var(--border)',
    color: 'var(--ink)',
    padding: inline ? '6px 12px' : '10px 16px',
    borderRadius: inline ? '6px' : '8px',
    cursor: 'pointer',
    fontFamily: "'Red Hat Mono', monospace",
    fontSize: inline ? '12px' : '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  };

  const positionStyle = inline
    ? {}
    : {
        position: 'fixed' as const,
        top: '20px',
        right: '20px',
        zIndex: 1000,
      };

  return (
    <button
      onClick={toggleTheme}
      style={{ ...baseStyle, ...positionStyle }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--red)';
        e.currentTarget.style.color = 'var(--red)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--ink)';
      }}
    >
      <span>{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
