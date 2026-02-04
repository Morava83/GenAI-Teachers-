import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Results.css';

const Results = () => {
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [settings, setSettings] = useState({
    includeHints: true,
    includeSolutions: true
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    // Load the generated problem from localStorage
    const stored = localStorage.getItem('generatedProblem');
    if (stored) {
      setProblem(JSON.parse(stored));
    } else {
      // No problem found, redirect back
      navigate('/learning');
    }
  }, [navigate]);

  // Re-render MathJax whenever content changes
  useEffect(() => {
    const renderMath = () => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        // Clear any previous typesetting first
        window.MathJax.typesetClear && window.MathJax.typesetClear();
        // Then typeset the new content
        window.MathJax.typesetPromise()
          .catch((err) => console.warn('MathJax error:', err));
      }
    };

    // Give the DOM a moment to update, then render math
    const timer = setTimeout(renderMath, 100);
    return () => clearTimeout(timer);
  }, [problem, showHints, showSolution]);

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
      {/* Navigation buttons */}
      <div className="nav-buttons">
        <button className="nav-btn home-btn" onClick={() => navigate('/')}>
          🏠︎ Home
        </button>
        <button className="nav-btn back-btn" onClick={() => navigate('/learning')}>
          ← Back
        </button>
      </div>

      <div className="results-header">
        <h1>Generated Problem</h1>
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

        {/* Action Buttons - only show if at least one is enabled */}
        {(settings.includeHints || settings.includeSolutions) && (
          <div className="action-buttons">
            {settings.includeHints && (
              <button 
                className={`action-button ${showHints ? 'active' : ''}`}
                onClick={() => setShowHints(!showHints)}
              >
                {showHints ? 'Hide Hints' : 'Show Hints'}
              </button>
            )}
            {settings.includeSolutions && (
              <button 
                className={`action-button ${showSolution ? 'active' : ''}`}
                onClick={() => setShowSolution(!showSolution)}
              >
                {showSolution ? 'Hide Solution' : 'Show Solution'}
              </button>
            )}
          </div>
        )}

        {/* Hints Section */}
        {settings.includeHints && showHints && (
          <div className="hints-section">
            <h3>💡 Hints</h3>
            <div 
              className="hints-content"
              dangerouslySetInnerHTML={{ __html: problem.hints || 'No hints available' }}
            />
          </div>
        )}

        {/* Solution Section */}
        {settings.includeSolutions && showSolution && (
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

