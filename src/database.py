import os
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv

load_dotenv()

sqlite_url = os.getenv("DATABASE_URL", "sqlite:///./medical_analysis.db")
engine = create_engine(sqlite_url, echo=False, connect_args={"check_same_thread": False})

def init_db():
    from src import models # Ensure models are registered
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
