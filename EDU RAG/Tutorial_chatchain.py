import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain_openai import ChatOpenAI

from gpt_module import get_gpt_response, generate_prompt
from openai import OpenAI as GPTClient
import time
load_dotenv()

# Initialize Chroma
collection_name = "edu-research-tutorial"
persist_directory = "chroma_data_tutorial"

# Initialize retriever and vectorstore
embedder = OpenAIEmbeddings()

# Create or load Chroma vectorstore
vectorstore = Chroma(
    collection_name=collection_name,
    embedding_function=embedder,
    persist_directory=persist_directory
)

llm = ChatOpenAI(model_name="gpt-4", temperature=0)

def get_similar_docs(query, k, score=False):
    """Retrieve similar documents based on the input query."""
    if score:
        # Return documents with similarity scores
        results = vectorstore.similarity_search_with_score(query, k=k)
        return [{"metadata": doc.metadata, "content": doc.page_content, "score": score} for doc, score in results]
    else:
        # Return just the documents
        results = vectorstore.similarity_search(query, k=k)
        return [{"metadata": doc.metadata, "content": doc.page_content} for doc in results]

# Initialize GPT Client
client = GPTClient(api_key=os.environ.get("OPENAI_API_KEY"))

def query_chroma_tutorial(query, dok_level):
    """Process the query using Chroma and generate a response using GPT."""
    similar_docs = get_similar_docs(query, k=3, score=True)
    prompt = generate_prompt(similar_docs, dok_level)
    response = get_gpt_response(prompt, client)
    return response


if __name__ == "__main__":
    query = input("Enter your query: ")
    dok_level = int(input("Enter the Depth of Knowledge (DOK) level (1-4): "))
    response = query_chroma_tutorial(query, dok_level)
    print(response)
