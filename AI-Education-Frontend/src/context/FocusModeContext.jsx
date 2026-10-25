import React, { createContext, useContext, useState, useCallback } from 'react';

// Kept separate from HelpDrawerContext on purpose — that one is
// semantically scoped to the help/AI-tutor drawer (and already carries
// unrelated drag/resize state); this is just "should the app chrome
// (Topbar/Sidebar/Footer) be hidden right now," usable by any page, not
// just the reader.
const FocusModeContext = createContext({
  isFocusMode: false,
  setFocusMode: () => {},
});

export const FocusModeProvider = ({ children }) => {
  const [isFocusMode, setIsFocusMode] = useState(false);

  const setFocusMode = useCallback((on) => {
    setIsFocusMode(Boolean(on));
  }, []);

  return (
    <FocusModeContext.Provider value={{ isFocusMode, setFocusMode }}>
      {children}
    </FocusModeContext.Provider>
  );
};

export const useFocusMode = () => useContext(FocusModeContext);

export default FocusModeContext;
