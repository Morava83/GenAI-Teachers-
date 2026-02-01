import dotenv
from langchain_community.document_loaders import PyPDFium2Loader
import os
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

dotenv.load_dotenv()
REVIEWS_CHROMA_PATH = "chroma_data"

def load_data(path):
    loader = PyPDFium2Loader(path)
    docs = loader.load()
    return docs

def create_retriever(docs):
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    retriever = Chroma(persist_directory=REVIEWS_CHROMA_PATH).from_documents(
        docs,
        HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2"),
    )
    return retriever

def get_retriever(collection_name="edu-research", persist_directory="chroma_data_edu_research"):
    """Get retriever from existing Chroma database."""
    embedder = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embedder,
        persist_directory=persist_directory
    )

    retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 5})

    return retriever

def test_retrieval(retriever):
    test_query = "give me the solution for limx→πsin(x+ sinx)"
    results = retriever.similarity_search(test_query, k=3)
    print(results[0].page_content)

if __name__ == "__main__":
    path = "/Users/yonganyu/Desktop/handon RAG/EDU RAG/examples/Math 140 Tutorial 3 Solutions.pdf"
    docs = load_data(path)
    retriever = create_retriever(docs)
    test_retrieval(retriever)
