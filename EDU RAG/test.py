import os
from dotenv import load_dotenv
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
load_dotenv()

collection_name = "edu-research"
persist_directory = "chroma_data_edu_research"

import time

embedder = OpenAIEmbeddings()

# Create or load Chroma vectorstore
vectorstore = Chroma(
    collection_name=collection_name,
    embedding_function=embedder,
    persist_directory=persist_directory
)

# view collection stats
print(f"Collection name: {collection_name}")
print(f"Number of documents: {vectorstore._collection.count()}")

query = " Intermediate Value Theorem?"
results = vectorstore.similarity_search_with_score(query, k=3)
print("\nQuery results:")
for doc, score in results:
    print(f"Score: {score}")
    print(f"Content: {doc.page_content[:200]}...")
    print(f"Metadata: {doc.metadata}")
    print("---")