import openai
import langchain
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os
from dotenv import load_dotenv


# Set up Chroma

# Load environment variables from .env file
load_dotenv()
embed_model = "text-embedding-ada-002"

def vectorstore(path):
    loader = PyPDFLoader(path)
    pages = loader.load_and_split()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
    )
    pdf_texts = text_splitter.split_documents(pages)

    collection_name = "edu-research"
    persist_directory = "chroma_data_edu_research"

    print(
        f"Creating collection: {collection_name} in local directory {persist_directory}"
    )

    embedder = OpenAIEmbeddings()

    vectorstore = Chroma.from_documents(
        documents=pdf_texts,
        embedding=embedder,
        collection_name=collection_name,
        persist_directory=persist_directory
    )

    return vectorstore

if __name__ == "__main__":
    vectorstore_instance = vectorstore("EDU RAG/examples/Math 140 Tutorial 3 Solutions.pdf")