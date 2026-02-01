import os
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# Use TamIA inference server instead of OpenAI API
from tamia_module import get_gpt_response, generate_prompt

load_dotenv()


class QueryHandler:
    """Shared query handler for different Chroma collections."""

    def __init__(self, collection_name, persist_directory):
        """
        Initialize the query handler with a specific Chroma collection.

        Args:
            collection_name: Name of the Chroma collection
            persist_directory: Directory where the collection is persisted
        """
        self.collection_name = collection_name
        self.persist_directory = persist_directory

        # Initialize embedder and vectorstore
        embedder = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=embedder,
            persist_directory=persist_directory
        )

        # TamIA client is managed internally by tamia_module
        self.client = None

    def get_similar_docs(self, query, k, score=False):
        """Retrieve similar documents based on the input query."""
        if score:
            # Return documents with similarity scores
            results = self.vectorstore.similarity_search_with_score(query, k=k)
            return [{"metadata": doc.metadata, "content": doc.page_content, "score": score}
                    for doc, score in results]
        else:
            # Return just the documents
            results = self.vectorstore.similarity_search(query, k=k)
            return [{"metadata": doc.metadata, "content": doc.page_content}
                    for doc in results]

    def query(self, query, dok_level):
        """Process the query using Chroma and generate a response using GPT."""
        similar_docs = self.get_similar_docs(query, k=3, score=True)

        # Format the retrieved documents as context for the prompt
        context = f"User Request: {query}\n\nRelevant Educational Content:\n"
        for i, doc in enumerate(similar_docs, 1):
            context += f"\nExample {i} (similarity: {doc['score']:.3f}):\n"
            context += f"{doc['content']}\n"

        prompt = generate_prompt(context, dok_level)
        response = get_gpt_response(prompt, self.client)
        return response
