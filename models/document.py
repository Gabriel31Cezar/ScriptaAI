import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title = Column(String, nullable=True)
    norm = Column(String, nullable=False, default="abnt")
    font_family = Column(String, nullable=False, default="arial")
    font_size = Column(Integer, nullable=False, default=12)
    margin_density = Column(String, nullable=False, default="normal")
    cover_json = Column(Text, nullable=True)
    formula = Column(Text, nullable=True)
    content_md = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    source_files = relationship("SourceFile", back_populates="document", cascade="all, delete-orphan")
    images = relationship("DocumentImage", back_populates="document", cascade="all, delete-orphan")
    exports = relationship("ExportRecord", back_populates="document", cascade="all, delete-orphan")


class SourceFile(Base):
    __tablename__ = "source_files"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    stored_as = Column(String, nullable=False)
    size = Column(Integer, nullable=False)

    document = relationship("Document", back_populates="source_files")


class DocumentImage(Base):
    __tablename__ = "document_images"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    caption = Column(String, nullable=True)
    ordem = Column(Integer, default=0)

    document = relationship("Document", back_populates="images")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    format = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="exports")