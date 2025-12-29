import React from 'react';

interface HelloWorldProps {
  name?: string;
}

const HelloWorld: React.FC<HelloWorldProps> = ({ name = 'World' }) => {
  return (
    <div className="hello-world-container">
      <h1>Hello, {name}!</h1>
      <p>Welcome to Miyabi Framework</p>
    </div>
  );
};

export default HelloWorld;