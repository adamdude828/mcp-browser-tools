import React, { useState } from 'react';

const DynamicList = ({ items }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  
  return (
    <div data-testid="dynamic-list">
      <h3>Dynamic List</h3>
      <ul>
        {items.map((item, index) => (
          <li 
            key={index}
            onClick={() => setSelectedItem(index)}
            style={{
              padding: '8px',
              margin: '4px 0',
              backgroundColor: selectedItem === index ? '#e6f2ff' : 'transparent',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
            data-testid={`list-item-${index}`}
          >
            {item}
          </li>
        ))}
      </ul>
      
      {items.length === 0 && (
        <p>No items available. Add some using the button above.</p>
      )}
    </div>
  );
};

export default DynamicList; 