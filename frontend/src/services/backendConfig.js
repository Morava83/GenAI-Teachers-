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

// ============================================================
// Data privacy warnings (shown to users before they choose)
// ============================================================
export const BACKEND_PRIVACY_WARNINGS = {
  [BACKEND_TYPES.PLACEHOLDER]: null,
  [BACKEND_TYPES.LOCAL]: null,
  [BACKEND_TYPES.OPENAI]: {
    title: 'Data Privacy Notice',
    icon: '🔒',
    content: [
      'Your problem-generation prompts (including topic, grade level, difficulty, and any additional requirements) will be transmitted to OpenAI\'s servers.',
      'The prompt data will be processed by OpenAI\'s models to generate math problems.',
      'OpenAI\'s data usage policies apply. Review OpenAI\'s privacy terms at platform.openai.com.',
      'No user account data or problem history is sent — only the generation prompt.',
    ],
  },
  [BACKEND_TYPES.ZHIPU]: {
    title: '数据隐私声明',
    icon: '🔒',
    content: [
      '您的题目生成请求（包括主题、年级、难度及所有附加要求）将被传输至北京智谱华章科技有限公司的服务器。',
      '请求数据将由智谱AI（GLM模型）处理以生成数学题目。',
      '您的数据将受到智谱AI服务条款的约束。请参阅 bigmodel.cn 隐私政策。',
      '仅传输题目生成提示词，不包含您的账户信息或历史记录。',
    ],
  },
  [BACKEND_TYPES.CALCUL_QUEBC]: {
    title: 'Data Privacy Notice',
    icon: '🔒',
    content: [
      'Your problem-generation prompts will be transmitted to the Calcul Quebec HPC server you configure.',
      'Data handling is governed by Calcul Quebec\'s server policies and applicable Canadian privacy laws (PIPEDA / Loi 25).',
      'Ensure your HPC server complies with your institution\'s data governance requirements before use.',
      'Verify with your institutional IT department that remote AI inference on the HPC cluster is authorized.',
    ],
  },
};

// ============================================================
// Technical setup instructions (shown in detail panel)
// ============================================================
export const BACKEND_TECHNICAL_SETUP = {
  [BACKEND_TYPES.PLACEHOLDER]: {
    overview: 'No additional setup required. This option uses pre-loaded sample math problems.',
    requirements: null,
    steps: null,
    limitations: ['No AI-powered generation', 'Problems are static examples', 'Cannot customize topic/depth on demand'],
  },
  [BACKEND_TYPES.LOCAL]: {
    overview: 'Connect to Ollama running locally on your machine. This option keeps all data on your device.',
    requirements: [
      'Ollama installed on your Mac/PC (download: ollama.com)',
      'A compatible LLM model downloaded (e.g., llama3.1:8b)',
      'Ollama service must be running (ollama serve)',
      '⚠️ You must run the frontend locally (npm run dev) — not via Vercel or other remote hosting — for localhost to work correctly',
    ],
    steps: [
      {
        title: 'Step 1: Install Ollama',
        command: 'brew install ollama',
        note: 'Or download from ollama.com and follow the installation wizard',
      },
      {
        title: 'Step 2: Start Ollama Service',
        command: 'ollama serve',
        note: 'Keep this terminal window open. The service runs at http://localhost:11434',
      },
      {
        title: 'Step 3: Download a Model',
        command: 'ollama pull llama3.1:8b',
        note: 'This downloads ~5GB. Use a stable internet connection. Other options: llama3, mistral, phi',
      },
      {
        title: 'Step 4: Verify Model is Available',
        command: 'ollama list',
        note: 'You should see llama3.1:8b in the list with size ~4.9GB',
      },
      {
        title: 'Step 5: Run Frontend Locally',
        command: 'cd frontend && npm install && npm run dev',
        note: 'Open http://localhost:5173 in your browser. Then go to Account → select "Local Ollama" → Save',
      },
      {
        title: 'Step 6: Configure in App',
        command: null,
        note: 'In the app\'s Account page, select "Local Ollama", keep default URL (http://localhost:11434), set model to llama3.1:8b, and click Save.',
      },
    ],
    limitations: [
      'Only works when running the frontend locally (not on Vercel)',
      'Ollama service must be running before generating problems',
      'Performance depends on your hardware (RAM/CPU/GPU)',
    ],
    networkNote: 'This option is fully private — no data leaves your machine.',
  },
  [BACKEND_TYPES.OPENAI]: {
    overview: 'Use OpenAI\'s cloud API for problem generation. Requires an OpenAI account and API key.',
    requirements: [
      'OpenAI account at platform.openai.com',
      'API key with available quota (free tier or paid)',
      'Internet connection',
    ],
    steps: [
      {
        title: 'Step 1: Get an OpenAI API Key',
        command: null,
        note: 'Go to platform.openai.com → API Keys → Create new secret key. Copy it immediately — it won\'t be shown again.',
      },
      {
        title: 'Step 2: Add Billing (if needed)',
        command: null,
        note: 'Free tier has limited requests. Add payment method for higher limits at platform.openai.com/account/billing',
      },
      {
        title: 'Step 3: Configure in App',
        command: null,
        note: 'In the Account page, select "OpenAI API", paste your API key, choose a model (GPT-4o Mini recommended for cost efficiency), and click Save.',
      },
      {
        title: 'Step 4: Test Generation',
        command: null,
        note: 'Go to the homepage, configure your problem settings, and click "Get Started". Watch usage at platform.openai.com/usage',
      },
    ],
    limitations: [
      'Requires internet connection',
      'API usage incurs costs (pay-per-token)',
      'Prompt data is transmitted to OpenAI servers',
      'Subject to OpenAI usage policies and rate limits',
    ],
    costNote: 'GPT-4o Mini is the most cost-effective model for math problems (~$0.15/1M tokens input, ~$0.60/1M tokens output). A typical generation request costs less than $0.01.',
  },
  [BACKEND_TYPES.ZHIPU]: {
    overview: 'Use Zhipu AI\'s GLM models. Suitable for Chinese-language math problems. Requires a Zhipu API key from bigmodel.cn.',
    requirements: [
      'Zhipu AI account at bigmodel.cn',
      'API key with available quota',
      'Internet connection (API endpoint is in China)',
    ],
    steps: [
      {
        title: 'Step 1: Register at bigmodel.cn',
        command: null,
        note: 'Go to bigmodel.cn → Sign up → Complete verification. Some models offer free tier quota.',
      },
      {
        title: 'Step 2: Create an API Key',
        command: null,
        note: 'Dashboard → API Keys → Create. Copy and store it securely — it won\'t be retrievable later.',
      },
      {
        title: 'Step 3: Configure in App',
        command: null,
        note: 'In the Account page, select "Zhipu AI (GLM)", paste your API key, choose a model, and click Save.',
      },
      {
        title: 'Step 4: Test Generation',
        command: null,
        note: 'Go to the homepage, set language to "Chinese", and generate a problem. Monitor usage at bigmodel.cn dashboard.',
      },
    ],
    limitations: [
      'API endpoint is hosted in mainland China — may have latency from other regions',
      'Requires internet connection',
      'API usage costs apply (varies by model)',
      'Prompt data is transmitted to Zhipu servers in China',
    ],
  },
  [BACKEND_TYPES.CALCUL_QUEBC]: {
    overview: 'Connect to a privately operated Calcul Quebec HPC server. This option is for research collaborators with institutional access.',
    requirements: [
      'Access to a Calcul Quebec HPC cluster with a deployed inference API',
      'API URL and optional API key provided by your HPC administrator',
      'Institutional authorization for remote AI inference usage',
      'SSH tunnel or VPN may be required if the server is not publicly accessible',
    ],
    steps: [
      {
        title: 'Step 1: Contact Your HPC Administrator',
        command: null,
        note: 'Request the API endpoint URL and credentials for the deployed inference service on the Calcul Quebec cluster.',
      },
      {
        title: 'Step 2: Verify Network Access',
        command: null,
        note: 'Confirm whether the HPC server is accessible from the internet, or if you need VPN/SSH tunnel to access it.',
      },
      {
        title: 'Step 3: Configure in App',
        command: null,
        note: 'In the Account page, select "Calcul Quebec", enter the API URL (e.g., https://hpc-server.calculquebec.ca/api/generate), add the API key if provided, and click Save.',
      },
      {
        title: 'Step 4: Confirm Model Availability',
        command: null,
        note: 'Ask your HPC admin which models are available on the cluster (commonly: llama3.1:8b, llama3, mistral).',
      },
    ],
    limitations: [
      'Requires HPC account and institutional authorization',
      'Network access depends on Calcul Quebec\'s infrastructure policies',
      'Usage may be subject to institutional quotas and policies',
      'Support depends on your local HPC team',
    ],
    institutionalNote: 'Ensure your use case complies with Calcul Quebec\'s acceptable use policy and your institution\'s research data governance requirements.',
  },
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
