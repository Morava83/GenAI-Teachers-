import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Personalization from './pages/Personalization';
import LearningInput from './pages/LearningInput';
import Results from './pages/Results';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Personalization />} />
          <Route path="/learning" element={<LearningInput />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
