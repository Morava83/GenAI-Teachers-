from query_handler import QueryHandler

# Initialize problem query handler
problem_handler = QueryHandler(
    collection_name="edu-research",
    persist_directory="chroma_data_edu_research"
)

def query_chroma_problem(query, dok_level):
    """Process the query using Chroma and generate a response using GPT."""
    return problem_handler.query(query, dok_level)


if __name__ == "__main__":
    query = input("Enter your query: ")
    dok_level = int(input("Enter the Depth of Knowledge (DOK) level (1-4): "))
    response = query_chroma_problem(query, dok_level)
    print(response)
