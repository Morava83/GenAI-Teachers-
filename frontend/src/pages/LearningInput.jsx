import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateProblem } from '../services/api';
import './LearningInput.css';

const LearningInput = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  const [formData, setFormData] = useState({
    topic: '',
    areaSubject: '',
    grade: '',
    dok: '',
    difficulty: '',
    language: 'English',
    interestValue: '',
    format: '',
    additionalRequirements: ''
  });

  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [feedback, setFeedback] = useState('');


  const areaOptions = [
    'Mathematics',
    'Algebra',
    'Geometry',
    'Calculus',
    'Statistics',
    'Trigonometry',
    'Pre-Algebra',
    'Advanced Mathematics'
  ];

  const dokOptions = [
    { value: '1', label: 'DOK 1 - Recall & Reproduction' },
    { value: '2', label: 'DOK 2 - Skills & Concepts' },
    { value: '3', label: 'DOK 3 - Strategic Thinking' },
    { value: '4', label: 'DOK 4 - Extended Thinking' },
    { value: 'LOT', label: 'LOT (Lower Order Thinking - DOK 1-2)' },
    { value: 'HOT', label: 'HOT (Higher Order Thinking - DOK 3-4)' }
  ];

  const languageOptions = [
    'English',
    'Spanish',
    'French',
    'German',
    'Arabic',
    'Chinese'
  ];

  const formatOptions = [
    'Multiple Choice',
    'Short Answer',
    'Word Problem',
    'Step-by-Step Solution',
    'Mixed Format'
  ];

  useEffect(() => {
    const prefs = localStorage.getItem('userPreferences');
    if (prefs) {
      const parsed = JSON.parse(prefs);
      const allTags = new Set();
      
      Object.values(parsed).forEach(value => {
        if (value) {
          value.split(',').forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) allTags.add(trimmed);
          });
        }
      });
      
      setTags(Array.from(allTags));
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setShowTagInput(false);
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.topic && !formData.areaSubject) {
      alert('Please enter a topic or select an area/subject');
      return;
    }

    setLoading(true);

    try {
      const response = await generateProblem({
        ...formData,
        selectedTags: tags
      });

      // Add metadata to the response for history
      const problemWithMeta = {
        ...response,
        topic: formData.topic || formData.areaSubject || 'Math Problem',
        createdAt: new Date().toISOString()
      };

      // Save current problem
      localStorage.setItem('generatedProblem', JSON.stringify(problemWithMeta));
      
      // Save to history
      const history = JSON.parse(localStorage.getItem('problemHistory') || '[]');
      history.unshift(problemWithMeta); // Add to beginning
      // Keep only last 50 problems
      localStorage.setItem('problemHistory', JSON.stringify(history.slice(0, 50)));

      navigate('/results');
    } catch (error) {
      console.error('Error generating problem:', error);
      alert('Failed to generate problem. Please make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="learning-input-container">
      {/* Navigation buttons */}
      <div className="nav-buttons">
        <button className="nav-btn home-btn" onClick={() => navigate('/')}>
          🏠︎ Home
        </button>
        <button className="nav-btn back-btn" onClick={() => navigate('/?questions=true')}>
          ← Back
        </button>
      </div>

      <div className="left-panel">
        <h1>Generate a Problem</h1>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="topic">Topic:</label>
            <input
              type="text"
              id="topic"
              name="topic"
              value={formData.topic}
              onChange={handleInputChange}
              placeholder="e.g., quadratic equations, addition, fractions"
            />
          </div>

          {/* Area/Subject Dropdown */}
          <div className="form-group">
            <label htmlFor="areaSubject">Area/Subject:</label>
            <select
              id="areaSubject"
              name="areaSubject"
              value={formData.areaSubject}
              onChange={handleInputChange}
            >
              <option value="">Select Area/Subject</option>
              {areaOptions.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* More Options Toggle */}
          <div 
            className="more-options-link" 
            onClick={() => setShowMoreOptions(!showMoreOptions)}
          >
            {showMoreOptions ? 'Less Options' : 'More Options'}
          </div>

          {/* Expandable More Options */}
          {showMoreOptions && (
            <div className="more-options">
              {/* Grade */}
              <div className="form-group">
                <label htmlFor="grade">Grade:</label>
                <select
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleInputChange}
                >
                  <option value="">Select Grade</option>
                  {[6, 7, 8, 9, 10, 11, 12].map(grade => (
                    <option key={grade} value={grade}>{grade}th Grade</option>
                  ))}
                </select>
              </div>

              {/* DOK (Depth of Knowledge) */}
              <div className="form-group">
                <label htmlFor="dok">Depth of Knowledge (DOK):</label>
                <select
                  id="dok"
                  name="dok"
                  value={formData.dok}
                  onChange={handleInputChange}
                >
                  <option value="">Select DOK Level</option>
                  {dokOptions.map(dok => (
                    <option key={dok.value} value={dok.value}>{dok.label}</option>
                  ))}
                </select>
              </div>

              {/* Difficulty */}
              <div className="form-group">
                <label htmlFor="difficulty">Difficulty:</label>
                <select
                  id="difficulty"
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleInputChange}
                >
                  <option value="">Select Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="challenging">Challenging</option>
                </select>
              </div>

              {/* Language */}
              <div className="form-group">
                <label htmlFor="language">Language:</label>
                <select
                  id="language"
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                >
                  {languageOptions.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Context/Theme */}
              <div className="form-group">
                <label htmlFor="interestValue">Context/Theme:</label>
                <input
                  type="text"
                  id="interestValue"
                  name="interestValue"
                  value={formData.interestValue}
                  onChange={handleInputChange}
                  placeholder="e.g., sports, cooking, travel, technology"
                />
              </div>

              {/* Format */}
              <div className="form-group">
                <label htmlFor="format">Format:</label>
                <select
                  id="format"
                  name="format"
                  value={formData.format}
                  onChange={handleInputChange}
                >
                  <option value="">Select Format</option>
                  {formatOptions.map(format => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </select>
              </div>

              {/* Additional Requirements */}
              <div className="form-group">
                <label htmlFor="additionalRequirements">Additional Requirements:</label>
                <input
                  type="text"
                  id="additionalRequirements"
                  name="additionalRequirements"
                  value={formData.additionalRequirements}
                  onChange={handleInputChange}
                  placeholder="e.g., include diagrams, show all work"
                />
              </div>
            </div>
          )}

          {/* Tags/Themes */}
          <div className="form-group">
            <h3>Topics of Interest:</h3>
            <div className="tag-container">
              {tags.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                  <button 
                    type="button" 
                    onClick={() => removeTag(tag)}
                    className="tag-remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            {showTagInput ? (
              <div className="tag-input-container">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Type and press Enter"
                />
                <button type="button" onClick={addTag}>Add</button>
              </div>
            ) : (
              <button 
                type="button" 
                className="add-tag-btn"
                onClick={() => setShowTagInput(true)}
              >
                +
              </button>
            )}
          </div>

          {/* Feedback Section */}
          <div className="feedback-section">
            <h3>📝 Feedback</h3>
            <textarea
            className="feedback-input"
            placeholder="Enter feedback here..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            />
          </div>

          {/* Generate Button */}
          <button 
            type="submit" 
            className={`generate-btn ${loading ? 'generating' : ''}`}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LearningInput;

