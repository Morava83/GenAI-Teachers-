import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import './Account.css';

const Account = () => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('userSettings');
    return saved ? JSON.parse(saved) : {
      defaultLanguage: 'English',
      includeHints: true,
      includeSolutions: true
    };
  });
  const [problemHistory, setProblemHistory] = useState([]);
  const [problemSets, setProblemSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Modal state
  const [showSetModal, setShowSetModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [newSetName, setNewSetName] = useState('');
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'sets'
  const [expandedSet, setExpandedSet] = useState(null);

  useEffect(() => {
    fetchUser();
    loadProblemHistory();
    loadProblemSets();
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'admin@mathforge.edu')
        .single();

      if (fetchError) {
        console.warn('Supabase fetch failed, using mock data:', fetchError.message);
        setUser({
          id: '1',
          name: 'Admin User',
          email: 'admin@mathforge.edu',
          role: 'Administrator',
          avatar_url: null,
          created_at: '2024-01-15',
          problems_generated: 127,
          students_helped: 45,
          settings: {
            defaultLanguage: 'English',
            includeHints: true,
            includeSolutions: true
          }
        });
        setIsConnected(false);
      } else {
        setUser(data);
        setIsConnected(true);
        if (data.settings) {
          setSettings(data.settings);
          localStorage.setItem('userSettings', JSON.stringify(data.settings));
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to load user data');
      setUser({
        id: '1',
        name: 'Admin User',
        email: 'admin@mathforge.edu',
        role: 'Administrator',
        avatar_url: null,
        created_at: '2024-01-15',
        problems_generated: 127,
        students_helped: 45,
        settings: {
          defaultLanguage: 'English',
          includeHints: true,
          includeSolutions: true
        }
      });
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadProblemHistory = () => {
    const history = localStorage.getItem('problemHistory');
    if (history) {
      setProblemHistory(JSON.parse(history));
    }
  };

  const loadProblemSets = () => {
    const sets = localStorage.getItem('problemSets');
    if (sets) {
      setProblemSets(JSON.parse(sets));
    }
  };

  const saveProblemSets = (sets) => {
    localStorage.setItem('problemSets', JSON.stringify(sets));
    setProblemSets(sets);
  };

  const handleViewProblem = (problem) => {
    localStorage.setItem('generatedProblem', JSON.stringify(problem));
    navigate('/results');
  };

  const handleDeleteProblem = (e, index) => {
    e.stopPropagation();
    const newHistory = [...problemHistory];
    newHistory.splice(index, 1);
    localStorage.setItem('problemHistory', JSON.stringify(newHistory));
    setProblemHistory(newHistory);
  };

  const handleOpenSetModal = (e, problem) => {
    e.stopPropagation();
    setSelectedProblem(problem);
    setShowSetModal(true);
    setNewSetName('');
  };

  const handleAddToSet = (setName) => {
    const existingSet = problemSets.find(s => s.name === setName);
    
    if (existingSet) {
      // Add to existing set
      const updatedSets = problemSets.map(s => {
        if (s.name === setName) {
          // Check if problem already in set
          const exists = s.problems.some(p => 
            p.createdAt === selectedProblem.createdAt && p.problem === selectedProblem.problem
          );
          if (!exists) {
            return { ...s, problems: [...s.problems, selectedProblem] };
          }
        }
        return s;
      });
      saveProblemSets(updatedSets);
    }
    
    setShowSetModal(false);
    setSelectedProblem(null);
  };

  const handleCreateSet = () => {
    if (!newSetName.trim()) return;
    
    const newSet = {
      name: newSetName.trim(),
      createdAt: new Date().toISOString(),
      problems: selectedProblem ? [selectedProblem] : []
    };
    
    const updatedSets = [...problemSets, newSet];
    saveProblemSets(updatedSets);
    setShowSetModal(false);
    setSelectedProblem(null);
    setNewSetName('');
  };

  const handleDeleteSet = (e, setIndex) => {
    e.stopPropagation();
    const newSets = [...problemSets];
    newSets.splice(setIndex, 1);
    saveProblemSets(newSets);
    if (expandedSet === setIndex) {
      setExpandedSet(null);
    }
  };

  const handleRemoveFromSet = (e, setIndex, problemIndex) => {
    e.stopPropagation();
    const newSets = [...problemSets];
    newSets[setIndex].problems.splice(problemIndex, 1);
    saveProblemSets(newSets);
  };

  const handleClearHistory = () => {
    localStorage.removeItem('problemHistory');
    setProblemHistory([]);
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));

    if (isConnected && user?.id) {
      try {
        setSaving(true);
        const { error: updateError } = await supabase
          .from('users')
          .update({ settings: newSettings })
          .eq('id', user.id);

        if (updateError) {
          console.error('Failed to save settings:', updateError);
        }
      } catch (err) {
        console.error('Error saving settings:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="account-page">
        <div className="account-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading account...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="account-page">
        <div className="account-container">
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchUser}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-bg-decoration">
        <div className="bg-circle circle-1"></div>
        <div className="bg-circle circle-2"></div>
        <div className="bg-circle circle-3"></div>
      </div>

      <div className="account-container">
        {/* Header */}
        <div className="account-header">
          <button className="back-button" onClick={handleBack}>
            <span>&larr;</span> Back
          </button>
          <h1>Account</h1>
        </div>

        {/* Profile Section */}
        <div className="profile-section">
          <div className="avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} />
            ) : (
              <div className="avatar-placeholder">
                {user.name?.split(' ').map(n => n[0]).join('') || 'AU'}
              </div>
            )}
            <div className="role-badge">{user.role || 'User'}</div>
          </div>
          
          <div className="profile-info">
            <h2>{user.name}</h2>
            <p className="email">{user.email}</p>
            <p className="member-since">
              Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <h3>Your Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">∑</div>
              <div className="stat-value">{user.problems_generated || 0}</div>
              <div className="stat-label">Problems Generated</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">π</div>
              <div className="stat-value">{user.students_helped || 0}</div>
              <div className="stat-label">Students Helped</div>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="settings-section">
          <div className="settings-header">
            <h3>Default Settings</h3>
            {saving && <span className="saving-indicator">Saving...</span>}
          </div>
          
          <div className="setting-item">
            <div className="setting-info">
              <label>Default Language</label>
              <p>Language for generated problems</p>
            </div>
            <select 
              value={settings.defaultLanguage}
              onChange={(e) => handleSettingChange('defaultLanguage', e.target.value)}
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Arabic">Arabic</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Include Hints</label>
              <p>Automatically include hints with problems</p>
            </div>
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={settings.includeHints}
                onChange={(e) => handleSettingChange('includeHints', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Include Solutions</label>
              <p>Automatically include solutions with problems</p>
            </div>
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={settings.includeSolutions}
                onChange={(e) => handleSettingChange('includeSolutions', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Problems Section with Tabs */}
        <div className="problems-section">
          <div className="tabs-header">
            <button 
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History ({problemHistory.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`}
              onClick={() => setActiveTab('sets')}
            >
              Sets ({problemSets.length})
            </button>
          </div>

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="tab-content">
              <div className="tab-actions">
                {problemHistory.length > 0 && (
                  <button className="clear-history-btn" onClick={handleClearHistory}>
                    Clear All
                  </button>
                )}
              </div>
              
              {problemHistory.length === 0 ? (
                <div className="empty-state">
                  <p>No problems generated yet</p>
                </div>
              ) : (
                <div className="history-list">
                  {problemHistory.slice(0, 20).map((item, index) => (
                    <div key={index} className="history-item">
                      <div 
                        className="history-item-main"
                        onClick={() => handleViewProblem(item)}
                      >
                        <div className="history-item-content">
                          <span className="history-topic">{item.topic || 'Math Problem'}</span>
                          <span className="history-date">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="history-item-actions">
                        <button 
                          className="action-icon-btn add-btn"
                          onClick={(e) => handleOpenSetModal(e, item)}
                          title="Add to Set"
                        >
                          +
                        </button>
                        <button 
                          className="action-icon-btn delete-btn"
                          onClick={(e) => handleDeleteProblem(e, index)}
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sets Tab */}
          {activeTab === 'sets' && (
            <div className="tab-content">
              <div className="tab-actions">
                <button 
                  className="create-set-btn"
                  onClick={() => {
                    setSelectedProblem(null);
                    setShowSetModal(true);
                  }}
                >
                  + New Set
                </button>
              </div>
              
              {problemSets.length === 0 ? (
                <div className="empty-state">
                  <p>No problem sets yet</p>
                  <p className="empty-hint">Create a set to organize your problems</p>
                </div>
              ) : (
                <div className="sets-list">
                  {problemSets.map((set, setIndex) => (
                    <div key={setIndex} className="set-card">
                      <div 
                        className="set-header"
                        onClick={() => setExpandedSet(expandedSet === setIndex ? null : setIndex)}
                      >
                        <div className="set-info">
                          <span className="set-name">{set.name}</span>
                          <span className="set-count">{set.problems.length} problems</span>
                        </div>
                        <div className="set-actions">
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={(e) => handleDeleteSet(e, setIndex)}
                            title="Delete Set"
                          >
                            ×
                          </button>
                          <span className={`expand-icon ${expandedSet === setIndex ? 'expanded' : ''}`}>
                            ▼
                          </span>
                        </div>
                      </div>
                      
                      {expandedSet === setIndex && (
                        <div className="set-problems">
                          {set.problems.length === 0 ? (
                            <p className="empty-set">No problems in this set</p>
                          ) : (
                            set.problems.map((problem, problemIndex) => (
                              <div key={problemIndex} className="set-problem-item">
                                <div 
                                  className="set-problem-main"
                                  onClick={() => handleViewProblem(problem)}
                                >
                                  <span className="problem-topic">{problem.topic || 'Math Problem'}</span>
                                </div>
                                <button 
                                  className="action-icon-btn delete-btn small"
                                  onClick={(e) => handleRemoveFromSet(e, setIndex, problemIndex)}
                                  title="Remove from Set"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Database Info */}
        <div className="database-section">
          <div className={`database-badge ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="db-icon">⚡</span>
            <span>{isConnected ? 'Connected to Supabase' : 'Using Local Data'}</span>
            <span className={`status-dot ${isConnected ? '' : 'offline'}`}></span>
          </div>
        </div>
      </div>

      {/* Add to Set Modal */}
      {showSetModal && (
        <div className="modal-overlay" onClick={() => setShowSetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedProblem ? 'Add to Set' : 'Create New Set'}</h3>
            
            {/* Create new set */}
            <div className="modal-section">
              <label>Create new set:</label>
              <div className="new-set-input">
                <input
                  type="text"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="Enter set name..."
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateSet()}
                />
                <button onClick={handleCreateSet} disabled={!newSetName.trim()}>
                  Create
                </button>
              </div>
            </div>
            
            {/* Existing sets */}
            {selectedProblem && problemSets.length > 0 && (
              <div className="modal-section">
                <label>Or add to existing set:</label>
                <div className="existing-sets">
                  {problemSets.map((set, index) => (
                    <button
                      key={index}
                      className="existing-set-btn"
                      onClick={() => handleAddToSet(set.name)}
                    >
                      {set.name}
                      <span className="set-problem-count">{set.problems.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <button className="modal-close-btn" onClick={() => setShowSetModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
