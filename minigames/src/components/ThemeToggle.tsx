import { useState, useEffect } from 'react';

type Props = {
  inline?: boolean;
};

export function ThemeToggle({ inline = false }: Props) {
  const [theme, setTheme] = useState('light');
  const [isHovered, setIsHovered] = useState(false);

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
    border: '1.5px solid var(--border)',
    color: isHovered ? 'var(--red)' : 'var(--ink)',
    borderColor: isHovered ? 'var(--red)' : 'var(--border)',
    padding: inline ? '6px 10px' : '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: "'Red Hat Mono', monospace",
    fontSize: inline ? '11px' : '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  };

  const positionStyle = {};

  return (
    <button
      onClick={toggleTheme}
      style={{ ...baseStyle, ...positionStyle }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span>{theme === 'dark' ? '☀' : '☾'}</span>
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
