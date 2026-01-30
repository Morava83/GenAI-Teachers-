from query_handler import QueryHandler

# Initialize tutorial query handler
tutorial_handler = QueryHandler(
    collection_name="edu-research-tutorial",
    persist_directory="chroma_data_tutorial"
)

def query_chroma_tutorial(query, dok_level):
    """Process the query using Chroma and generate a response using GPT."""
    return tutorial_handler.query(query, dok_level)


if __name__ == "__main__":
    query = input("Enter your query: ")
    dok_level = int(input("Enter the Depth of Knowledge (DOK) level (1-4): "))
    response = query_chroma_tutorial(query, dok_level)
    print(response)
