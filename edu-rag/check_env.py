import os
from dotenv import load_dotenv

load_dotenv()  # Load variables from .env

print("OPENAI_API_KEY:", os.environ.get("OPENAI_API_KEY"))
print("PINECONE_API_KEY:", os.environ.get("PINECONE_API_KEY"))
