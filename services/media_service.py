"""
Leitura de arquivos fonte (.txt, .md, .docx) e estrutura inicial para
raspagem de URLs e transcrição de áudio/vídeo.
"""

from __future__ import annotations

import re
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from docx import Document

TEXT_EXTS = {".txt", ".md"}
DOCX_EXTS = {".docx"}
AUDIO_EXTS = {".mp3", ".mp4"}

_HTTP_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
_MAX_CHARS = 20_000


# ---------------------------------------------------------------------------
# Leitura de arquivos locais
# ---------------------------------------------------------------------------

def read_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def read_md(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def read_docx(path: Path) -> str:
    doc = Document(str(path))
    parts: list[str] = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            parts.append(" | ".join(cells))
    return "\n".join(parts)


def read_file(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in TEXT_EXTS:
        return path.read_text(encoding="utf-8", errors="replace")
    if ext in DOCX_EXTS:
        return read_docx(path)
    if ext in AUDIO_EXTS:
        return _transcribe_stub(path)
    if ext == ".pdf":
        return ""
    return ""


def _transcribe_stub(path: Path) -> str:
    return f"[transcrição pendente: {path.name}]"


# ---------------------------------------------------------------------------
# Raspagem de URLs
# ---------------------------------------------------------------------------

def _extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def scrape_url(url: str) -> str:
    if not url.lower().startswith(("http://", "https://")):
        return ""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=_HTTP_TIMEOUT
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            ctype = resp.headers.get("content-type", "")
            if "html" not in ctype:
                return ""
            return _extract_text_from_html(resp.text)[:_MAX_CHARS]
    except (httpx.HTTPError, httpx.InvalidURL, ValueError):
        return ""


async def scrape_many(urls: list[str]) -> list[dict]:
    out: list[dict] = []
    for url in urls:
        u = (url or "").strip()
        if not u:
            continue
        out.append({"url": u, "text": await scrape_url(u)})
    return out