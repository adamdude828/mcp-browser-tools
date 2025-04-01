import React, { useState, useEffect } from 'react';
import DynamicList from './components/DynamicList';
import Card from './components/Card';

const App = () => {
  const [showContent, setShowContent] = useState(false);
  const [counter, setCounter] = useState(0);
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3']);

  // Simulate React's frequent rerenders in development mode
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((prev) => prev + 1);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const addItem = () => {
    setItems([...items, `Item ${items.length + 1}`]);
  };

  const removeItem = () => {
    if (items.length > 0) {
      setItems(items.slice(0, -1));
    }
  };

  return (
    <div className="app-container">
      <h1>React Element Selection Test App</h1>
      <p>This app is designed to test element selection with React elements that frequently update.</p>
      
      <div>
        <button className="button" onClick={() => setShowContent(!showContent)}>
          {showContent ? 'Hide Content' : 'Show Content'}
        </button>
        <button className="button" onClick={addItem}>Add Item</button>
        <button className="button" onClick={removeItem}>Remove Item</button>
      </div>
      
      <div className="dynamic-content">
        Counter: {counter} (updates every 5 seconds to simulate React rerenders)
      </div>
      
      {showContent && (
        <div data-testid="dynamic-content">
          <h2>Dynamic Content</h2>
          <Card title="Test Card" description="This is a test card component" />
          <DynamicList items={items} />
        </div>
      )}
    </div>
  );
};

export default App; 