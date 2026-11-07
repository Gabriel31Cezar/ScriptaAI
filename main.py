"""
ScriptaAI — Backend FastAPI (Etapa 2).
- Serve a interface em static/ (rota "/" e arquivos css/ e js/)
- Endpoints: /api/health, /api/upload, /api/generate-preview, /api/export-pdf
- Storage com UUID em storage/uploads e storage/output
"""

from __future__ import annotations

# 1. Silencia os avisos do GTK ANTES de importar o WeasyPrint (pdf_service)
from services.gtk_silencer import suppress_glib_warnings

suppress_glib_warnings()

# 2. Importações normais
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from services import media_service, pdf_service

# ---------------------------------------------------------------------------
# Caminhos e configuração
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
STORAGE_DIR = BASE_DIR / os.getenv("STORAGE_ROOT", "storage")
UPLOAD_DIR = STORAGE_DIR / "uploads"
OUTPUT_DIR = STORAGE_DIR / "output"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "25")) * 1024 * 1024
ALLOWED_EXT = frozenset({".txt", ".md", ".docx", ".mp3", ".mp4", ".png", ".pdf"})
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://127.0.0.1:8000,http://localhost:8000",
    ).split(",")
    if origin.strip()
]

# ---------------------------------------------------------------------------
# Aplicação
# ---------------------------------------------------------------------------

app = FastAPI(title="ScriptaAI", version="0.2.0")

# noinspection PyTypeChecker,PyArgumentList
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_frontend_cache(request: Request, call_next):
    """Evita que o navegador use CSS/JS/HTML antigos durante o desenvolvimento."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


# ---------------------------------------------------------------------------
# Schemas Pydantic (contrato com o app.js)
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

def _error_response(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"ok": False, "error": message})


def _new_id() -> str:
    return uuid.uuid4().hex


async def _save_upload(upload_file: UploadFile, dest: Path) -> int:
    """Grava o arquivo em blocos. Se passar do limite, apaga o arquivo parcial."""
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := await upload_file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Arquivo grande demais.")
                out.write(chunk)
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    return size


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html", media_type="text/html")


# ---------------------------------------------------------------------------
# Endpoints da API
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "app": "ScriptaAI", "version": "0.2.0"}


@app.post("/api/upload", response_model=UploadOut)
async def upload(files: list[UploadFile] = File(...)) -> UploadOut:
    saved: list[dict] = []

    for upload_file in files:
        original = upload_file.filename or "arquivo"
        ext = Path(original).suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(
                status_code=415,
                detail=f"Extensão não permitida: {ext or 'sem extensão'}",
            )

        file_id = _new_id()
        stored_name = f"{file_id}_{pdf_service.safe_filename(original)}"
        dest = UPLOAD_DIR / stored_name
        size = await _save_upload(upload_file, dest)

        saved.append(
            {
                "id": file_id,
                "filename": original,
                "stored_as": stored_name,
                "size": size,
                "url": f"/storage/uploads/{stored_name}",
            }
        )

    return UploadOut(uploads=saved)


@app.post("/api/generate-preview", response_model=PreviewOut)
async def generate_preview(payload: GenerateIn) -> PreviewOut:
    data = payload.model_dump()

    # Processamento de links com log
    scraped = await media_service.scrape_many(data.get("links") or [])
    extra_parts = []
    for item in scraped:
        if item.get("text"):
            extra_parts.append(item["text"])
        else:
            print(f"[AVISO] Link falhou ou não retornou texto: {item.get('url')}")

    used_links = len(extra_parts)
    print(f"[INFO] Preview gerado. Links usados: {used_links}")

    if extra_parts:
        base = (data.get("content") or "").strip()
        joined = "\n\n".join(extra_parts)
        data["content"] = f"{base}\n\n{joined}".strip() if base else joined

    html = pdf_service.build_html(data)
    return PreviewOut(html=html, used_links=used_links)


@app.post("/api/export-pdf")
async def export_pdf(payload: GenerateIn) -> FileResponse:
    data = payload.model_dump()
    file_id = _new_id()
    out_path = OUTPUT_DIR / f"{file_id}.pdf"

    try:
        pdf_service.render_pdf(data, out_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar PDF: {exc}") from exc

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"scriptaai_{file_id}.pdf",
    )


# ---------------------------------------------------------------------------
# Tratamento de erros em JSON padronizado
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return _error_response(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    print(f"[ERRO 422] Validação falhou: {exc.errors()}")
    return _error_response(422, "Dados inválidos na requisição.")


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    print(f"[ERRO 500] {exc}")
    return _error_response(500, f"Erro interno: {exc}")


# ---------------------------------------------------------------------------
# Arquivos estáticos (sempre por último, para não capturar /api)
# ---------------------------------------------------------------------------

app.mount("/storage/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")