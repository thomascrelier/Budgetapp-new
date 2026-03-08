'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setThemeState(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'dark' : 'light');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const saved = localStorage.getItem('theme');
      if (!saved) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    gridColor: isDark ? '#2A2A3C' : '#E8E2D9',
    tickColor: isDark ? '#6E6E85' : '#9C9590',
    tooltipStyle: {
      backgroundColor: isDark ? '#161622' : '#FFFFFF',
      border: `1px solid ${isDark ? '#2A2A3C' : '#E8E2D9'}`,
      borderRadius: '8px',
      boxShadow: isDark
        ? '0 8px 32px rgba(0,0,0,0.4)'
        : '0 8px 32px rgba(180,168,150,0.12)',
    },
    positiveColor: isDark ? '#34D399' : '#16A34A',
    negativeColor: isDark ? '#F87171' : '#DC2626',
    accentColor: '#D4A853',
    warningColor: isDark ? '#FBBF24' : '#D97706',
    infoColor: isDark ? '#60A5FA' : '#2563EB',
    pieColors: isDark
      ? ['#D4A853', '#34D399', '#60A5FA', '#F87171', '#A78BFA', '#FBBF24', '#6E6E85', '#4A4A5C']
      : ['#D4A853', '#16A34A', '#2563EB', '#DC2626', '#7C3AED', '#D97706', '#9C9590', '#C4BFB8'],
  };
}
