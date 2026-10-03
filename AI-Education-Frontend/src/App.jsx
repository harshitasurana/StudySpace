import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppProviders from './app/AppProviders';
import AppRoutes from './routes/AppRoutes';

const App = () => {
  return (
    <Router>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </Router>
  );
};

export default App;
