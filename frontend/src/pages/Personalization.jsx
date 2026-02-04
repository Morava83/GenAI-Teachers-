import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Personalization.css';

const Personalization = () => {
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answers, setAnswers] = useState({
    question1: '',
    question2: '',
    question3: ''
  });

  const totalQuestions = 3;

  // Check URL parameters to determine initial view
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('questions') === 'true') {
      setShowLanding(false);
    }
  }, []);

  // Floating math symbols for the background
  const mathSymbols = [
    '∫', '∑', 'π', '√', '∞', 'Δ', '∂', 'θ', 'λ', '÷',
    '×', '±', '≈', '≠', '≤', '≥', 'α', 'β', 'γ', 'φ'
  ];

  const questions = [
    {
      id: 1,
      label: "What are your hobbies?",
      placeholder: "Enter your hobbies, separated by commas",
      example: "reading, swimming, photography"
    },
    {
      id: 2,
      label: "What topics are you always interested in discussing?",
      placeholder: "Enter topics you're interested in, separated by commas",
      example: "technology, art, science"
    },
    {
      id: 3,
      label: "What types of books and videos do you usually enjoy?",
      placeholder: "Enter your preferred content types, separated by commas",
      example: "mystery novels, educational videos, documentaries"
    }
  ];

  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      setAnswers(JSON.parse(saved));
    }
  }, []);

  const handleInputChange = (e) => {
    const newAnswers = {
      ...answers,
      [`question${currentQuestion}`]: e.target.value
    };
    setAnswers(newAnswers);
    localStorage.setItem('userPreferences', JSON.stringify(newAnswers));
  };

  const handleNext = () => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      navigate('/learning');
    }
  };

  const handleSkip = () => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      navigate('/learning');
    }
  };

  const handleGetStarted = () => {
    setShowLanding(false);
  };

  const handleSkipPersonalization = () => {
    navigate('/learning');
  };

  const currentQ = questions[currentQuestion - 1];

  const handleAccount = () => {
    navigate('/account');
  };

  // Landing page view
  if (showLanding) {
    return (
      <div className="landing-container">
        {/* Account button */}
        <button className="account-btn" onClick={handleAccount}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Account</span>
        </button>

        {/* Floating math symbols background */}
        <div className="math-background">
          {mathSymbols.map((symbol, index) => (
            <span
              key={index}
              className="floating-symbol"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
                fontSize: `${1.5 + Math.random() * 2}rem`,
                opacity: 0.1 + Math.random() * 0.15
              }}
            >
              {symbol}
            </span>
          ))}
        </div>

        {/* Hero content */}
        <div className="hero-content">
          <div className="logo-section">
            <div className="logo-icon">
              <span className="logo-sigma">∑</span>
            </div>
            <h1 className="hero-title">GenAI for Teachers</h1>
          </div>
          
          <p className="hero-subtitle">
            AI-Powered Math Problem Generation
          </p>
          
          <p className="hero-description">
            A platform designed for teachers to generate customized math problems. 
            Create engaging questions tailored to your students' needs in seconds.
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">∫</div>
              <h3>Customizable</h3>
              <p>Set difficulty, topic & format</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">π</div>
              <h3>AI-Powered</h3>
              <p>Instant problem generation</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">∞</div>
              <h3>Unlimited</h3>
              <p>Create as many as you need</p>
            </div>
          </div>

          <div className="cta-buttons">
            <button className="cta-primary" onClick={handleGetStarted}>
              Get Started
            </button>
          </div>

          <div className="equation-display">
            <span>f(x) = </span>
            <span className="equation-highlight">great teaching</span>
            <span> × smart tools</span>
          </div>
        </div>
      </div>
    );
  }

  // Personalization questions view
  return (
    <div className="personalization-page">
      {/* Navigation buttons */}
      <div className="nav-buttons">
        <button className="nav-btn home-btn" onClick={() => { 
          localStorage.removeItem('userPreferences');
          localStorage.removeItem('generatedProblem');
          localStorage.removeItem('userSettings');
          setAnswers({
            question1: '',
            question2: '',
            question3: ''
          });
          setCurrentQuestion(1);
          setShowLanding(true);
        }}>
          🏠︎ Home
        </button>
      </div>

      <div className="math-background light">
        {mathSymbols.slice(0, 10).map((symbol, index) => (
          <span
            key={index}
            className="floating-symbol"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
              fontSize: `${1 + Math.random() * 1.5}rem`,
              opacity: 0.05 + Math.random() * 0.1
            }}
          >
            {symbol}
          </span>
        ))}
      </div>

      <div className="personalization-container">
        <div className="personalization-header">
          <h1>Personalize Your Experience</h1>
          <p className="subtitle">Help us create better problems for you</p>
        </div>

        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
          />
        </div>
        <div className="progress-text">
          Step {currentQuestion} of {totalQuestions}
        </div>
        
        <div className="question-card">
          <label>{currentQ.label}</label>
          <textarea 
            value={answers[`question${currentQuestion}`] || ''}
            onChange={handleInputChange}
            placeholder={currentQ.placeholder}
            rows={4}
          />
          <div className="note">Example: {currentQ.example}</div>
        </div>

        <div className="button-group">
          <button className="skip-btn" onClick={handleSkip}>
            Skip
          </button>
          <button className="next-btn" onClick={handleNext}>
            {currentQuestion === totalQuestions ? 'Start Learning' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Personalization;

