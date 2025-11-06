import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Results.css';

const Results = () => {
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    // Load the generated problem from localStorage
    const stored = localStorage.getItem('generatedProblem');
    if (stored) {
      setProblem(JSON.parse(stored));
    } else {
      // No problem found, redirect back
      navigate('/learning');
    }
  }, [navigate]);

  const handleNewProblem = () => {
    navigate('/learning');
  };

  const handleBack = () => {
    navigate('/learning');
  };

  if (!problem) {
    return (
      <div className="results-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="results-header">
        <button className="back-btn" onClick={handleBack}>
          ← Back to Learning
        </button>
        <h1>Your Learning Task</h1>
      </div>

      <div className="results-content">
        {/* Problem Section */}
        <div className="problem-section">
          <h2>Problem</h2>
          <div 
            className="problem-content"
            dangerouslySetInnerHTML={{ __html: problem.problem }}
          />
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button 
            className={`action-button ${showHints ? 'active' : ''}`}
            onClick={() => setShowHints(!showHints)}
          >
            {showHints ? 'Hide Hints' : 'Show Hints'}
          </button>
          <button 
            className={`action-button ${showSolution ? 'active' : ''}`}
            onClick={() => setShowSolution(!showSolution)}
          >
            {showSolution ? 'Hide Solution' : 'Show Solution'}
          </button>
        </div>

        {/* Hints Section */}
        {showHints && (
          <div className="hints-section">
            <h3>💡 Hints</h3>
            <div 
              className="hints-content"
              dangerouslySetInnerHTML={{ __html: problem.hints || 'No hints available' }}
            />
          </div>
        )}

        {/* Solution Section */}
        {showSolution && (
          <div className="solution-section">
            <h3>✅ Solution</h3>
            <div 
              className="solution-content"
              dangerouslySetInnerHTML={{ __html: problem.solution || 'No solution available' }}
            />
            {problem.answer && (
              <div className="answer-section">
                <h4>Final Answer:</h4>
                <div dangerouslySetInnerHTML={{ __html: problem.answer }} />
              </div>
            )}
          </div>
        )}

        {/* New Problem Button */}
        <div className="footer-actions">
          <button className="new-problem-btn" onClick={handleNewProblem}>
            Generate New Problem
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;

