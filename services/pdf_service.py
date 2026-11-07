"""
Engine de compilação HTML/Markdown -> PDF via WeasyPrint.
Regras estritas:
  - Proibição de quebra de página antes de títulos (h1-h4).
  - Proibição de quebra dentro de blocos de imagem/figura.
  - Suporte a imagens em coluna (lado a lado) e abaixo do texto.
  - Estilos por norma: ABNT, APA/IEEE, Executivo, Apostila.
"""

from __future__ import annotations

import re
from pathlib import Path

import markdown
from weasyprint import HTML

# ---------------------------------------------------------------------------
# Mapas de estilo por norma
# ---------------------------------------------------------------------------

_NORM_STYLES: dict[str, dict[str, str]] = {
    "abnt": {
        "font_family": "'Times New Roman', serif",
        "font_size": "12pt",
        "line_height": "1.5",
        "margin": "3cm 2cm 2cm 3cm",
        "text_align": "justify",
        "title_align": "left",
    },
    "apa-ieee": {
        "font_family": "'Times New Roman', serif",
        "font_size": "12pt",
        "line_height": "2.0",
        "margin": "2.54cm 2.54cm 2.54cm 2.54cm",
        "text_align": "left",
        "title_align": "left",
    },
    "executivo": {
        "font_family": "'Arial', sans-serif",
        "font_size": "11pt",
        "line_height": "1.4",
        "margin": "2.5cm 2.5cm 2.5cm 2.5cm",
        "text_align": "justify",
        "title_align": "left",
    },
    "apostila": {
        "font_family": "'Arial', sans-serif",
        "font_size": "10pt",
        "line_height": "1.3",
        "margin": "1.5cm 1.5cm 1.5cm 1.5cm",
        "text_align": "justify",
        "title_align": "left",
    },
}

_DENSITY_MARGIN: dict[str, str] = {
    "narrow": "1.5cm",
    "normal": "2.5cm",
    "wide": "3.5cm",
}

_IMAGE_SIZE_PCT: dict[int, str] = {30: "30%", 60: "60%", 100: "100%"}

# ---------------------------------------------------------------------------
# CSS base
# ---------------------------------------------------------------------------

_BASE_CSS = """
@page {{
    size: A4;
    margin: {margin};
    @bottom-center {{
        content: counter(page);
        font-size: 9pt;
        color: #555;
    }}
}}

body {{
    font-family: {font_family};
    font-size: {font_size};
    line-height: {line_height};
    text-align: {text_align};
    color: #111;
}}

h1, h2, h3, h4 {{
    text-align: {title_align};
    page-break-after: avoid;
    break-after: avoid;
    margin-top: 1.2em;
    margin-bottom: 0.4em;
}}

h1 {{ font-size: 1.6em; }}
h2 {{ font-size: 1.4em; }}
h3 {{ font-size: 1.2em; }}
h4 {{ font-size: 1.05em; }}

p {{
    margin: 0 0 0.8em 0;
    orphans: 3;
    widows: 3;
}}

figure, .media-block {{
    page-break-inside: avoid;
    break-inside: avoid;
    margin: 1em 0;
}}

figure img, .media-block img {{
    display: block;
    max-width: {img_max_width};
    width: {img_width};
    height: auto;
    margin: 0 auto;
}}

figcaption, .media-caption {{
    font-size: 0.85em;
    font-style: italic;
    text-align: center;
    margin-top: 0.3em;
    color: #444;
}}

.media-row {{
    display: flex;
    gap: 1em;
    page-break-inside: avoid;
    break-inside: avoid;
}}
.media-row figure {{
    flex: 1 1 0;
}}

.formula-block {{
    font-family: 'Courier New', monospace;
    text-align: center;
    margin: 1em 0;
    padding: 0.6em;
    background: #f5f5f5;
    border-left: 3px solid #888;
    page-break-inside: avoid;
    break-inside: avoid;
}}

table {{
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    page-break-inside: avoid;
    break-inside: avoid;
}}
th, td {{
    border: 1px solid #999;
    padding: 0.4em 0.6em;
    text-align: left;
}}
th {{
    background: #eaeaea;
}}

.cover {{
    text-align: center;
    padding-top: 6cm;
    page-break-after: always;
    break-after: page;
}}
.cover h1 {{ font-size: 2em; text-align: center; }}
.cover h2 {{ font-size: 1.3em; text-align: center; font-weight: normal; }}
.cover .cover-author, .cover .cover-institution {{
    margin-top: 3em;
    font-size: 1.1em;
}}
"""


# ---------------------------------------------------------------------------
# Funções auxiliares
# ---------------------------------------------------------------------------

def _normalize_norm(norm: str | None) -> str:
    key = (norm or "abnt").strip().lower()
    return key if key in _NORM_STYLES else "abnt"


def _build_css(norm: str, margin_density: str | None, image_size: int | None) -> str:
    style = dict(_NORM_STYLES[norm])
    if margin_density and margin_density in _DENSITY_MARGIN:
        style["margin"] = _DENSITY_MARGIN[margin_density]
    img_width = _IMAGE_SIZE_PCT.get(int(image_size or 100), "100%")
    style["img_width"] = img_width
    style["img_max_width"] = "100%"
    return _BASE_CSS.format(**style)


def _cover_html(cover: dict | None) -> str:
    if not cover:
        return ""
    title = (cover.get("title") or "").strip()
    subtitle = (cover.get("subtitle") or "").strip()
    author = (cover.get("author") or "").strip()
    institution = (cover.get("institution") or "").strip()
    if not any([title, subtitle, author, institution]):
        return ""

    parts = ['<div class="cover">']
    if title:
        parts.append(f"<h1>{_esc(title)}</h1>")
    if subtitle:
        parts.append(f"<h2>{_esc(subtitle)}</h2>")
    if author:
        parts.append(f'<div class="cover-author">{_esc(author)}</div>')
    if institution:
        parts.append(f'<div class="cover-institution">{_esc(institution)}</div>')
    parts.append("</div>")
    return "\n".join(parts)


def _formula_html(formula: str | None) -> str:
    f = (formula or "").strip()
    if not f:
        return ""
    return f'<div class="formula-block">{_esc(f)}</div>'


def _images_html(images: list[dict] | None, layout: str | None, size: int | None) -> str:
    if not images:
        return ""
    width = _IMAGE_SIZE_PCT.get(int(size or 100), "100%")
    layout = (layout or "below").lower()
    figs = []
    for img in images:
        src = img.get("url") or img.get("path") or ""
        caption = (img.get("caption") or "").strip()
        if not src:
            continue
        cap = f"<figcaption>{_esc(caption)}</figcaption>" if caption else ""
        figs.append(
            f'<figure style="width:{width}; margin:0 auto;">'
            f'<img src="{_esc(src)}" style="width:100%;" />{cap}</figure>'
        )
    if not figs:
        return ""
    if layout == "side":
        return f'<div class="media-row">{"".join(figs)}</div>'
    if layout == "center":
        return "\n".join(figs)
    return "\n".join(figs)


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _markdown_to_html(content: str) -> str:
    return markdown.markdown(
        content,
        extensions=["extra", "tables", "fenced_code", "sane_lists"],
        output_format="html5",
    )


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------

def build_html(payload: dict) -> str:
    norm = _normalize_norm(payload.get("norm"))
    margin_density = payload.get("margin_density")
    image_size = payload.get("image_size")
    image_layout = payload.get("image_layout")

    content = (payload.get("content") or "").strip()
    content_html = _markdown_to_html(content) if content else ""

    cover = payload.get("cover") or {}
    images = payload.get("images") or []
    formula = payload.get("formula")

    cover_html = _cover_html(cover)
    images_html = _images_html(images, image_layout, image_size)
    formula_html = _formula_html(formula)

    css = _build_css(norm, margin_density, image_size)

    body_parts = [cover_html, images_html, formula_html, content_html]
    body = "\n".join(p for p in body_parts if p)

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>ScriptaAI — Documento</title>
<style>{css}</style>
</head>
<body>
{body}
</body>
</html>"""


def render_pdf(payload: dict, output_path: Path) -> Path:
    html_str = build_html(payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html_str, base_url=str(output_path.parent)).write_pdf(str(output_path))
    return output_path


def safe_filename(name: str) -> str:
    name = re.sub(r"[^\w.\-]+", "_", name, flags=re.UNICODE)
    return name.strip("._") or "arquivo"