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
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama3-70b-8192")  # "llama70b" on Groq
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


def _build_prompt(form: dict) -> tuple[str, str]:
    topic = _safe_str(form.get("topic")).strip()
    area = _safe_str(form.get("areaSubject")).strip()
    grade = _safe_str(form.get("grade")).strip()
    standards = _safe_str(form.get("standards")).strip()
    dok = _safe_str(form.get("dok")).strip()
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

    user_constraints = {
        "topic": topic,
        "areaSubject": area,
        "grade": grade,
        "standards": standards,
        "dok": dok,
        "difficulty": difficulty,
        "language": language,
        "interestValue": interest,
        "format": fmt,
        "selectedTags": tags,
        "additionalRequirements": additional,
    }

    system = (
        "You are an expert teacher and problem writer. "
        "Generate ONE high-quality learning problem that matches the user's constraints. "
        "Return ONLY valid JSON with exactly these keys: "
        "problem, hints, solution, answer. "
        "Values should be HTML strings (safe to render with dangerouslySetInnerHTML). "
        "No markdown fences, no extra text."
    )

    user = (
        "Create a single math learning task.\n"
        f"Constraints JSON:\n{json.dumps(user_constraints, ensure_ascii=False)}\n\n"
        "JSON output schema:\n"
        '{\n'
        '  "problem": "<p>...</p>",\n'
        '  "hints": "<ol><li>...</li></ol>",\n'
        '  "solution": "<p>Step-by-step...</p>",\n'
        '  "answer": "<p><strong>Final:</strong> ...</p>"\n'
        '}\n'
        "Important: keep it self-contained; do not reference external files."
    )

    return system, user


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
    # find first {...} block
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    blob = m.group(0)
    try:
        return json.loads(blob)
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

    # Ensure keys exist for the frontend.
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

