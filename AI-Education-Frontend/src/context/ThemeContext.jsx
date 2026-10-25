import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = useCallback((next) => setThemeState(next), []);
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = { theme, setTheme, toggleTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within a ThemeProvider');
  return ctx;
};

export default ThemeContext;
