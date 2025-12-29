import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HelloWorld from '../pages/HelloWorld';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HelloWorld />} />
      <Route path="/hello/:name" element={<HelloWorldWithParam />} />
    </Routes>
  );
};

const HelloWorldWithParam: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  return <HelloWorld name={name} />;
};

export default AppRoutes;