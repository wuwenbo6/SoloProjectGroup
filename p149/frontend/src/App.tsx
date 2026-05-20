import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Workspace from './pages/Workspace';
import Projects from './pages/Projects';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/projects" element={<Projects />} />
      </Routes>
    </Router>
  );
};

export default App;
