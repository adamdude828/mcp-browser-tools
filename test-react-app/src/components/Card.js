import React, { useState } from 'react';

const Card = ({ title, description }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="card" data-testid="card-component">
      <h3>{title}</h3>
      <p>{description}</p>
      
      <button 
        onClick={() => setExpanded(!expanded)}
        className="button"
      >
        {expanded ? 'Show Less' : 'Show More'}
      </button>
      
      {expanded && (
        <div data-testid="expanded-content">
          <p>This is additional content that appears and disappears.</p>
          <p>This dynamic content can cause issues with element selection.</p>
        </div>
      )}
    </div>
  );
};

export default Card; 