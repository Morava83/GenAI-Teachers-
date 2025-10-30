# from typing import Literal
# 
# from langchain_core.prompts import ChatPromptTemplate
# from langchain_core.pydantic_v1 import BaseModel, Field
# from langchain_openai import ChatOpenAI
# import os
# from langchain.schema import Document
# from dotenv import load_dotenv
# load_dotenv()
# from Problem_chatchain import query_pinecone_problem
# from Tutorial_chatchain import query_pinecone_tutorial
# from langchain_core.runnables import RunnablePassthrough, RunnableLambda
import os
from dotenv import load_dotenv

# ✅ Updated imports for latest LangChain versions
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Pinecone as LangchainPinecone
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.chains.retrieval_qa.base import RetrievalQA

from langchain.schema import Document
from pinecone import Pinecone, ServerlessSpec


api_key=os.environ.get("OPENAI_API_KEY")
llm = ChatOpenAI(model="gpt-3.5-turbo-0125", temperature=0)

def find_route(question):
    class RouteQuery(BaseModel):
        """Route a user query to the most relevant datasource."""

        datasource: Literal["problem_vectorstore", "tutorial_vectorstore"] = Field(
            ...,
            description="Given a user question, choose to route it to problem vectorstore which contains examples of problem sets OR a tutorial vectorstore which contains definitions and knowledge set of problems",
        )

    llm = ChatOpenAI(model_name="gpt-3.5-turbo-0125", temperature=0)
    
    system = """You are a router. Given a user question, return the most relevant data source to answer the question. 
    We have two data sources:
    1. problem_vectorstore: This contains examples of problem sets. Choose this data source if the query is asking to generate a question or problem. 
       Example: "create a math problem involving algebra?"
    2. tutorial_vectorstore: This contains definitions and knowledge sets of problems. Choose this data source if the query is related to understanding definitions or concepts. 
       Example: "What is the definition of an algebraic expression?"
    3. prompting the answer directly: If you are unsure, ask the user to rewrite the question and say please refer math-related question.
    Carefully choose the data source to route the question to based on these criteria."""

    route_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system),
            ("human", "User question: {question}"),
        ]
    )
    
    route_chain = route_prompt | llm
    response = route_chain.invoke({"question": question})
    return response

def query_pinecone(question, dok_level,route):
    route = find_route(question).content.strip()
    print(route)
    if route == "Data source: problem_vectorstore":
        response = query_pinecone_problem(question, dok_level)
    elif route == "Data source: tutorial_vectorstore":
        response = query_pinecone_tutorial(question, dok_level)
    else:
        response = route
    return response

def question_answerable(question):
    return

def main(query, dok, num_problems=1):
    """
    Main function to run the query chain.
    """
    # Determine if the query is a problem or a tutorial
    is_problem = query.startswith("create a math problem involving ")

    # Run the chain
    if is_problem:
        print("Generating problem...")
        for i in range(num_problems):
            print(f"--- Problem {i+1} ---")
            chain = Problem_chatchain.create_chain(llm, retriever, dok)
            result = chain.invoke({"query": query})
            print(result)
    else:
        print("Generating tutorial...")
        chain = Tutorial_chatchain.create_chain(llm, retriever)
        result = chain.invoke({"query": query})
        print(result)

if __name__ == "__main__":
    # Get the query and DOK from the command line
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="The query to run")
    parser.add_argument("dok", help="The DOK to use")
    parser.add_argument("--num_problems", help="The number of problems to generate", type=int, default=1)
    args = parser.parse_args()
    query = args.query
    dok = args.dok
    num_problems = args.num_problems

    main(query, dok, num_problems)


