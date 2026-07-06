import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { BACKEND_TYPES, BACKEND_LABELS, BACKEND_DESCRIPTIONS, DEFAULT_CONFIGS, BACKEND_PRIVACY_WARNINGS, BACKEND_TECHNICAL_SETUP, loadBackendConfig, saveBackendConfig } from '../services/backendConfig';
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

  // Backend config state
  const [backendType, setBackendType] = useState(BACKEND_TYPES.PLACEHOLDER);
  const [backendSettings, setBackendSettings] = useState({});
  const [showApiKey, setShowApiKey] = useState({});
  const [backendExpanded, setBackendExpanded] = useState(false);
  const [setupExpanded, setSetupExpanded] = useState(false);
  
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
    loadBackendConfig_();
  }, []);

  const loadBackendConfig_ = () => {
    const config = loadBackendConfig();
    setBackendType(config.type || BACKEND_TYPES.PLACEHOLDER);
    // Merge saved config with defaults
    const defaults = DEFAULT_CONFIGS[config.type || BACKEND_TYPES.PLACEHOLDER];
    setBackendSettings({ ...defaults, ...config });
  };

  const handleBackendTypeChange = (newType) => {
    const typeChanged = newType !== backendType;
    setBackendType(newType);
    const defaults = DEFAULT_CONFIGS[newType];
    setBackendSettings({ ...defaults });
    if (typeChanged) {
      setBackendExpanded(true);
      setSetupExpanded(true);
    }
  };

  const handleBackendSettingChange = (key, value) => {
    const updated = { ...backendSettings, [key]: value };
    setBackendSettings(updated);
    saveBackendConfig({ type: backendType, ...updated });
  };

  const handleBackendSave = () => {
    saveBackendConfig({ type: backendType, ...backendSettings });
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use mock data if Supabase is not configured
      if (!supabase) {
        console.warn('Supabase not configured, using mock data');
        setUser({
          id: '1',
          name: 'Admin User',
          email: 'admin@mathmind.edu',
          role: 'Administrator',
          avatar_url: null,
          created_at: '2024-01-15',
          problems_generated: 127,
          settings: {
            defaultLanguage: 'English',
            includeHints: true,
            includeSolutions: true
          }
        });
        setIsConnected(false);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'admin@mathmind.edu')
        .single();

      if (fetchError) {
        console.warn('Supabase fetch failed, using mock data:', fetchError.message);
        setUser({
          id: '1',
          name: 'Admin User',
          email: 'admin@mathmind.edu',
          role: 'Administrator',
          avatar_url: null,
          created_at: '2024-01-15',
          problems_generated: 127,
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
        email: 'admin@mathmind.edu',
        role: 'Administrator',
        avatar_url: null,
        created_at: '2024-01-15',
        problems_generated: 127,
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

    if (isConnected && user?.id && supabase) {
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
              <div className="stat-value">{problemHistory.length}</div>
              <div className="stat-label">Problems Generated</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📁</div>
              <div className="stat-value">{problemSets.length}</div>
              <div className="stat-label">Sets Created</div>
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

        {/* Backend Configuration Section - Collapsible */}
        <div className="settings-section">
          <div className="settings-header">
            <h3>AI Backend Configuration</h3>
            {saving && <span className="saving-indicator">Saved!</span>}
          </div>

          {/* Compact Summary Bar (always visible) */}
          <div
            className="backend-summary-bar"
            onClick={() => setBackendExpanded(!backendExpanded)}
          >
            <div className="backend-summary-info">
              <span className="backend-summary-label">Current:</span>
              <span className="backend-summary-type">
                {BACKEND_LABELS[backendType]}
              </span>
              {BACKEND_PRIVACY_WARNINGS[backendType] && (
                <span className="backend-privacy-badge">
                  ⚠️ Data sent to external server
                </span>
              )}
              {backendType === BACKEND_TYPES.PLACEHOLDER && (
                <span className="backend-privacy-badge safe">
                  ✓ Local only
                </span>
              )}
              {backendType === BACKEND_TYPES.LOCAL && (
                <span className="backend-privacy-badge safe">
                  ✓ Local only
                </span>
              )}
            </div>
            <span className={`backend-expand-icon ${backendExpanded ? 'expanded' : ''}`}>
              ▼
            </span>
          </div>

          {/* Expanded Detail Panel */}
          {backendExpanded && (
            <div className="backend-detail-panel">
              {/* Privacy Warning (for applicable backends) */}
              {BACKEND_PRIVACY_WARNINGS[backendType] && (
                <div className="backend-privacy-warning">
                  <div className="backend-privacy-warning-header">
                    <span className="warning-icon">{BACKEND_PRIVACY_WARNINGS[backendType].icon}</span>
                    <span className="warning-title">{BACKEND_PRIVACY_WARNINGS[backendType].title}</span>
                  </div>
                  <ul className="warning-list">
                    {BACKEND_PRIVACY_WARNINGS[backendType].content.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Backend Type Selector */}
              <div className="setting-item">
                <div className="setting-info">
                  <label>Backend Type</label>
                  <p>Select the AI backend for problem generation</p>
                </div>
                <select
                  value={backendType}
                  onChange={(e) => handleBackendTypeChange(e.target.value)}
                >
                  {Object.entries(BACKEND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="backend-info-box">
                <span className="backend-info-icon">ℹ</span>
                <span>{BACKEND_DESCRIPTIONS[backendType]}</span>
              </div>

              {/* Local Ollama Settings */}
              {backendType === BACKEND_TYPES.LOCAL && (
                <>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Ollama URL</label>
                      <p>Server address (default: localhost)</p>
                    </div>
                    <input
                      type="text"
                      value={backendSettings.ollamaUrl || 'http://localhost:11434'}
                      onChange={(e) => handleBackendSettingChange('ollamaUrl', e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Model</label>
                      <p>Model name (must match downloaded model)</p>
                    </div>
                    <input
                      type="text"
                      value={backendSettings.ollamaModel || 'llama3.1:8b'}
                      onChange={(e) => handleBackendSettingChange('ollamaModel', e.target.value)}
                      placeholder="llama3.1:8b"
                    />
                  </div>
                </>
              )}

              {/* OpenAI Settings */}
              {backendType === BACKEND_TYPES.OPENAI && (
                <>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>OpenAI API Key</label>
                      <p>From platform.openai.com</p>
                    </div>
                    <div className="password-input-wrapper">
                      <input
                        type={showApiKey.openai ? 'text' : 'password'}
                        value={backendSettings.openaiApiKey || ''}
                        onChange={(e) => handleBackendSettingChange('openaiApiKey', e.target.value)}
                        placeholder="sk-..."
                      />
                      <button
                        type="button"
                        className="toggle-visibility-btn"
                        onClick={() => setShowApiKey({ ...showApiKey, openai: !showApiKey.openai })}
                      >
                        {showApiKey.openai ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Model</label>
                      <p>OpenAI model</p>
                    </div>
                    <select
                      value={backendSettings.openaiModel || 'gpt-4o-mini'}
                      onChange={(e) => handleBackendSettingChange('openaiModel', e.target.value)}
                    >
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (recommended)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>
                </>
              )}

              {/* Zhipu AI Settings */}
              {backendType === BACKEND_TYPES.ZHIPU && (
                <>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Zhipu AI API Key</label>
                      <p>From bigmodel.cn</p>
                    </div>
                    <div className="password-input-wrapper">
                      <input
                        type={showApiKey.zhipu ? 'text' : 'password'}
                        value={backendSettings.zhipuApiKey || ''}
                        onChange={(e) => handleBackendSettingChange('zhipuApiKey', e.target.value)}
                        placeholder="..."
                      />
                      <button
                        type="button"
                        className="toggle-visibility-btn"
                        onClick={() => setShowApiKey({ ...showApiKey, zhipu: !showApiKey.zhipu })}
                      >
                        {showApiKey.zhipu ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Model</label>
                      <p>Zhipu model</p>
                    </div>
                    <select
                      value={backendSettings.zhipuModel || 'glm-4-flash'}
                      onChange={(e) => handleBackendSettingChange('zhipuModel', e.target.value)}
                    >
                      <option value="glm-4">GLM-4</option>
                      <option value="glm-4-flash">GLM-4 Flash (recommended)</option>
                      <option value="glm-4-plus">GLM-4 Plus</option>
                      <option value="glm-4-air">GLM-4 Air</option>
                      <option value="glm-4-airx">GLM-4 AirX</option>
                    </select>
                  </div>
                </>
              )}

              {/* Calcul Quebec Settings */}
              {backendType === BACKEND_TYPES.CALCUL_QUEBC && (
                <>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Calcul Quebec API URL</label>
                      <p>Your HPC server address</p>
                    </div>
                    <input
                      type="text"
                      value={backendSettings.cqApiUrl || ''}
                      onChange={(e) => handleBackendSettingChange('cqApiUrl', e.target.value)}
                      placeholder="https://your-server.ca"
                    />
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>API Key (optional)</label>
                      <p>Authentication key if required</p>
                    </div>
                    <input
                      type="text"
                      value={backendSettings.cqApiKey || ''}
                      onChange={(e) => handleBackendSettingChange('cqApiKey', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Model</label>
                      <p>Model available on HPC server</p>
                    </div>
                    <input
                      type="text"
                      value={backendSettings.cqModel || 'llama3.1:8b'}
                      onChange={(e) => handleBackendSettingChange('cqModel', e.target.value)}
                      placeholder="llama3.1:8b"
                    />
                  </div>
                </>
              )}

              {/* Technical Setup Guide - Collapsible */}
              <div className="backend-setup-section">
                <button
                  className="backend-setup-toggle"
                  onClick={() => setSetupExpanded(!setupExpanded)}
                >
                  <span className="setup-toggle-icon">{setupExpanded ? '▼' : '▶'}</span>
                  <span>Technical Setup Guide</span>
                  <span className="setup-toggle-hint">
                    {setupExpanded ? 'Hide' : 'Show'} setup instructions for {BACKEND_LABELS[backendType]}
                  </span>
                </button>

                {setupExpanded && BACKEND_TECHNICAL_SETUP[backendType] && (
                  <div className="backend-setup-content">
                    {/* Overview */}
                    {BACKEND_TECHNICAL_SETUP[backendType].overview && (
                      <div className="setup-overview">
                        <p>{BACKEND_TECHNICAL_SETUP[backendType].overview}</p>
                      </div>
                    )}

                    {/* Requirements */}
                    {BACKEND_TECHNICAL_SETUP[backendType].requirements && (
                      <div className="setup-block">
                        <h4 className="setup-block-title">Requirements</h4>
                        <ul className="setup-requirements-list">
                          {BACKEND_TECHNICAL_SETUP[backendType].requirements.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Steps */}
                    {BACKEND_TECHNICAL_SETUP[backendType].steps && (
                      <div className="setup-block">
                        <h4 className="setup-block-title">Setup Steps</h4>
                        <div className="setup-steps">
                          {BACKEND_TECHNICAL_SETUP[backendType].steps.map((step, idx) => (
                            <div key={idx} className="setup-step">
                              <div className="step-title">{step.title}</div>
                              {step.command && (
                                <div className="step-command">
                                  <code>{step.command}</code>
                                  <button
                                    className="copy-btn"
                                    onClick={() => navigator.clipboard.writeText(step.command)}
                                    title="Copy command"
                                  >
                                    📋
                                  </button>
                                </div>
                              )}
                              <div className="step-note">{step.note}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limitations */}
                    {BACKEND_TECHNICAL_SETUP[backendType].limitations && (
                      <div className="setup-block">
                        <h4 className="setup-block-title">Limitations</h4>
                        <ul className="setup-limitations-list">
                          {BACKEND_TECHNICAL_SETUP[backendType].limitations.map((lim, idx) => (
                            <li key={idx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cost / Privacy / Institutional Notes */}
                    {['costNote', 'networkNote', 'institutionalNote'].map((noteKey) => {
                      const note = BACKEND_TECHNICAL_SETUP[backendType][noteKey];
                      if (!note) return null;
                      const labels = {
                        costNote: 'Cost Estimate',
                        networkNote: 'Privacy',
                        institutionalNote: 'Institutional Compliance',
                      };
                      return (
                        <div key={noteKey} className="setup-block">
                          <h4 className="setup-block-title">{labels[noteKey]}</h4>
                          <p className="setup-note">{note}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button className="backend-save-btn" onClick={handleBackendSave}>
                Save Backend Configuration
              </button>
            </div>
          )}
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
