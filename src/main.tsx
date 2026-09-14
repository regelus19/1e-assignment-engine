import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeOperationalRepository } from './services/repository';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Repository initialization must never prevent the assignment board from
// rendering. Local mode remains immediately usable; shared-data setup can
// initialize afterward and report failures without replacing the UI.
void initializeOperationalRepository().catch(error => {
  console.error('Unable to initialize data repository; app remains available.', error);
});
