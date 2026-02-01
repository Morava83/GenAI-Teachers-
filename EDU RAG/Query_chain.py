from dotenv import load_dotenv
load_dotenv()
from Problem_chatchain import query_chroma_problem
from Tutorial_chatchain import query_chroma_tutorial
from rorqual_module import get_gpt_response


def find_route(question):
    system = """You are a router. Given a user question, return the most relevant data source to answer the question.
    We have two data sources:
    1. problem_vectorstore: This contains examples of problem sets. Choose this data source if the query is asking to generate a question or problem.
       Example: "Create a math problem involving algebra."
    2. tutorial_vectorstore: This contains definitions and knowledge sets of problems. Choose this data source if the query is related to understanding definitions or concepts.
       Example: "What is the definition of an algebraic expression?"
    3. prompting the answer directly: If you are unsure, ask the user to rewrite the question and say please refer math-related question.
    Carefully choose the data source to route the question to based on these criteria."""

    prompt = f"{system}\n\nUser question: {question}\n\nRespond with ONLY the datasource name: either 'problem_vectorstore' or 'tutorial_vectorstore'."

    response_text = get_gpt_response(prompt)

    # Create a simple response object that mimics the langchain response structure
    class SimpleResponse:
        def __init__(self, content):
            self.content = content

    return SimpleResponse(response_text)

def query_chroma(question, dok_level,route):
    route = find_route(question).content.strip()
    print(f"Route decision: {route}")

    # Check if route contains the vectorstore names (case-insensitive)
    route_lower = route.lower()
    if "problem_vectorstore" in route_lower or "problem set" in route_lower or "generate" in route_lower:
        response = query_chroma_problem(question, dok_level)
    elif "tutorial_vectorstore" in route_lower or "definition" in route_lower or "concept" in route_lower:
        response = query_chroma_tutorial(question, dok_level)
    else:
        # Default to problem generation since that's the primary use case
        print(f"Warning: Could not determine route from '{route}', defaulting to problem generation")
        response = query_chroma_problem(question, dok_level)
    return response

def question_answerable(question):
    return


if __name__ == "__main__":
    question = input("Enter your query: ")
    dok_level = int(input("Enter the Depth of Knowledge (DOK) level (1-4): "))
    route = find_route(question)
    response = query_chroma(question, dok_level,route)
    print(response)


