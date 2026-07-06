import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LearningInput from './pages/LearningInput';
import Results from './pages/Results';
import Account from './pages/Account';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LearningInput />} />
          <Route path="/learning" element={<LearningInput />} />
          <Route path="/results" element={<Results />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
