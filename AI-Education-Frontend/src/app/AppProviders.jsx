import React from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { UserProvider } from '../context/UserContext';
import { StudentModeProvider } from '../context/StudentModeContext';
import { StudentRBACProvider } from '../context/StudentRBACContext';
import { HelpDrawerProvider } from '../context/HelpDrawerContext';
import { FocusModeProvider } from '../context/FocusModeContext';
import { XpRewardProvider } from '../context/XpRewardContext';

/**
 * Order matters: UserProvider, StudentModeProvider, and StudentRBACProvider
 * all read the logged-in user from AuthContext, so AuthProvider must wrap
 * them. ThemeProvider has no dependencies and can sit outermost.
 * StudentRBACProvider is independent of StudentModeProvider (role
 * permission and self/school mode are separate axes) - nesting order
 * between them doesn't matter, only that both sit under AuthProvider.
 */
const AppProviders = ({ children }) => (
  <ThemeProvider>
    <AuthProvider>
      <UserProvider>
        <StudentModeProvider>
          <StudentRBACProvider>
            <HelpDrawerProvider>
              <FocusModeProvider>
                <XpRewardProvider>{children}</XpRewardProvider>
              </FocusModeProvider>
            </HelpDrawerProvider>
          </StudentRBACProvider>
        </StudentModeProvider>
      </UserProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default AppProviders;