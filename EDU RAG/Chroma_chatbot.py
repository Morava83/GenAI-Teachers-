import dotenv
from langchain.prompts import (
    PromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    ChatPromptTemplate,
)
from langchain.chains import LLMChain
from langchain_core.output_parsers import StrOutputParser
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.schema.runnable import RunnablePassthrough
from tamia_module import get_gpt_response, generate_prompt
from Chroma_retriever import create_retriever, load_data
import os
dotenv.load_dotenv()
from langchain.agents import (
    Tool,
    AgentExecutor,
)
from langchain import hub

REVIEWS_CHROMA_PATH = "chroma_data/"

reviews_vector_db = Chroma(
    persist_directory=REVIEWS_CHROMA_PATH,
    embedding_function=HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
)

docs = load_data("EDU RAG/examples/Math 140 Tutorial 3 Solutions.pdf")
reviews_retriever  = reviews_vector_db.as_retriever(k=10)
class ChatChain:
    def __init__(self):
        self.retriever = create_retriever(docs)

    def run(self, user_input, dok_level):
        # Retrieve relevant documents based on user input
        results = self.retriever.similarity_search(user_input, k=1)
        if results:
            retrieved_content = results[0].page_content  # Assume we take the most relevant document
        else:
            return "No relevant documents found."

        # Generate a response based on the retrieved content
        prompt = generate_prompt(retrieved_content, dok_level)
        response = get_gpt_response(prompt)
        return response


if __name__ == "__main__":
    chat_chain = ChatChain()
    # Example user input
    user_input = "I need information on mathematical continuity principles."

    # Run the chat chain
    response = chat_chain.run(user_input=user_input, dok_level=2)
    print(response)