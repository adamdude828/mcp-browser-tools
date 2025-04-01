import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import testHarness from './test-harness';

// Import the current element selection mechanism (simple implementation for testing)
import './element-selector';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />); 