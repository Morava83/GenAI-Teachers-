import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Personalization.css';

const Personalization = () => {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answers, setAnswers] = useState({
    question1: '',
    question2: '',
    question3: ''
  });

  const totalQuestions = 3;

  const questions = [
    {
      id: 1,
      label: "What are your hobbies? (3-5)",
      placeholder: "Enter your hobbies, separated by commas",
      example: "reading, swimming, photography"
    },
    {
      id: 2,
      label: "What topics are you always interested in discussing? (3-5)",
      placeholder: "Enter topics you're interested in, separated by commas",
      example: "technology, art, science"
    },
    {
      id: 3,
      label: "What types of books and videos do you usually enjoy? (3-5)",
      placeholder: "Enter your preferred content types, separated by commas",
      example: "mystery novels, educational videos, documentaries"
    }
  ];

  useEffect(() => {
    // Load saved preferences
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
      // All questions completed
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

  const currentQ = questions[currentQuestion - 1];

  return (
    <div className="personalization-container">
      <h1>Personalization</h1>
      <div className="progress">Question {currentQuestion} of {totalQuestions}</div>
      
      <div className="question">
        <label>{currentQ.label}</label>
        <textarea 
          value={answers[`question${currentQuestion}`] || ''}
          onChange={handleInputChange}
          placeholder={currentQ.placeholder}
          rows={5}
        />
        <div className="note">Example: {currentQ.example}</div>
      </div>

      <div className="button-group">
        <button className="skip-btn" onClick={handleSkip}>
          Skip
        </button>
        <button className="next-btn" onClick={handleNext}>
          {currentQuestion === totalQuestions ? 'Continue' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default Personalization;

