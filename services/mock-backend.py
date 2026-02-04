#!/usr/bin/env python3
"""
Mock backend for the frontend (no Django required).

Exposes:
  - GET  /api/health
  - POST /api/generate

Uses Groq Chat Completions (OpenAI-compatible) to generate a single math learning problem.

Run:
  export GROQ_API_KEY="..."
  # optional: export GROQ_MODEL="llama3-70b-8192"
  python services/mock-backend.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _load_dotenv():
    """Load .env file from project root (no external dependency)."""
    # Look for .env in parent dir (project root) since this script is in services/
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Only set if not already in environment (env vars take precedence)
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv()

HOST = os.environ.get("MOCK_BACKEND_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOCK_BACKEND_PORT", "8000"))

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")  # Current Groq Llama 70B
GROQ_ENDPOINT = os.environ.get("GROQ_ENDPOINT", "https://api.groq.com/openai/v1/chat/completions")


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    # CORS for Vite dev server / browser
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.end_headers()
    handler.wfile.write(body)


def _read_json_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or "0")
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        return json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return {}


def _safe_str(x) -> str:
    return "" if x is None else str(x)


# DOK (Depth of Knowledge) level definitions
DOK_LEVELS = {
    "1": {
        "name": "Level 1 - Recall and Reproduction",
        "description": "Mathematical Recall and Reproduction: Tasks at this level require students to recall facts, definitions, or procedures.",
        "examples": "Apply a well-known algorithm, Identify a plane or three-dimensional figure, Perform a specified or routine procedure.",
        "math_example": "The price of gasoline was $2.159 per gallon last week. This week the new price is $2.319 per gallon. Determine the percent of increase.",
    },
    "2": {
        "name": "Level 2 - Skills and Concepts",
        "description": "Mathematical Skills and Concepts: Tasks at this level involve some mental processing beyond recalling or reproducing a response.",
        "examples": "Solve a routine problem requiring multiple steps, or the application of multiple concepts, interpreting data, explaining relationships between concepts.",
        "math_example": "On a trip across the country, Justin determined that he would have to drive about 2,763 miles. What speed would he have to average to complete the trip in no more than 50 hours of driving time?",
    },
    "3": {
        "name": "Level 3 - Strategic Thinking",
        "description": "Mathematical Strategic Thinking: Tasks at this level require deep understanding and reasoning, planning, and using evidence.",
        "examples": "Interpret information from a complex graph, Develop logical arguments for a concept, Solve a multiple-step problem supported with a mathematical explanation that justifies the answer.",
        "math_example": "A sweater costs $63.99. The sale price is $47.99. What is the percent decrease? If the store then reduces sale items by 1/3 of the sale price, what is the new price?",
    },
    "4": {
        "name": "Level 4 - Extended Thinking",
        "description": "Mathematical Extended Thinking: Tasks at this level require complex reasoning, planning, developing, and thinking over an extended period of time.",
        "examples": "Relate mathematical concepts to real-world applications in new situations, Design a mathematical model to inform and solve a practical or abstract situation.",
        "math_example": "Visit three local grocery stores and find prices of three different sizes of the same product. Determine the unit price for each and decide which is the best buy, justifying your decision with mathematical work.",
    },
    # Also support LOT/HOT format from the frontend
    "LOT": {
        "name": "Lower Order Thinking (DOK 1-2)",
        "description": "Lower Order Thinking encompasses recall, reproduction, and basic skills. Students recall facts, apply algorithms, and solve routine problems.",
        "examples": "Recall facts and definitions, apply formulas, solve routine multi-step problems, interpret simple data.",
        "math_example": "Calculate the area of a rectangle with length 12cm and width 8cm.",
    },
    "HOT": {
        "name": "Higher Order Thinking (DOK 3-4)",
        "description": "Higher Order Thinking requires strategic thinking, reasoning, planning, and extended analysis. Students must justify answers, make connections, and apply concepts to new situations.",
        "examples": "Develop logical arguments, solve complex multi-step problems with justification, design mathematical models, relate concepts to real-world applications.",
        "math_example": "A store offers 20% off, then an additional 15% off the sale price. Is this the same as 35% off the original price? Explain your reasoning mathematically.",
    },
}


def _build_prompt(form: dict) -> tuple[str, str]:
    topic = _safe_str(form.get("topic")).strip()
    area = _safe_str(form.get("areaSubject")).strip()
    grade = _safe_str(form.get("grade")).strip()
    dok_raw = _safe_str(form.get("dok")).strip()
    difficulty = _safe_str(form.get("difficulty")).strip()
    language = _safe_str(form.get("language")).strip() or "English"
    interest = _safe_str(form.get("interestValue")).strip()
    fmt = _safe_str(form.get("format")).strip()
    additional = _safe_str(form.get("additionalRequirements")).strip()
    tags = form.get("selectedTags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    if not isinstance(tags, list):
        tags = []

    # Build the system prompt
    system = (
        "You are an expert mathematics teacher and problem writer. "
        "Generate ONE high-quality math problem that precisely matches the teacher's requirements. "
        "Return ONLY valid JSON with exactly these keys: problem, hints, solution, answer. "
        "Values should be HTML strings with LaTeX math using $...$ delimiters. "
        "CRITICAL: In JSON, you MUST double-escape all backslashes for LaTeX commands. "
        "Example: Use \\\\frac{1}{2} NOT \\frac{1}{2}. Use \\\\sqrt{x} NOT \\sqrt{x}. "
        "No markdown fences, no extra text outside the JSON."
    )

    # Build detailed user prompt
    prompt_parts = ["Create a mathematics problem with the following specifications:\n"]

    # Topic/Subject
    if topic:
        prompt_parts.append(f"**Topic:** {topic}")
    if area:
        prompt_parts.append(f"**Subject Area:** {area}")

    # Grade level
    if grade:
        prompt_parts.append(f"**Grade Level:** Grade {grade}")

    # DOK Level - this is critical
    if dok_raw and dok_raw in DOK_LEVELS:
        dok_info = DOK_LEVELS[dok_raw]
        prompt_parts.append(f"\n**Depth of Knowledge (DOK):** {dok_info['name']}")
        prompt_parts.append(f"- Description: {dok_info['description']}")
        prompt_parts.append(f"- Task Examples: {dok_info['examples']}")
        prompt_parts.append(f"- Example Problem Style: {dok_info['math_example']}")
        prompt_parts.append("- IMPORTANT: The problem MUST match this DOK level's cognitive demand.")

    # Difficulty
    if difficulty:
        prompt_parts.append(f"\n**Difficulty:** {difficulty.capitalize()}")

    # Format - STRICT enforcement
    if fmt:
        prompt_parts.append(f"\n**REQUIRED FORMAT: {fmt}**")
        if fmt == "Multiple Choice":
            prompt_parts.append("YOU MUST format this as a multiple choice question with:")
            prompt_parts.append("- A clear question/problem statement")
            prompt_parts.append("- Exactly 4 answer choices labeled A), B), C), D)")
            prompt_parts.append("- Include the choices IN the problem field")
            prompt_parts.append("- The answer field should state which letter is correct and why")
        elif fmt == "Short Answer":
            prompt_parts.append("Format as a short answer question requiring a brief, specific response.")
        elif fmt == "Word Problem":
            prompt_parts.append("YOU MUST present this as a real-world word problem with:")
            prompt_parts.append("- A realistic scenario/context")
            prompt_parts.append("- Characters or situations students can relate to")
            prompt_parts.append("- Clear question asking what to solve for")
        elif fmt == "Step-by-Step Solution":
            prompt_parts.append("Focus on providing extremely detailed step-by-step working in the solution.")
        elif fmt == "Mixed Format":
            prompt_parts.append("You may use any appropriate format for this problem.")

    # Language
    prompt_parts.append(f"\n**Language:** {language}")

    # Student interests/context
    if interest:
        prompt_parts.append(f"**Context/Interest Area:** {interest}")

    # Tags/themes to incorporate
    if tags:
        prompt_parts.append(f"**Incorporate these themes/interests:** {', '.join(tags)}")

    # Additional requirements
    if additional:
        prompt_parts.append(f"**Additional Requirements:** {additional}")

    # Output format
    prompt_parts.append("\n**Output Format (JSON):**")
    prompt_parts.append("""{
  "problem": "<p>The problem statement with any necessary context...</p>",
  "hints": "<ol><li>First hint...</li><li>Second hint...</li></ol>",
  "solution": "<p>Step-by-step solution with clear explanations...</p>",
  "answer": "<p><strong>Final Answer:</strong> The answer...</p>"
}""")

    prompt_parts.append("\nIMPORTANT: Return ONLY the JSON object, no other text.")
    if fmt:
        prompt_parts.append(f"REMINDER: The format MUST be {fmt}.")

    user = "\n".join(prompt_parts)

    return system, user


def _fix_latex_escapes(text: str) -> str:
    r"""
    Fix LaTeX backslashes that get mangled by JSON parsing.
    JSON interprets \f as form feed, \n as newline, etc.
    We need to escape these so LaTeX commands like \frac, \left work.
    """
    # The LLM sometimes outputs single backslashes which break JSON parsing
    # because \f, \n, \r, \t, \b are escape sequences.
    # We need to carefully escape single backslashes before LaTeX commands.
    
    # Replace common problematic sequences that JSON interprets as escape chars
    # \f (form feed), \n (newline), \r (carriage return), \t (tab), \b (backspace)
    replacements = [
        ('\\frac', '\\\\frac'),
        ('\\forall', '\\\\forall'),  
        ('\\fbox', '\\\\fbox'),
        ('\\nabla', '\\\\nabla'),
        ('\\not', '\\\\not'),
        ('\\neg', '\\\\neg'),
        ('\\nu', '\\\\nu'),
        ('\\rangle', '\\\\rangle'),
        ('\\right', '\\\\right'),
        ('\\rm', '\\\\rm'),
        ('\\rho', '\\\\rho'),
        ('\\tau', '\\\\tau'),
        ('\\to', '\\\\to'),
        ('\\text', '\\\\text'),
        ('\\times', '\\\\times'),
        ('\\triangle', '\\\\triangle'),
        ('\\bar', '\\\\bar'),
        ('\\begin', '\\\\begin'),
        ('\\beta', '\\\\beta'),
        ('\\binom', '\\\\binom'),
        ('\\boxed', '\\\\boxed'),
    ]
    
    for old, new in replacements:
        text = text.replace(old, new)
    
    return text


def _extract_first_json(text: str) -> dict | None:
    """
    Groq models usually comply, but if not, try to salvage a JSON object.
    """
    text = (text or "").strip()
    if not text:
        return None
    
    # direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # Try fixing LaTeX escapes if direct parse fails
    fixed_text = _fix_latex_escapes(text)
    try:
        return json.loads(fixed_text)
    except json.JSONDecodeError:
        pass
    
    # find first {...} block in original text
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    blob = m.group(0)
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        pass
    
    # Try fixing the blob
    try:
        return json.loads(_fix_latex_escapes(blob))
    except json.JSONDecodeError:
        return None


def _local_mock(form: dict) -> dict:
    """
    Fallback generator if GROQ_API_KEY isn't configured yet.
    Keeps the same response shape the frontend expects.
    """
    topic = _safe_str(form.get("topic")).strip() or _safe_str(form.get("areaSubject")).strip() or "algebra"
    difficulty = (_safe_str(form.get("difficulty")).strip() or "medium").lower()

    if "fraction" in topic.lower():
        a, b, c = 3, 4, 2
        problem = f"<p>Simplify the expression: \\(\\frac{{{a}}}{{{b}}} + \\frac{{{c}}}{{{b}}}\\).</p>"
        hints = "<ol><li>When denominators match, add the numerators.</li><li>Simplify if possible.</li></ol>"
        solution = (
            f"<p>Since the denominators are both {b}, add the numerators: \\(\\frac{{{a}}}{{{b}}} + \\frac{{{c}}}{{{b}}} = "
            f"\\frac{{{a+c}}}{{{b}}}\\).</p>"
        )
        answer = f"<p><strong>Final:</strong> \\(\\frac{{{a+c}}}{{{b}}}\\)</p>"
    else:
        # Basic linear equation; tweak numbers for difficulty a bit.
        if difficulty in {"easy"}:
            m, x, b = 2, 4, 1
        elif difficulty in {"hard", "challenging"}:
            m, x, b = 7, 9, -5
        else:
            m, x, b = 3, 5, 2

        rhs = m * x + b
        problem = f"<p>Solve for \\(x\\): \\({m}x + {b} = {rhs}\\).</p>"
        hints = "<ol><li>Subtract the constant term from both sides.</li><li>Divide both sides by the coefficient of \\(x\\).</li></ol>"
        solution = (
            f"<p>Start with \\({m}x + {b} = {rhs}\\).</p>"
            f"<p>Subtract {b} from both sides: \\({m}x = {rhs - b}\\).</p>"
            f"<p>Divide by {m}: \\(x = {x}\\).</p>"
        )
        answer = f"<p><strong>Final:</strong> \\(x = {x}\\)</p>"

    return {"problem": problem, "hints": hints, "solution": solution, "answer": answer}


def _call_groq(system: str, user: str) -> dict:
    req_payload = {
        "model": GROQ_MODEL,
        "temperature": 0.7,
        "max_tokens": 1400,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        # OpenAI-compatible "response_format" works on some stacks; harmless if ignored.
        "response_format": {"type": "json_object"},
    }

    data = json.dumps(req_payload).encode("utf-8")
    req = Request(
        GROQ_ENDPOINT,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "User-Agent": "GenAI-Teachers/1.0",
        },
    )

    try:
        with urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Groq HTTPError {e.code}: {detail}") from e
    except URLError as e:
        raise RuntimeError(f"Groq URLError: {e}") from e

    content = (
        (payload.get("choices") or [{}])[0]
        .get("message", {})
        .get("content", "")
    )

    parsed = _extract_first_json(content)
    if not isinstance(parsed, dict):
        raise RuntimeError("Model response was not valid JSON.")

    # Single problem response
    return {
        "problem": _safe_str(parsed.get("problem") or ""),
        "hints": _safe_str(parsed.get("hints") or ""),
        "solution": _safe_str(parsed.get("solution") or ""),
        "answer": _safe_str(parsed.get("answer") or ""),
    }


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/api/health":
            return _json_response(self, 200, {"status": "ok"})
        return _json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        if self.path.rstrip("/") != "/api/generate":
            return _json_response(self, 404, {"error": "Not found"})

        form = _read_json_body(self)
        try:
            system, user = _build_prompt(form)
            
            if not GROQ_API_KEY:
                result = _local_mock(form)
                result["hints"] = (
                    (result.get("hints") or "")
                    + "<p><em>Note: This is a local mock response because <code>GROQ_API_KEY</code> is not set.</em></p>"
                )
                return _json_response(self, 200, result)
            result = _call_groq(system, user)
            return _json_response(self, 200, result)
        except Exception as e:
            return _json_response(
                self,
                500,
                {
                    "error": "Generation failed",
                    "detail": str(e),
                    # Still return the fields the UI expects
                    "problem": "<p>Failed to generate problem.</p>",
                    "hints": "",
                    "solution": "",
                    "answer": "",
                },
            )

    def log_message(self, fmt, *args):
        # quieter logs
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> int:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Mock backend running on http://{HOST}:{PORT}")
    print("Endpoints: GET /api/health, POST /api/generate")
    if not GROQ_API_KEY:
        print("WARNING: GROQ_API_KEY is not set. Requests will fail until you export it.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

