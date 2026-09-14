import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeOperationalRepository } from './services/repository';
import './index.css';

const render = () => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

void initializeOperationalRepository()
  .then(render)
  .catch(error => {
    console.error('Unable to initialize data repository', error);
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <div style={{padding:24,fontFamily:'sans-serif'}}>
        <h2>1E Assignment App could not start</h2>
        <p>Shared-data configuration or Microsoft 365 sign-in needs attention. No local fallback was used.</p>
      </div>
    );
  });
