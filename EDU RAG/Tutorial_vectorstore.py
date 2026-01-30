import openai
import langchain
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import os
from dotenv import load_dotenv

# Set up Chroma

# Load environment variables from .env file
load_dotenv()
embed_model = "all-MiniLM-L6-v2"

def vectorstore(path):
    loader = PyPDFLoader(path)
    pages = loader.load_and_split()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
    )
    pdf_texts = text_splitter.split_documents(pages)

    collection_name = "edu-rag-tutorial"
    persist_directory = "chroma_data_tutorial"

    print(
        f"Creating collection: {collection_name} in local directory {persist_directory}"
    )

    embedder = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    vectorstore = Chroma.from_documents(
        documents=pdf_texts,
        embedding=embedder,
        collection_name=collection_name,
        persist_directory=persist_directory
    )

    return vectorstore

