import React, { createContext, useContext, useState, useCallback } from 'react';

const MIN_DRAWER_WIDTH = 340;
const DEFAULT_DRAWER_WIDTH = 460;
const STORAGE_KEY = 'eduai_help_drawer_width';

const getStoredWidth = () => {
  if (typeof window === 'undefined') return DEFAULT_DRAWER_WIDTH;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_DRAWER_WIDTH;
    const parsed = parseInt(saved, 10);
    const max = Math.max(MIN_DRAWER_WIDTH, window.innerWidth - 60);
    return isNaN(parsed) ? DEFAULT_DRAWER_WIDTH : Math.min(Math.max(parsed, MIN_DRAWER_WIDTH), max);
  } catch {
    return DEFAULT_DRAWER_WIDTH;
  }
};

const HelpDrawerContext = createContext({
  isProvided: false,
  isHelpOpen: false,
  helpDrawerWidth: DEFAULT_DRAWER_WIDTH,
  isHelpDragging: false,
  activeFeatureId: null,
  activeFeatureLabel: null,
  setHelpOpen: () => {},
  setHelpDrawerWidth: () => {},
  setIsHelpDragging: () => {},
  openHelpDrawer: () => {},
  closeHelpDrawer: () => {},
});

export const HelpDrawerProvider = ({ children }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpDrawerWidth, setHelpDrawerWidthState] = useState(getStoredWidth);
  const [isHelpDragging, setIsHelpDragging] = useState(false);
  const [activeFeatureId, setActiveFeatureId] = useState(null);
  const [activeFeatureLabel, setActiveFeatureLabel] = useState(null);

  const setHelpDrawerWidth = useCallback((widthOrFn) => {
    setHelpDrawerWidthState((prev) => {
      const next = typeof widthOrFn === 'function' ? widthOrFn(prev) : widthOrFn;
      const maxAllowed = typeof window !== 'undefined' ? Math.max(MIN_DRAWER_WIDTH, window.innerWidth - 60) : 900;
      const clamped = Math.min(maxAllowed, Math.max(MIN_DRAWER_WIDTH, next));
      try {
        localStorage.setItem(STORAGE_KEY, String(Math.round(clamped)));
      } catch {
        // ignore localStorage errors
      }
      return clamped;
    });
  }, []);

  const openHelpDrawer = useCallback(({ featureId, featureLabel } = {}) => {
    if (featureId !== undefined) setActiveFeatureId(featureId);
    if (featureLabel !== undefined) setActiveFeatureLabel(featureLabel);
    setIsHelpOpen(true);
  }, []);

  const closeHelpDrawer = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const setHelpOpen = useCallback((open) => {
    setIsHelpOpen(Boolean(open));
  }, []);

  return (
    <HelpDrawerContext.Provider
      value={{
        isProvided: true,
        isHelpOpen,
        helpDrawerWidth,
        isHelpDragging,
        activeFeatureId,
        activeFeatureLabel,
        setHelpOpen,
        setHelpDrawerWidth,
        setIsHelpDragging,
        openHelpDrawer,
        closeHelpDrawer,
      }}
    >
      {children}
    </HelpDrawerContext.Provider>
  );
};

export const useHelpDrawer = () => useContext(HelpDrawerContext);

export default HelpDrawerContext;
