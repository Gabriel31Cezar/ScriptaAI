"""
Leitura de arquivos fonte (.txt, .md, .docx) e estrutura para raspagem de URLs.
Usa requests para evitar bloqueios de User-Agent e simular navegador real.
"""

from __future__ import annotations

import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from docx import Document

TEXT_EXTS = {".txt", ".md"}
DOCX_EXTS = {".docx"}
AUDIO_EXTS = {".mp3", ".mp4"}

_MAX_CHARS = 20_000

# Cabeçalhos idênticos aos de um Chrome real no Windows
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}


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


def _extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    # Remove scripts, estilos, cabeçalhos, rodapés e menus
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    # Limpa quebras de linha excessivas
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def scrape_url(url: str) -> str:
    # noinspection HttpUrlsUsage
    if not url.lower().startswith(("http://", "https://")):
        return ""
    try:
        # O requests.get é síncrono, mas roda numa thread separada pelo FastAPI,
        # então não trava o servidor.
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()

        ctype = resp.headers.get("content-type", "")
        if "html" not in ctype:
            return ""

        return _extract_text_from_html(resp.text)[:_MAX_CHARS]
    except Exception as e:
        # Imprime o erro no terminal para sabermos o porquê do link falhar
        print(f"[ERRO NO SCRAPE] Falha ao acessar {url}: {e}")
        return ""


async def scrape_many(urls: list[str]) -> list[dict]:
    out: list[dict] = []
    for url in urls:
        u = (url or "").strip()
        if not u:
            continue
        out.append({"url": u, "text": await scrape_url(u)})
    return out