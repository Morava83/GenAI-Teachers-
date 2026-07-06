import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateProblem } from '../services/api';
import './LearningInput.css';

const steps = [
  { number: 1, title: 'Scope & alignment', short: 'The what' },
  { number: 2, title: 'Difficulty & support', short: 'The how' },
  { number: 3, title: 'Output & presentation', short: 'The look' },
  { number: 4, title: 'Review & generate', short: 'The output' },
];

const initialForm = {
  grade: '', areaSubject: 'Mathematics', standard: '', topic: '', format: 'Word Problem',
  difficulty: 'Medium', dok: '2', scaffolding: 'Hints', additionalRequirements: '',
  questionCount: '5', answerSpace: 'Standard', organization: 'By topic',
  includeAnswerKey: true, includeHints: true, includeSolutions: true, includeScratchpad: false,
  language: 'English', interestValue: '',
};

const SelectField = ({ label, name, value, onChange, children, hint }) => (
  <label className="field">
    <span>{label}</span>
    {hint && <small>{hint}</small>}
    <select name={name} value={value} onChange={onChange}>{children}</select>
  </label>
);

const LearningInput = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('generatorFontSize') || 'comfortable');

  useEffect(() => {
    const saved = localStorage.getItem('problemGeneratorDraft');
    if (saved) {
      try { setFormData({ ...initialForm, ...JSON.parse(saved) }); } catch { /* use defaults */ }
    }
  }, []);

  const update = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value };
      localStorage.setItem('problemGeneratorDraft', JSON.stringify(next));
      return next;
    });
  };

  const next = () => {
    if (step === 1 && (!formData.grade || !formData.topic.trim())) return;
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previous = () => {
    setStep((current) => Math.max(1, current - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeFontSize = (size) => {
    setFontSize(size);
    localStorage.setItem('generatorFontSize', size);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const response = await generateProblem({
      ...formData,
      selectedTags: formData.interestValue ? [formData.interestValue] : [],
    });
    const problemWithMeta = {
      ...response,
      topic: formData.topic,
      createdAt: new Date().toISOString(),
      originalFormData: formData,
    };
    localStorage.setItem('generatedProblem', JSON.stringify(problemWithMeta));
    localStorage.setItem('userSettings', JSON.stringify({
      includeHints: formData.includeHints,
      includeSolutions: formData.includeSolutions,
    }));
    if (!response.isOffline) {
      const history = JSON.parse(localStorage.getItem('problemHistory') || '[]');
      localStorage.setItem('problemHistory', JSON.stringify([problemWithMeta, ...history].slice(0, 50)));
    }
    navigate('/results');
  };

  return (
    <main className={`generator-page font-${fontSize}`}>
      <header className="generator-topbar">
        <a className="brand" href="/" aria-label="MathCraft home">
          <span className="brand-mark">M</span>
          <span>MathCraft</span>
        </a>
        <div className="topbar-actions">
          <div className="font-controls" aria-label="Text size">
            <span>Text size</span>
            <button className={fontSize === 'default' ? 'selected' : ''} onClick={() => changeFontSize('default')} aria-label="Use smaller text">A−</button>
            <button className={fontSize === 'comfortable' ? 'selected' : ''} onClick={() => changeFontSize('comfortable')} aria-label="Use medium text">A</button>
            <button className={fontSize === 'large' ? 'selected' : ''} onClick={() => changeFontSize('large')} aria-label="Use larger text">A+</button>
          </div>
          <span className="draft-status"><i /> Draft saved</span>
          <button className="profile-button" onClick={() => navigate('/account')} aria-label="Open profile">
            <span className="profile-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" /></svg>
            </span>
            <span className="profile-copy"><strong>Profile</strong><small>Account settings</small></span>
            <span className="profile-arrow">›</span>
          </button>
        </div>
      </header>

      <div className="generator-shell">
        <section className="generator-intro">
          <h1>Create Math Problem</h1>
        </section>

        <nav className="stepper" aria-label="Problem generation progress">
          {steps.map((item) => (
            <button key={item.number} className={`${step === item.number ? 'active' : ''} ${step > item.number ? 'complete' : ''}`}
              onClick={() => item.number < step && setStep(item.number)} disabled={item.number > step}>
              <span className="step-number">{step > item.number ? '✓' : item.number}</span>
              <span className="step-copy"><strong>{item.title}</strong><small>{item.short}</small></span>
            </button>
          ))}
        </nav>

        <section className="generator-card">
          <div className="card-heading">
            <span>STEP {step} OF 4</span>
            <h2>{steps[step - 1].title}</h2>
            <p>{[
              'Start with the learning goal and the kind of problem you need.',
              'Choose the cognitive challenge and the right level of support.',
              'Decide what students and teachers will see in the final activity.',
              'Check your choices, then create your classroom-ready problem set.',
            ][step - 1]}</p>
          </div>

          {step === 1 && <div className="form-grid">
            <SelectField label="Grade level *" name="grade" value={formData.grade} onChange={update}>
              <option value="">Select a grade</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map((g) => <option key={g}>Grade {g}</option>)}
            </SelectField>
            <SelectField label="Subject" name="areaSubject" value={formData.areaSubject} onChange={update}>
              {['Mathematics','Pre-Algebra','Algebra','Geometry','Trigonometry','Calculus','Statistics'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <label className="field full"><span>Learning standard <em>Optional</em></span><input name="standard" value={formData.standard} onChange={update} placeholder="e.g., CCSS.MATH.CONTENT.7.RP.A.2" /></label>
            <label className="field full"><span>Topic or concept *</span><textarea name="topic" value={formData.topic} onChange={update} placeholder="e.g., Compare proportional relationships using tables and graphs" rows="2" /><small className="validation-hint">Be specific about what students should practice.</small></label>
            <SelectField label="Problem format" name="format" value={formData.format} onChange={update}>
              {['Word Problem','Multiple Choice','Short Answer','Open Response','Mixed Format'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <label className="field"><span>Real-world context <em>Optional</em></span><input name="interestValue" value={formData.interestValue} onChange={update} placeholder="e.g., sports, music, local community" /></label>
          </div>}

          {step === 2 && <div className="form-grid">
            <SelectField label="Difficulty" name="difficulty" value={formData.difficulty} onChange={update}>
              {['Easy','Medium','Hard','Advanced'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <SelectField label="Depth of knowledge" name="dok" value={formData.dok} onChange={update}>
              <option value="1">DOK 1 — Recall</option><option value="2">DOK 2 — Skills & concepts</option><option value="3">DOK 3 — Strategic thinking</option><option value="4">DOK 4 — Extended thinking</option>
            </SelectField>
            <SelectField label="Scaffolding strategy" name="scaffolding" value={formData.scaffolding} onChange={update}>
              {['None','Hints','Worked Example','Step-by-Step Prompts','Skeletal Frame'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <label className="field full"><span>Custom rules <em>Optional</em></span><textarea name="additionalRequirements" value={formData.additionalRequirements} onChange={update} placeholder="e.g., Use whole numbers only; avoid negative answers" rows="3" /></label>
          </div>}

          {step === 3 && <div className="form-grid">
            <SelectField label="Number of questions" name="questionCount" value={formData.questionCount} onChange={update}>
              {['1','3','5','10','15','20'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <SelectField label="Answer space" name="answerSpace" value={formData.answerSpace} onChange={update}>
              {['Compact','Standard','Generous'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <SelectField label="Organization" name="organization" value={formData.organization} onChange={update}>
              {['By topic','By difficulty','Mixed'].map((v) => <option key={v}>{v}</option>)}
            </SelectField>
            <div className="field full"><span>Include in output</span><div className="toggle-grid">
              {[["includeAnswerKey","Answer key"],["includeHints","Student hints"],["includeSolutions","Worked solutions"],["includeScratchpad","Scratch space"]].map(([name,label]) => <label className="check-card" key={name}><input type="checkbox" name={name} checked={formData[name]} onChange={update} /><span className="check-box">✓</span><span>{label}</span></label>)}
            </div></div>
          </div>}

          {step === 4 && <div className="review">
            <div className="review-callout"><span>✓</span><div><strong>Ready to generate</strong><p>Your settings are saved. Review the details below before creating the problem set.</p></div></div>
            <div className="review-grid">
              <div><small>LEARNING GOAL</small><strong>{formData.topic || 'Not specified'}</strong><p>{formData.grade} · {formData.areaSubject}{formData.standard ? ` · ${formData.standard}` : ''}</p></div>
              <div><small>CHALLENGE</small><strong>{formData.difficulty} · DOK {formData.dok}</strong><p>{formData.scaffolding} support</p></div>
              <div><small>DELIVERABLE</small><strong>{formData.questionCount} {formData.format.toLowerCase()} questions</strong><p>{formData.organization} · {formData.answerSpace} answer space</p></div>
              <div><small>INCLUDED</small><strong>{[['includeAnswerKey','Answer key'],['includeHints','Hints'],['includeSolutions','Solutions'],['includeScratchpad','Scratch space']].filter(([key]) => formData[key]).map(([,label]) => label).join(', ') || 'Problems only'}</strong><p>English</p></div>
            </div>
          </div>}

          <div className="card-actions">
            {step > 1 ? <button className="secondary-button" onClick={previous}>← Previous</button> : <span />}
            {step < 4 ? <button className="primary-button" onClick={next} disabled={step === 1 && (!formData.grade || !formData.topic.trim())}>Continue <span>→</span></button> : <button className="primary-button generate" onClick={handleSubmit} disabled={loading}>{loading ? 'Generating…' : 'Generate problems'} <span>✦</span></button>}
          </div>
        </section>
        <p className="privacy-note">Your draft is stored only in this browser.</p>
      </div>
    </main>
  );
};

export default LearningInput;
