from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import os
import sys
from pathlib import Path

# Add EDU RAG directory to Python path
BASE_DIR = Path(__file__).resolve().parent.parent
EDU_RAG_DIR = BASE_DIR / 'EDU RAG'
sys.path.insert(0, str(EDU_RAG_DIR))

# Import EDU RAG query system
from Query_chain import query_chroma

def react_app(request):
    return render(request, "index.html")

@csrf_exempt
@require_http_methods(["POST"])
def generate_problem(request):
    try:
        data = json.loads(request.body)

        topic = data.get('topic', '')
        area_subject = data.get('areaSubject', '')
        grade = data.get('grade', '')
        standards = data.get('standards', '')
        dok = data.get('dok', 2)  # Default to DOK level 2
        difficulty = data.get('difficulty', 'medium')
        language = data.get('language', 'English')
        interest_value = data.get('interestValue', '')
        format_type = data.get('format', '')
        number_of_problems = data.get('numberOfProblems', 1)
        additional_requirements = data.get('additionalRequirements', '')
        selected_tags = data.get('selectedTags', [])

        # Build the question for EDU RAG system
        question_parts = []

        if number_of_problems > 1:
            question_parts.append(f"Generate {number_of_problems} math problems")
        else:
            question_parts.append("Generate a math problem")

        if topic or area_subject:
            question_parts.append(f"about {topic or area_subject}")

        if grade:
            question_parts.append(f"for {grade}th grade")

        if difficulty:
            question_parts.append(f"at {difficulty} difficulty level")

        if interest_value:
            question_parts.append(f"in the context of {interest_value}")

        if selected_tags:
            question_parts.append(f"incorporating these interests: {', '.join(selected_tags)}")

        if standards:
            question_parts.append(f"aligned with standards: {standards}")

        if language and language != 'English':
            question_parts.append(f"in {language} language")

        if format_type:
            question_parts.append(f"in {format_type} format")

        if additional_requirements:
            question_parts.append(f"with the following requirements: {additional_requirements}")

        question_parts.append("Format your response with XML tags: <problem> for the problem statement, <hints> for hints, <solution> for the step-by-step solution, and <answer> for the final answer.")

        question = " ".join(question_parts)

        # Convert DOK to integer if it's a string
        try:
            dok_level = int(dok) if dok else 2
            # Ensure DOK level is between 1 and 4
            dok_level = max(1, min(4, dok_level))
        except (ValueError, TypeError):
            dok_level = 2

        # Call EDU RAG system
        route = None  # Let the system auto-detect the route
        response_text = query_chroma(question, dok_level, route)

        # Parse the response
        # The response is a single string containing the full problem
        # We'll use simple parsing to extract sections
        response_data = parse_problem_response(response_text)

        return JsonResponse(response_data, status=200)

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in generate_problem: {error_details}")
        return JsonResponse({
            "error": str(e),
            "details": error_details if os.getenv('DEBUG') == 'True' else None
        }, status=500)


def parse_problem_response(response_text):
    """
    Parse the response from query_chroma into structured sections using XML tags.

    Expected format:
    <problem>Problem statement here</problem>
    <hints>Hints here</hints>
    <solution>Step-by-step solution here</solution>
    <answer>Final answer here</answer>
    """
    import re

    def extract_tag_content(tag_name, text, default=""):
        """Extract content between XML tags"""
        pattern = f'<{tag_name}>(.*?)</{tag_name}>'
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            content = match.group(1).strip()
            # Convert newlines to HTML paragraphs
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            return "".join([f"<p>{line}</p>" for line in lines])
        return default

    # Try to extract XML-tagged sections
    problem = extract_tag_content('problem', response_text, "")
    hints = extract_tag_content('hints', response_text, "")
    solution = extract_tag_content('solution', response_text, "")
    answer = extract_tag_content('answer', response_text, "")

    # Fallback: if no XML tags found, use the old keyword-based parsing
    if not any([problem, hints, solution, answer]):
        lines = response_text.strip().split('\n')
        problem_lines = []
        hints_lines = []
        solution_lines = []
        answer_lines = []
        current_section = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            lower_line = line.lower()

            # Detect section headers
            if 'problem' in lower_line and ':' in line and len(line) < 50:
                current_section = 'problem'
                continue
            elif 'hint' in lower_line and len(line) < 50:
                current_section = 'hints'
                continue
            elif 'solution' in lower_line or 'step' in lower_line and len(line) < 50:
                current_section = 'solution'
                continue
            elif 'answer' in lower_line and ':' in line and len(line) < 50:
                current_section = 'answer'
                continue

            # Add line to current section
            if current_section == 'problem':
                problem_lines.append(line)
            elif current_section == 'hints':
                hints_lines.append(line)
            elif current_section == 'solution':
                solution_lines.append(line)
            elif current_section == 'answer':
                answer_lines.append(line)
            else:
                problem_lines.append(line)

        # Convert to HTML
        def lines_to_html(lines):
            if not lines:
                return ""
            return "".join([f"<p>{line}</p>" for line in lines if line])

        problem = lines_to_html(problem_lines)
        hints = lines_to_html(hints_lines)
        solution = lines_to_html(solution_lines)
        answer = lines_to_html(answer_lines)

    # If still nothing, put everything in problem
    if not any([problem, hints, solution, answer]):
        problem = f"<p>{response_text}</p>"

    return {
        "problem": problem if problem else f"<p>{response_text}</p>",
        "hints": hints if hints else "<p>Try breaking down the problem into smaller steps.</p>",
        "solution": solution if solution else "<p>Solution provided in the problem above.</p>",
        "answer": answer if answer else "<p>Answer included in the solution.</p>"
    }

@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    return JsonResponse({"status": "healthy"})
