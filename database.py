import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Configuração da URL do banco de dados (padrão SQLite local)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scriptaai.db")

# Criação da Engine do SQLAlchemy (necessário check_same_thread para SQLite)
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Fábrica de Sessões
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base Declarativa para os Models
Base = declarative_base()


def get_db():
    """Dependência para injetar a sessão do banco de dados nas rotas do FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()