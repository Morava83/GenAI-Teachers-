from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import os
import re
import requests

# Backend type: ollama, openai, zhipu, placeholder
BACKEND_TYPE = os.environ.get("BACKEND_TYPE", "ollama")

# Ollama settings
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "120"))

# OpenAI settings
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# Zhipu AI settings
ZHIPU_API_KEY = os.environ.get("ZHIPU_API_KEY", "")
ZHIPU_MODEL = os.environ.get("ZHIPU_MODEL", "glm-4-flash")


def _build_prompt(data):
    topic = data.get('topic', '')
    area_subject = data.get('areaSubject', '')
    grade = data.get('grade', '')
    dok = data.get('dok', '')
    difficulty = data.get('difficulty', 'medium')
    language = data.get('language', 'English')
    interest_value = data.get('interestValue', '')
    format_type = data.get('format', '')
    additional_requirements = data.get('additionalRequirements', '')
    selected_tags = data.get('selectedTags', [])

    prompt = f"""You are a helpful math teacher. Generate a math problem with the following specifications:

Topic: {topic or area_subject}
Grade: {grade}th grade
Depth of Knowledge: {dok}
Difficulty: {difficulty}
Language: {language}
"""
    if interest_value:
        prompt += f"Context/Theme: {interest_value}\n"
    if selected_tags:
        prompt += f"Interests to incorporate: {', '.join(selected_tags)}\n"
    if additional_requirements:
        prompt += f"Additional requirements: {additional_requirements}\n"
    if format_type:
        prompt += f"Format: {format_type}\n"

    prompt += """
Generate EXACTLY this JSON format (no other text before or after):
{
    "problem": "The math problem statement",
    "hints": ["Hint 1: ...", "Hint 2: ..."],
    "solution": "Step-by-step solution",
    "answer": "Final answer"
}
"""
    return prompt


def _parse_response(generated_text):
    json_match = re.search(r'\{.*\}', generated_text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group())
            return {
                "problem": parsed.get("problem", ""),
                "hints": "<br>".join([f"<p>{h}</p>" for h in parsed.get("hints", [])]),
                "solution": f"<p>{parsed.get('solution', '')}</p>",
                "answer": f"<p><strong>Answer: </strong>{parsed.get('answer', '')}</p>"
            }
        except json.JSONDecodeError:
            pass

    return {
        "problem": f"<p><strong>Problem:</strong> {generated_text}</p>",
        "hints": "<p>Hint: Read the problem carefully</p><p>Hint: Break it into smaller steps</p>",
        "solution": "<p>Solution steps will be generated...</p>",
        "answer": "<p><strong>Answer: </strong>See above</p>"
    }


def _call_ollama(prompt):
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 1024
            }
        },
        timeout=OLLAMA_TIMEOUT
    )
    response.raise_for_status()
    result = response.json()
    return _parse_response(result.get("response", ""))


def _call_openai(prompt):
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        },
        json={
            "model": OPENAI_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1024,
        },
        timeout=60
    )
    response.raise_for_status()
    result = response.json()
    text = result["choices"][0]["message"]["content"]
    return _parse_response(text)


def _call_zhipu(prompt):
    response = requests.post(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ZHIPU_API_KEY}"
        },
        json={
            "model": ZHIPU_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1024,
        },
        timeout=60
    )
    response.raise_for_status()
    result = response.json()
    text = result["choices"][0]["message"]["content"]
    return _parse_response(text)


def _placeholder_response():
    return {
        "problem": "<p>Please configure an AI backend on the Account page to generate problems.</p>",
        "hints": "<p>Go to Account > AI Backend Configuration to set up your preferred backend.</p>",
        "solution": "<p>No backend configured.</p>",
        "answer": "<p><strong>Note: </strong> Configure a backend in Account settings.</p>"
    }


def react_app(request):
    return render(request, "index.html")


@csrf_exempt
@require_http_methods(["POST"])
def generate_problem(request):
    try:
        data = json.loads(request.body)
        prompt = _build_prompt(data)

        if BACKEND_TYPE == "ollama":
            try:
                return JsonResponse(_call_ollama(prompt), status=200)
            except requests.exceptions.Timeout:
                return JsonResponse({"error": "AI model timeout. Please try again."}, status=504)
            except requests.exceptions.RequestException as e:
                return JsonResponse({"error": f"Failed to connect to Ollama: {str(e)}"}, status=503)

        elif BACKEND_TYPE == "openai":
            if not OPENAI_API_KEY:
                return JsonResponse({"error": "OpenAI API key not configured on server."}, status=503)
            try:
                return JsonResponse(_call_openai(prompt), status=200)
            except requests.exceptions.RequestException as e:
                return JsonResponse({"error": f"OpenAI API error: {str(e)}"}, status=503)

        elif BACKEND_TYPE == "zhipu":
            if not ZHIPU_API_KEY:
                return JsonResponse({"error": "Zhipu API key not configured on server."}, status=503)
            try:
                return JsonResponse(_call_zhipu(prompt), status=200)
            except requests.exceptions.RequestException as e:
                return JsonResponse({"error": f"Zhipu API error: {str(e)}"}, status=503)

        else:
            return JsonResponse(_placeholder_response(), status=200)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request body"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    return JsonResponse({
        "status": "healthy",
        "backend_type": BACKEND_TYPE,
    })


@csrf_exempt
@require_http_methods(["GET"])
def ollama_status(request):
    if BACKEND_TYPE == "ollama":
        try:
            response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                return JsonResponse({
                    "status": "healthy",
                    "backend_type": BACKEND_TYPE,
                    "model_in_use": OLLAMA_MODEL,
                    "available_models": [m.get("name", "") for m in models]
                })
            return JsonResponse({"status": "error", "message": "Ollama not responding"}, status=503)
        except requests.exceptions.RequestException:
            return JsonResponse({
                "status": "unavailable",
                "message": "Cannot connect to Ollama. Is it running?"
            }, status=503)
    else:
        return JsonResponse({
            "status": "available",
            "backend_type": BACKEND_TYPE,
            "message": f"Backend type is '{BACKEND_TYPE}'"
        })
