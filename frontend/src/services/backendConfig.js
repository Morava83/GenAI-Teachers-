/**
 * Backend configuration service
 * Manages different backend adapters for problem generation
 */

export const BACKEND_TYPES = {
  PLACEHOLDER: 'placeholder',
  LOCAL: 'local',
  OPENAI: 'openai',
  ZHIPU: 'zhipu',
  CALCUL_QUEBC: 'calcul_quebc',
};

export const BACKEND_LABELS = {
  [BACKEND_TYPES.PLACEHOLDER]: 'No Backend (Placeholder)',
  [BACKEND_TYPES.LOCAL]: 'Local Ollama',
  [BACKEND_TYPES.OPENAI]: 'OpenAI API',
  [BACKEND_TYPES.ZHIPU]: 'Zhipu AI (GLM)',
  [BACKEND_TYPES.CALCUL_QUEBC]: 'Calcul Quebec',
};

export const BACKEND_DESCRIPTIONS = {
  [BACKEND_TYPES.PLACEHOLDER]: 'Use built-in sample problems. No AI generation. Works offline.',
  [BACKEND_TYPES.LOCAL]: 'Connect to Ollama running on your local computer.',
  [BACKEND_TYPES.OPENAI]: 'Use OpenAI GPT models. Requires API key.',
  [BACKEND_TYPES.ZHIPU]: 'Use Zhipu AI GLM models (Chinese-friendly).',
  [BACKEND_TYPES.CALCUL_QUEBC]: 'Connect to your Calcul Quebec HPC server.',
};

// Default config for each backend type
export const DEFAULT_CONFIGS = {
  [BACKEND_TYPES.PLACEHOLDER]: {},
  [BACKEND_TYPES.LOCAL]: {
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.1:8b',
  },
  [BACKEND_TYPES.OPENAI]: {
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
  },
  [BACKEND_TYPES.ZHIPU]: {
    zhipuApiKey: '',
    zhipuModel: 'glm-4-flash',
  },
  [BACKEND_TYPES.CALCUL_QUEBC]: {
    cqApiUrl: '',
    cqApiKey: '',
    cqModel: 'llama3.1:8b',
  },
};

/**
 * Load backend config from localStorage
 */
export function loadBackendConfig() {
  const saved = localStorage.getItem('backendConfig');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore parse errors
    }
  }
  return {
    type: BACKEND_TYPES.PLACEHOLDER,
    ...DEFAULT_CONFIGS[BACKEND_TYPES.PLACEHOLDER],
  };
}

/**
 * Save backend config to localStorage
 */
export function saveBackendConfig(config) {
  localStorage.setItem('backendConfig', JSON.stringify(config));
}

/**
 * Build the prompt from form data (shared logic)
 */
function buildPrompt(formData) {
  const {
    topic,
    areaSubject,
    grade,
    dok,
    difficulty = 'medium',
    language = 'English',
    interestValue,
    format,
    additionalRequirements,
    selectedTags,
  } = formData;

  let prompt = `You are a helpful math teacher. Generate a math problem with the following specifications:

Topic: ${topic || areaSubject}
Grade: ${grade ? grade + 'th grade' : 'various grades'}
Depth of Knowledge: ${dok}
Difficulty: ${difficulty}
Language: ${language}
`;
  if (interestValue) prompt += `Context/Theme: ${interestValue}\n`;
  if (selectedTags && selectedTags.length > 0) prompt += `Interests to incorporate: ${selectedTags.join(', ')}\n`;
  if (additionalRequirements) prompt += `Additional requirements: ${additionalRequirements}\n`;
  if (format) prompt += `Format: ${format}\n`;

  prompt += `
Generate EXACTLY this JSON format (no other text before or after):
{
    "problem": "The math problem statement",
    "hints": ["Hint 1: ...", "Hint 2: ..."],
    "solution": "Step-by-step solution",
    "answer": "Final answer"
}
`;
  return prompt;
}

/**
 * Parse AI response JSON
 */
function parseResponse(generatedText) {
  const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        problem: parsed.problem || '',
        hints: Array.isArray(parsed.hints)
          ? parsed.hints.map((h) => `<p>${h}</p>`).join('')
          : `<p>${parsed.hints || ''}</p>`,
        solution: `<p>${parsed.solution || ''}</p>`,
        answer: `<p><strong>Answer: </strong>${parsed.answer || ''}</p>`,
      };
    } catch {
      // fall through to raw text
    }
  }
  return {
    problem: `<p><strong>Problem:</strong> ${generatedText}</p>`,
    hints: '<p>Hint: Read the problem carefully</p><p>Hint: Break it into smaller steps</p>',
    solution: '<p>Solution steps will be generated...</p>',
    answer: '<p><strong>Answer: </strong>See above</p>',
  };
}

// ============================================================
// Backend adapters
// ============================================================

/**
 * Call Local Ollama
 */
async function callLocalOllama(config, formData) {
  const { ollamaUrl, ollamaModel } = config;
  const prompt = buildPrompt(formData);

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel || 'llama3.1:8b',
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 1024,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`);
  }

  const result = await response.json();
  return parseResponse(result.response || '');
}

/**
 * Call OpenAI API
 */
async function callOpenAI(config, formData) {
  const { openaiApiKey, openaiModel } = config;
  const prompt = buildPrompt(formData);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: openaiModel || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error: ${response.statusText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || '';
  return parseResponse(text);
}

/**
 * Call Zhipu AI (GLM API)
 * Endpoint: https://open.bigmodel.cn/api/paas/v4/chat/completions
 */
async function callZhipu(config, formData) {
  const { zhipuApiKey, zhipuModel } = config;
  const prompt = buildPrompt(formData);

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${zhipuApiKey}`,
    },
    body: JSON.stringify({
      model: zhipuModel || 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Zhipu error: ${response.statusText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || '';
  return parseResponse(text);
}

/**
 * Call Calcul Quebec HPC backend
 * Expects a Django-style API at the provided URL
 */
async function callCalculQuebec(config, formData) {
  const { cqApiUrl, cqApiKey } = config;

  const headers = { 'Content-Type': 'application/json' };
  if (cqApiKey) {
    headers['Authorization'] = `Bearer ${cqApiKey}`;
  }

  const response = await fetch(`${cqApiUrl}/api/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    throw new Error(`Calcul Quebec backend error: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================
// Main unified API
// ============================================================

/**
 * Generate a problem using the configured backend.
 * Falls back to placeholder on error.
 */
export async function generateWithBackend(formData) {
  const config = loadBackendConfig();
  const { type } = config;

  try {
    switch (type) {
      case BACKEND_TYPES.LOCAL:
        return await callLocalOllama(config, formData);

      case BACKEND_TYPES.OPENAI:
        return await callOpenAI(config, formData);

      case BACKEND_TYPES.ZHIPU:
        return await callZhipu(config, formData);

      case BACKEND_TYPES.CALCUL_QUEBC:
        return await callCalculQuebec(config, formData);

      case BACKEND_TYPES.PLACEHOLDER:
      default:
        // Return placeholder - handled in api.js
        return null;
    }
  } catch (error) {
    console.error('Backend call failed:', error);
    throw error;
  }
}
