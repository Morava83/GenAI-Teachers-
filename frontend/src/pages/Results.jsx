import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateProblem } from '../services/api';
import './Results.css';

const Results = () => {
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [elaboration, setElaboration] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [isEditingProblem, setIsEditingProblem] = useState(false);
  const [editedProblemText, setEditedProblemText] = useState('');
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
        {problem.isOffline && (
          <div className="offline-notice">
            ⚠️ Backend unavailable - showing a sample problem
          </div>
        )}
      </div>

      <div className="results-content">
        {/* Problem Section */}
        <div className="problem-section">
          <h2>Problem</h2>
          {isEditingProblem ? (
            <div className="problem-edit-container">
              <textarea
                className="problem-edit-input"
                value={editedProblemText}
                onChange={(e) => setEditedProblemText(e.target.value)}
                autoFocus
              />
              <div className="problem-edit-buttons">
                <button 
                  className="problem-edit-btn save-btn"
                  onClick={() => {
                    const updatedProblem = {
                      ...problem,
                      problem: editedProblemText
                    };
                    setProblem(updatedProblem);
                    localStorage.setItem('generatedProblem', JSON.stringify(updatedProblem));
                    
                    // Also update in history
                    const history = JSON.parse(localStorage.getItem('problemHistory') || '[]');
                    const updatedHistory = history.map(item => 
                      item.createdAt === problem.createdAt 
                        ? { ...item, problem: editedProblemText }
                        : item
                    );
                    localStorage.setItem('problemHistory', JSON.stringify(updatedHistory));
                    
                    setIsEditingProblem(false);
                  }}
                >
                  Save
                </button>
                <button 
                  className="problem-edit-btn cancel-btn"
                  onClick={() => {
                    setIsEditingProblem(false);
                    setEditedProblemText(problem.problem);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="problem-content editable"
              onClick={() => {
                setEditedProblemText(problem.problem);
                setIsEditingProblem(true);
              }}
              title="Click to edit"
              dangerouslySetInnerHTML={{ __html: problem.problem }}
            />
          )}
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

        {/* Thumbs Up/Down Feedback */}
        <div className="feedback-rating">
          <div className="rating-buttons">
            <div className="rating-btn-wrapper">
              <button 
                className={`rating-btn thumbs-up ${selectedRating === 'up' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRating('up');
                  setShowFeedback(false);
                }}
                title="Good problem"
              >
                👍
              </button>
              <span className="rating-btn-label">Useful</span>
            </div>
            <div className="rating-btn-wrapper">
              <button 
                className={`rating-btn thumbs-down ${selectedRating === 'down' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRating('down');
                  setShowFeedback(true);
                }}
                title="Provide feedback"
              >
                👎
              </button>
              <span className="rating-btn-label">Not Useful</span>
            </div>
          </div>
        </div>

        {/* Feedback Box */}
        {showFeedback && (
          <div className="feedback-section">
            <h3>📝 What could be improved?</h3>
            {feedbackSubmitted ? (
              <div className="feedback-thanks">
                Thank you for your feedback!
              </div>
            ) : (
              <>
                <div className="preset-feedback-buttons">
                  {[
                    'Incorrect Solution',
                    'Poor Hint',
                    'Question Too Long',
                    'Question Too Short',
                    'Too Difficult',
                    'Too Easy',
                    'Unclear Wording',
                    'Other'
                  ].map((preset) => (
                    <button
                      key={preset}
                      className={`preset-btn ${selectedPreset === preset ? 'selected' : ''}`}
                      onClick={() => {
                        if (selectedPreset === preset) {
                          setSelectedPreset(null);
                          setElaboration('');
                        } else {
                          setSelectedPreset(preset);
                        }
                      }}
                      disabled={isRegenerating}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {selectedPreset && (
                  <div className="elaboration-section">
                    <p className="elaboration-prompt">
                      Would you like to provide more details? <span className="optional-tag">(Optional)</span>
                    </p>
                    <textarea
                      className="feedback-input"
                      placeholder="Add more details here..."
                      value={elaboration}
                      onChange={(e) => setElaboration(e.target.value)}
                      rows={3}
                      disabled={isRegenerating}
                    />
                    <div className="feedback-buttons">
                      <button 
                        className="feedback-btn regenerate-btn"
                        onClick={async () => {
                          setIsRegenerating(true);
                          
                          const baseFormData = problem.originalFormData || {
                            topic: problem.topic || 'Math Problem',
                            areaSubject: '',
                            grade: '',
                            dok: '',
                            difficulty: '',
                            language: 'English',
                            interestValue: '',
                            format: '',
                            additionalRequirements: '',
                            selectedTags: []
                          };
                          
                          const feedbackText = elaboration.trim()
                            ? `${selectedPreset}: ${elaboration}`
                            : selectedPreset;
                          
                          const formDataWithFeedback = {
                            ...baseFormData,
                            additionalRequirements: baseFormData.additionalRequirements
                              ? `${baseFormData.additionalRequirements}. User feedback: ${feedbackText}`
                              : `User feedback: ${feedbackText}`
                          };
                          
                          try {
                            const response = await generateProblem(formDataWithFeedback);
                            
                            const problemWithMeta = {
                              ...response,
                              topic: problem.topic || 'Math Problem',
                              createdAt: new Date().toISOString(),
                              originalFormData: formDataWithFeedback
                            };
                            
                            localStorage.setItem('generatedProblem', JSON.stringify(problemWithMeta));
                            setProblem(problemWithMeta);
                            setSelectedPreset(null);
                            setElaboration('');
                            setShowFeedback(false);
                            setShowHints(false);
                            setShowSolution(false);
                            setSelectedRating(null);
                          } catch (error) {
                            console.error('Error regenerating problem:', error);
                          } finally {
                            setIsRegenerating(false);
                          }
                        }}
                        disabled={isRegenerating}
                      >
                        {isRegenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
                      </button>
                      <button 
                        className="feedback-btn submit-only-btn"
                        onClick={() => {
                          setFeedbackSubmitted(true);
                          setSelectedPreset(null);
                          setElaboration('');
                        }}
                        disabled={isRegenerating}
                      >
                        Submit Feedback Only
                      </button>
                    </div>
                  </div>
                )}
              </>
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

