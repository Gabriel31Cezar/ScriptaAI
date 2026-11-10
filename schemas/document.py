from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class CoverIn(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    subtitle: Optional[str] = Field(None, max_length=300)
    author: Optional[str] = Field(None, max_length=150)
    institution: Optional[str] = Field(None, max_length=200)


class ImageIn(BaseModel):
    url: str
    caption: Optional[str] = Field(None, max_length=300)
    size: Literal[30, 60, 100] = 60
    layout: Literal["below", "side", "center"] = "below"


class GenerateIn(BaseModel):
    prompt: Optional[str] = Field(None, max_length=5000)
    content: Optional[str] = Field(None, max_length=50000)
    links: List[str] = Field(default_factory=list)
    # Adicionado para suportar arquivos de apoio locais (.txt, .md)
    uploaded_files: List[str] = Field(default_factory=list)
    norm: Literal["abnt", "apa-ieee", "executivo", "apostila"] = "abnt"
    font_family: Literal["arial", "times", "roboto", "monospace"] = "arial"
    font_size: Literal[10, 11, 12, 13, 14] = 12
    margin_density: Literal["narrow", "normal", "wide"] = "normal"
    cover: Optional[CoverIn] = None
    image_size: Literal[30, 60, 100] = 60
    image_layout: Literal["below", "side", "center"] = "below"
    formula: Optional[str] = Field(None, max_length=1000)
    images: List[ImageIn] = Field(default_factory=list)


class DocumentOut(BaseModel):
    id: str
    title: Optional[str]
    norm: str
    font_family: str
    font_size: int
    margin_density: str
    created_at: str

    class Config:
        from_attributes = True


class CoverOut(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    author: Optional[str] = None
    institution: Optional[str] = None


class DocumentDetailOut(BaseModel):
    id: str
    title: Optional[str]
    norm: str
    font_family: str
    font_size: int
    margin_density: str
    cover: Optional[CoverOut] = None
    formula: str = ""
    content: str = ""
    created_at: str
    updated_at: Optional[str] = None


class PreviewOut(BaseModel):
    html: str
    used_links: int = 0
    # Opcional: podemos incluir contagem de arquivos usados se achar prudente, mantendo compatibilidade
    used_files: int = 0


class UploadOut(BaseModel):
    uploads: list[dict]