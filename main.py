"""
ScriptaAI — Backend FastAPI (Etapa 2).
- Serve a SPA em static/
- Endpoints: /api/generate-preview, /api/export-pdf, /api/upload
- Storage com UUID em storage/uploads e storage/output
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from services import media_service, pdf_service

# ---------------------------------------------------------------------------
# Configuração de caminhos
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
STORAGE_DIR = BASE_DIR / os.getenv("STORAGE_ROOT", "storage")
UPLOAD_DIR = STORAGE_DIR / "uploads"
OUTPUT_DIR = STORAGE_DIR / "output"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
ALLOWED_EXT = {".txt", ".md", ".docx", ".mp3", ".mp4", ".png", ".pdf"}

# ---------------------------------------------------------------------------
# Aplicação — CORS via construtor (evita o bug de ParamSpec do PyCharm)
# ---------------------------------------------------------------------------

_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:8000,http://localhost:8000",
).split(",")

app = FastAPI(
    title="ScriptaAI",
    version="0.2.0",
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=_allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Schemas Pydantic
# ---------------------------------------------------------------------------

class CoverIn(BaseModel):
    title: str = ""
    subtitle: str = ""
    author: str = ""
    institution: str = ""


class ImageIn(BaseModel):
    url: str = ""
    caption: str = ""


class GenerateIn(BaseModel):
    prompt: str = ""
    content: str = ""
    links: list[str] = Field(default_factory=list)
    norm: str = "abnt"
    font_family: str = "arial"
    font_size: int = 12
    margin_density: str = "normal"
    cover: CoverIn = Field(default_factory=CoverIn)
    image_size: int = 100
    image_layout: str = "below"
    formula: str = ""
    images: list[ImageIn] = Field(default_factory=list)


class PreviewOut(BaseModel):
    html: str
    used_links: int = 0


class UploadOut(BaseModel):
    uploads: list[dict]


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def _err(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"ok": False, "error": message})


def _uid() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "app": "ScriptaAI", "version": "0.2.0"}


@app.post("/api/upload", response_model=UploadOut)
async def upload(files: list[UploadFile] = File(...)) -> UploadOut:
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    saved: list[dict] = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(
                status_code=415,
                detail=f"Extensão não permitida: {ext}",
            )

        uid = _uid()
        safe = pdf_service.safe_filename(f.filename or f"arquivo{ext}")
        final_name = f"{uid}_{safe}"
        dest = UPLOAD_DIR / final_name

        size = 0
        with dest.open("wb") as out:
            while chunk := await f.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_MB * 1024 * 1024:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="Arquivo grande demais.")
                out.write(chunk)

        saved.append(
            {
                "id": uid,
                "filename": f.filename,
                "stored_as": final_name,
                "size": size,
                "url": f"/storage/uploads/{final_name}",
            }
        )
    return UploadOut(uploads=saved)


@app.post("/api/generate-preview", response_model=PreviewOut)
async def generate_preview(payload: GenerateIn) -> PreviewOut:
    data = payload.model_dump()

    scraped = await media_service.scrape_many(data.get("links") or [])
    used_links = 0
    extra_parts: list[str] = []
    for item in scraped:
        if item["text"]:
            used_links += 1
            extra_parts.append(item["text"])
    if extra_parts:
        base = (data.get("content") or "").strip()
        joined = "\n\n".join(extra_parts)
        data["content"] = f"{base}\n\n{joined}".strip() if base else joined

    html = pdf_service.build_html(data)
    return PreviewOut(html=html, used_links=used_links)


@app.post("/api/export-pdf")
async def export_pdf(payload: GenerateIn) -> FileResponse:
    data = payload.model_dump()
    uid = _uid()
    out_path = OUTPUT_DIR / f"{uid}.pdf"

    try:
        pdf_service.render_pdf(data, out_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar PDF: {exc}")

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"scriptaai_{uid}.pdf",
    )


# ---------------------------------------------------------------------------
# Exceções globais em JSON padronizado
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exc_handler(_request, exc: HTTPException):
    return _err(exc.status_code, str(exc.detail))


@app.exception_handler(Exception)
async def generic_exc_handler(_request, exc: Exception):
    return _err(500, f"Erro interno: {exc}")


# ---------------------------------------------------------------------------
# Montagem de estáticos (por último para não capturar /api)
# ---------------------------------------------------------------------------

app.mount(
    "/storage/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)

app.mount(
    "/",
    StaticFiles(directory=str(STATIC_DIR), html=True),
    name="static",
)