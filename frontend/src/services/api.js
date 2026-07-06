import axios from 'axios';
import { generateWithBackend, BACKEND_TYPES, loadBackendConfig } from './backendConfig';

export { BACKEND_TYPES, loadBackendConfig };

// Fallback problems organized by subject/area
const fallbackProblems = {
  Mathematics: [
    {
      problem: "Calculate the value of \\(15 \\times 24 + 36 \\div 4\\).",
      hints: "Remember the order of operations: multiplication and division come before addition.",
      solution: "First, perform multiplication: \\(15 \\times 24 = 360\\)<br>Then, perform division: \\(36 \\div 4 = 9\\)<br>Finally, add the results: \\(360 + 9 = 369\\)",
      answer: "369"
    },
    {
      problem: "A rectangle has a length of 12 cm and a width of 8 cm. What is its perimeter and area?",
      hints: "Perimeter = 2(length + width), Area = length × width",
      solution: "Perimeter = \\(2(12 + 8) = 2(20) = 40\\) cm<br>Area = \\(12 \\times 8 = 96\\) cm²",
      answer: "Perimeter = 40 cm, Area = 96 cm²"
    }
  ],
  Algebra: [
    {
      problem: "Solve for \\(x\\): \\(3x + 7 = 22\\)",
      hints: "Isolate the variable by performing inverse operations on both sides of the equation.",
      solution: "Subtract 7 from both sides: \\(3x = 15\\)<br>Divide both sides by 3: \\(x = 5\\)",
      answer: "\\(x = 5\\)"
    },
    {
      problem: "Simplify the expression: \\(2(3x - 4) + 5x\\)",
      hints: "First distribute the 2, then combine like terms.",
      solution: "Distribute: \\(6x - 8 + 5x\\)<br>Combine like terms: \\(11x - 8\\)",
      answer: "\\(11x - 8\\)"
    }
  ],
  Geometry: [
    {
      problem: "Find the area of a triangle with a base of 10 cm and a height of 6 cm.",
      hints: "The formula for the area of a triangle is \\(A = \\frac{1}{2} \\times base \\times height\\)",
      solution: "\\(A = \\frac{1}{2} \\times 10 \\times 6 = \\frac{60}{2} = 30\\) cm²",
      answer: "30 cm²"
    },
    {
      problem: "A circle has a radius of 7 cm. Find its circumference. (Use \\(\\pi \\approx 3.14\\))",
      hints: "Circumference = \\(2\\pi r\\)",
      solution: "\\(C = 2 \\times 3.14 \\times 7 = 43.96\\) cm",
      answer: "43.96 cm"
    }
  ],
  Calculus: [
    {
      problem: "Find the derivative of \\(f(x) = 3x^2 + 2x - 5\\)",
      hints: "Use the power rule: the derivative of \\(x^n\\) is \\(nx^{n-1}\\)",
      solution: "Apply the power rule to each term:<br>\\(f'(x) = 6x + 2\\)",
      answer: "\\(f'(x) = 6x + 2\\)"
    },
    {
      problem: "Evaluate the integral: \\(\\int (4x + 3) dx\\)",
      hints: "Use the power rule for integration: \\(\\int x^n dx = \\frac{x^{n+1}}{n+1} + C\\)",
      solution: "\\(\\int (4x + 3) dx = 2x^2 + 3x + C\\)",
      answer: "\\(2x^2 + 3x + C\\)"
    }
  ],
  Statistics: [
    {
      problem: "Find the mean, median, and mode of the following data set: 5, 8, 12, 8, 15, 8, 20",
      hints: "Mean = sum of values ÷ number of values. Median = middle value when sorted. Mode = most frequent value.",
      solution: "Mean: \\((5+8+12+8+15+8+20) \\div 7 = 76 \\div 7 \\approx 10.86\\)<br>Sorted: 5, 8, 8, 8, 12, 15, 20<br>Median: 8 (middle value)<br>Mode: 8 (appears 3 times)",
      answer: "Mean ≈ 10.86, Median = 8, Mode = 8"
    }
  ],
  Trigonometry: [
    {
      problem: "In a right triangle, if one angle is 30° and the hypotenuse is 10 cm, find the length of the side opposite to the 30° angle.",
      hints: "Use the sine function: \\(\\sin(\\theta) = \\frac{opposite}{hypotenuse}\\)",
      solution: "\\(\\sin(30°) = \\frac{opposite}{10}\\)<br>\\(0.5 = \\frac{opposite}{10}\\)<br>\\(opposite = 5\\) cm",
      answer: "5 cm"
    }
  ],
  'Pre-Algebra': [
    {
      problem: "Evaluate: \\((-3) + (-7) - (-5)\\)",
      hints: "Subtracting a negative number is the same as adding a positive number.",
      solution: "\\((-3) + (-7) - (-5) = -3 - 7 + 5 = -10 + 5 = -5\\)",
      answer: "-5"
    }
  ],
  'Advanced Mathematics': [
    {
      problem: "Find all values of \\(x\\) that satisfy: \\(x^2 - 5x + 6 = 0\\)",
      hints: "Factor the quadratic or use the quadratic formula.",
      solution: "Factor: \\((x - 2)(x - 3) = 0\\)<br>Set each factor to zero: \\(x - 2 = 0\\) or \\(x - 3 = 0\\)<br>Solutions: \\(x = 2\\) or \\(x = 3\\)",
      answer: "\\(x = 2\\) or \\(x = 3\\)"
    }
  ],
  default: [
    {
      problem: "Solve the following equation: \\(2x + 5 = 13\\)",
      hints: "Isolate the variable by performing inverse operations.",
      solution: "Subtract 5 from both sides: \\(2x = 8\\)<br>Divide both sides by 2: \\(x = 4\\)",
      answer: "\\(x = 4\\)"
    },
    {
      problem: "What is the value of \\(\\frac{3}{4} + \\frac{2}{3}\\)?",
      hints: "Find a common denominator before adding fractions.",
      solution: "Common denominator is 12:<br>\\(\\frac{3}{4} = \\frac{9}{12}\\)<br>\\(\\frac{2}{3} = \\frac{8}{12}\\)<br>\\(\\frac{9}{12} + \\frac{8}{12} = \\frac{17}{12}\\)",
      answer: "\\(\\frac{17}{12}\\) or \\(1\\frac{5}{12}\\)"
    },
    {
      problem: "Calculate the area of a square with side length 9 cm.",
      hints: "Area of a square = side × side",
      solution: "\\(A = 9 \\times 9 = 81\\) cm²",
      answer: "81 cm²"
    }
  ]
};

const getRandomFallbackProblem = (formData) => {
  const subject = formData.areaSubject || 'default';
  const problems = fallbackProblems[subject] || fallbackProblems.default;
  const randomIndex = Math.floor(Math.random() * problems.length);
  return {
    ...problems[randomIndex],
    isOffline: true
  };
};

export const generateProblem = async (formData) => {
  try {
    const result = await generateWithBackend(formData);

    // If backend returned null or placeholder mode, use fallback
    if (!result) {
      console.log('Backend unavailable or placeholder mode, using fallback problem');
      return getRandomFallbackProblem(formData);
    }

    return result;
  } catch (error) {
    console.error('Error generating problem:', error);
    console.log('Using fallback problem');
    return getRandomFallbackProblem(formData);
  }
};

export const healthCheck = async () => {
  const config = loadBackendConfig();
  const { type } = config;

  if (type === BACKEND_TYPES.PLACEHOLDER) {
    return { status: 'placeholder', message: 'Using built-in problems' };
  }

  if (type === BACKEND_TYPES.LOCAL) {
    try {
      const { ollamaUrl } = config;
      const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
      return { status: 'healthy', backend: 'local', models: response.data.models || [] };
    } catch {
      return { status: 'unavailable', backend: 'local' };
    }
  }

  if (type === BACKEND_TYPES.OPENAI || type === BACKEND_TYPES.ZHIPU) {
    return { status: 'configured', backend: type };
  }

  if (type === BACKEND_TYPES.CALCUL_QUEBC) {
    try {
      const { cqApiUrl } = config;
      const response = await axios.get(`${cqApiUrl}/api/health`, { timeout: 5000 });
      return { status: 'healthy', backend: 'calcul_quebec' };
    } catch {
      return { status: 'unavailable', backend: 'calcul_quebec' };
    }
  }

  return { status: 'unknown' };
};
