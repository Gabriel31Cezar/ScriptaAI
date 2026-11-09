"""
ScriptaAI — Backend FastAPI (Etapa 3 - Banco de Dados & LGPD).
- Serve a interface em static/ (rota "/" e arquivos css/ e js/)
- Endpoints: /api/health, /api/upload, /api/generate-preview, /api/export-pdf, /api/documents
- Storage com UUID em storage/uploads e storage/output
- Persistência com SQLAlchemy e SQLite + Tarefa de Auto-limpeza LGPD
"""

from __future__ import annotations

# 1. Silencia os avisos do GTK ANTES de importar o WeasyPrint (pdf_service)
from services.gtk_silencer import suppress_glib_warnings

suppress_glib_warnings()

# 2. Importações
import json
import os
import uuid
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, Depends, status as http_status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from services import media_service, pdf_service
from services.ai_service import generate_text_with_gemini
from services.cleanup_service import cleanup_temporary_files_task
from database import engine, Base, get_db
from models.document import Document
from schemas.document import GenerateIn, DocumentOut, DocumentDetailOut, UploadOut, PreviewOut

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

# Inicialização das tabelas no Banco de Dados
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Lifespan (Substituto moderno para @app.on_event)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Gerencia o ciclo de vida da aplicação e tarefas em background (LGPD)."""
    task = asyncio.create_task(cleanup_temporary_files_task())
    yield
    task.cancel()


# ---------------------------------------------------------------------------
# Aplicação
# ---------------------------------------------------------------------------

app = FastAPI(title="ScriptaAI", version="0.3.0", lifespan=lifespan)

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
# Utilitários
# ---------------------------------------------------------------------------

def _error_response(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"ok": False, "error": message})


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
    return {"ok": True, "app": "ScriptaAI", "version": "0.3.0"}


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

    prompt_text = (data.get("prompt") or "").strip()

    # 1. Processa os links para extrair estritamente o texto útil, isolando ruídos
    scraped = await media_service.scrape_many(data.get("links") or [])
    extra_parts = []
    for item in scraped:
        if item.get("text"):
            extra_parts.append(item["text"])
        else:
            print(f"[AVISO] Link falhou ou não retornou texto: {item.get('url')}")

    used_links = len(extra_parts)
    context_material = "\n\n".join(extra_parts).strip()

    # 2. Isola o Prompt como comando/instrução e os links como material de apoio estrito
    ai_instruction = prompt_text if prompt_text else "Gere um documento estruturado com base nas referências fornecidas."

    if context_material:
        full_ai_prompt = (
            f"[INSTRUÇÃO DO USUÁRIO / COMANDO]\n{ai_instruction}\n\n"
            f"[MATERIAL DE REFERÊNCIA E CONTEXTO EXTERNO]\n"
            f"Utilize exclusivamente o texto abaixo como base de dados para redigir o documento final. "
            f"Ignore qualquer elemento de navegação ou poluição eletrônica da página web:\n"
            f"--------------------------------------------------\n"
            f"{context_material}\n"
            f"--------------------------------------------------"
        )
    else:
        full_ai_prompt = (
            f"[INSTRUÇÃO DO USUÁRIO / COMANDO]\n{ai_instruction}\n\n"
            f"Escreva o texto completo e estruturado para o documento correspondente."
        )

    # 3. Executa a chamada ao Gemini com o prompt separado do conteúdo bruto
    try:
        generated_content = generate_text_with_gemini(full_ai_prompt)
    except Exception as e:
        generated_content = f"[Erro ao gerar texto com IA: {str(e)}]"

    data["content"] = generated_content
    print(f"[INFO] Preview gerado. Links usados como contexto: {used_links}")

    html = pdf_service.build_html(data)
    return PreviewOut(html=html, used_links=used_links)


@app.post("/api/export-pdf")
async def export_pdf(payload: GenerateIn) -> FileResponse:
    data = payload.model_dump()

    # Aplica a mesma estrutura de isolamento entre comando (prompt) e contexto (links) no PDF
    prompt_text = (data.get("prompt") or "").strip()
    if prompt_text and not (data.get("content") and data.get("content") != prompt_text):
        scraped = await media_service.scrape_many(data.get("links") or [])
        context_material = "\n\n".join([item["text"] for item in scraped if item.get("text")]).strip()

        if context_material:
            full_ai_prompt = (
                f"[INSTRUÇÃO DO USUÁRIO / COMANDO]\n{prompt_text}\n\n"
                f"[MATERIAL DE REFERÊNCIA E CONTEXTO EXTERNO]\n{context_material}"
            )
        else:
            full_ai_prompt = prompt_text

        try:
            data["content"] = generate_text_with_gemini(full_ai_prompt)
        except Exception as exc:
            print(f"[AVISO] Falha ao gerar IA no PDF: {exc}")

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


@app.post("/api/documents", response_model=DocumentOut, status_code=http_status.HTTP_201_CREATED)
def create_document(payload: GenerateIn, db: Session = Depends(get_db)):
    """Salva um novo documento no banco de dados baseado no payload."""
    cover_data = payload.cover
    title = cover_data.title if cover_data and cover_data.title else "Documento sem Título"

    cover_json_str = cover_data.model_dump_json() if cover_data else None

    new_doc = Document(
        title=title,
        norm=payload.norm,
        font_family=payload.font_family,
        font_size=payload.font_size,
        margin_density=payload.margin_density,
        cover_json=cover_json_str if cover_json_str else "",
        formula=payload.formula or "",
        content_md=payload.content or ""
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    return DocumentOut(
        id=new_doc.id,
        title=new_doc.title,
        norm=new_doc.norm,
        font_family=new_doc.font_family,
        font_size=new_doc.font_size,
        margin_density=new_doc.margin_density,
        created_at=new_doc.created_at.isoformat()
    )


@app.get("/api/documents", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    """Lista todos os documentos salvos no histórico."""
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [
        DocumentOut(
            id=d.id,
            title=d.title,
            norm=d.norm,
            font_family=d.font_family,
            font_size=d.font_size,
            margin_density=d.margin_density,
            created_at=d.created_at.isoformat()
        )
        for d in docs
    ]


@app.get("/api/documents/{document_id}", response_model=DocumentDetailOut)
def get_document(document_id: str, db: Session = Depends(get_db)):
    """Retorna um documento salvo com capa e texto completos."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    # A capa é guardada como texto JSON; se estiver vazia ou corrompida, volta como None
    cover: dict | None = None
    if doc.cover_json:
        try:
            parsed = json.loads(doc.cover_json)
            cover = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            cover = None

    return DocumentDetailOut(
        id=doc.id,
        title=doc.title,
        norm=doc.norm,
        font_family=doc.font_family,
        font_size=doc.font_size,
        margin_density=doc.margin_density,
        cover=cover,  # type: ignore[arg-type]
        formula=doc.formula or "",
        content=doc.content_md or "",
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat() if doc.updated_at else None,
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