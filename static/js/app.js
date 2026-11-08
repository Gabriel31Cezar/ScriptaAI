/* ==========================================================================
   ScriptaAI — app.js
   Etapa 1 (interface) + 3.1 (upload via API) + 3.2 (preview via API)
   ========================================================================== */

(() => {
    "use strict";

    const ACCEPTED_EXTENSIONS = [".txt", ".md", ".docx", ".mp3", ".mp4", ".png", ".pdf"];
    const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const API_UPLOAD = "/api/upload";
    const API_PREVIEW = "/api/generate-preview";
    const MAX_UPLOAD_MB = 25;
    const THEME_KEY = "scripta-theme";
    const MARGIN_CM = { narrow: "1.5cm", normal: "2.5cm", wide: "3.5cm" };
    const FONT_FAMILIES = {
        arial: "'Arial', sans-serif",
        times: "'Times New Roman', serif",
        roboto: "'Roboto', sans-serif",
        monospace: "'Courier New', monospace"
    };
    // Elementos removidos do HTML que vem do servidor, por segurança
    const UNSAFE_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form"];

    const state = {
        theme: "light",
        uploadedFiles: []
    };

    /* ---------------------------------------------------------------------
       Utilidades de acesso ao DOM
       --------------------------------------------------------------------- */
    const $ = (selector) => document.querySelector(selector);

    const fieldValue = (selector) => {
        const el = $(selector);
        return el ? el.value : "";
    };

    const fieldTrim = (selector) => fieldValue(selector).trim();

    function on(selector, eventName, handler) {
        const el = $(selector);
        if (el) el.addEventListener(eventName, handler);
    }

    function setStatus(message, kind = "") {
        const el = $("#preview-status");
        if (!el) return;
        el.textContent = message;
        el.dataset.kind = kind;
    }

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function extOf(name) {
        const index = (name || "").lastIndexOf(".");
        return index >= 0 ? name.slice(index).toLowerCase() : "";
    }

    /**
     * Normaliza texto vindo de um textarea, apenas para o envio ao servidor:
     * quebras de linha do Windows viram "\n", e as sequências literais "\n" e "\t"
     * (barra invertida + letra) viram quebra e tabulação reais.
     */
    function normalizeText(raw) {
        if (typeof raw !== "string") return "";
        return raw
            .replace(/\r\n?/g, "\n")
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t");
    }

    /**
     * Lê a mensagem de erro de uma resposta HTTP que não deu certo.
     * Usa "error" ou "detail" do JSON, se existirem; senão, o código HTTP.
     */
    async function readErrorDetail(resp) {
        let data = null;
        try {
            data = await resp.json();
        } catch {
            data = null;
        }
        if (data && data.error) return String(data.error);
        if (data && data.detail) return String(data.detail);
        return `HTTP ${resp.status}`;
    }

    /* ---------------------------------------------------------------------
       Tema claro/escuro
       --------------------------------------------------------------------- */
    function applyTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute("data-theme", theme);
        const btn = $("#theme-toggle");
        if (btn) {
            btn.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";
            btn.setAttribute("aria-pressed", String(theme === "dark"));
        }
    }

    function readSavedTheme() {
        try {
            return localStorage.getItem(THEME_KEY);
        } catch {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch {
            return false;
        }
        return true;
    }

    function initTheme() {
        const saved = readSavedTheme();
        if (saved === "light" || saved === "dark") {
            applyTheme(saved);
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            applyTheme(prefersDark ? "dark" : "light");
        }

        on("#theme-toggle", "click", () => {
            const next = state.theme === "dark" ? "light" : "dark";
            saveTheme(next);
            applyTheme(next);
        });
    }

    /* ---------------------------------------------------------------------
       Lista de arquivos enviados
       --------------------------------------------------------------------- */
    function renderFileList() {
        const list = $("#file-list");
        if (!list) return;

        list.textContent = "";
        list.hidden = state.uploadedFiles.length === 0;

        state.uploadedFiles.forEach((item) => {
            const li = document.createElement("li");
            li.className = "file-item";

            const name = document.createElement("span");
            name.className = "file-name";
            name.textContent = item.filename || item.stored_as || "(arquivo)";

            const size = document.createElement("span");
            size.className = "file-size";
            size.textContent = formatBytes(item.size);

            li.append(name, size);
            list.appendChild(li);
        });
    }

    /* ---------------------------------------------------------------------
       3.1 — Upload via POST /api/upload
       --------------------------------------------------------------------- */
    async function uploadFiles(fileListLike) {
        const files = Array.from(fileListLike || []);
        if (files.length === 0) return;

        const accepted = [];
        const rejected = [];

        files.forEach((file) => {
            const ext = extOf(file.name);
            if (!ACCEPTED_EXTENSIONS.includes(ext)) {
                rejected.push(`${file.name} (extensão ${ext || "desconhecida"})`);
            } else if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
                rejected.push(`${file.name} (acima de ${MAX_UPLOAD_MB} MB)`);
            } else {
                accepted.push(file);
            }
        });

        if (rejected.length > 0) {
            setStatus(`Não enviado: ${rejected.join(", ")}`, "error");
        }
        if (accepted.length === 0) return;

        setStatus(`Enviando ${accepted.length} arquivo(s)...`, "loading");

        const form = new FormData();
        accepted.forEach((file) => form.append("files", file, file.name));

        try {
            const resp = await fetch(API_UPLOAD, { method: "POST", body: form });

            if (!resp.ok) {
                setStatus(`Falha no upload: ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const data = await resp.json();
            const uploaded = Array.isArray(data.uploads) ? data.uploads : [];
            state.uploadedFiles.push(...uploaded);
            renderFileList();
            setStatus(`${uploaded.length} arquivo(s) enviado(s).`, "ok");
        } catch (err) {
            setStatus(`Falha de rede no upload: ${err.message}`, "error");
        }
    }

        function initUploadZone() {
        const zone = $("#upload-zone");
        const input = $("#file-input");
        if (!zone || !input) return;

        const openPicker = () => input.click();

        input.addEventListener("change", () => {
            const files = Array.from(input.files);
            input.value = "";
            void uploadFiles(files);
        });

        // Clique com o mouse abre o seletor
        zone.addEventListener("click", openPicker);

        // Teclado: Enter ou Espaço também abrem o seletor
        zone.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPicker();
            }
        });

        zone.addEventListener("dragenter", (event) => {
            event.preventDefault();
            zone.classList.add("is-dragover");
        });

        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("is-dragover");
        });

        zone.addEventListener("dragleave", (event) => {
            event.preventDefault();
            zone.classList.remove("is-dragover");
        });

        zone.addEventListener("drop", (event) => {
            event.preventDefault();
            zone.classList.remove("is-dragover");
            const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
            if (files.length > 0) void uploadFiles(files);
        });
    }

    // Impede que o navegador abra um arquivo solto fora da área de upload
    function blockBrowserFileOpen() {
        window.addEventListener("dragover", (event) => event.preventDefault());
        window.addEventListener("drop", (event) => event.preventDefault());
    }

    /* ---------------------------------------------------------------------
       Configurações visuais da folha A4
       --------------------------------------------------------------------- */
    function appendLine(parent, tag, className, text) {
        if (!text) return;
        const el = document.createElement(tag);
        el.className = className;
        el.textContent = text;
        parent.appendChild(el);
    }

    function applyCoverToSheet() {
        const cover = $("#a4-cover");
        if (!cover) return;

        const title = fieldTrim("#cover-title");
        const subtitle = fieldTrim("#cover-subtitle");
        const author = fieldTrim("#cover-author");
        const institution = fieldTrim("#cover-institution");
        const hasAny = [title, subtitle, author, institution].some(Boolean);

        cover.hidden = !hasAny;
        cover.textContent = "";
        if (!hasAny) return;

        appendLine(cover, "h2", "a4-cover-title", title);
        appendLine(cover, "p", "a4-cover-line a4-cover-subtitle", subtitle);
        appendLine(cover, "p", "a4-cover-line", author);
        appendLine(cover, "p", "a4-cover-line", institution);
    }

    function applyFormulaToSheet() {
        const box = $("#a4-formula");
        if (!box) return;
        const text = fieldTrim("#formula-input");
        box.hidden = text === "";
        box.textContent = text;
    }

    function applyTypographyAndMargins() {
        const sheet = $("#a4-sheet");
        if (!sheet) return;

        const font = fieldValue("#font-select") || "arial";
        const size = fieldValue("#size-select") || "12";
        const margin = fieldValue("#margin-select") || "normal";

        sheet.style.fontFamily = FONT_FAMILIES[font] || FONT_FAMILIES.arial;
        sheet.style.fontSize = `${size}pt`;
        sheet.dataset.margin = margin;
    }

    // O tamanho escolhido vale para a imagem e para a fórmula
    function applyImageOptions() {
        const size = fieldValue("#image-size-select") || "60";
        const layout = fieldValue("#image-layout-select") || "below";

        const media = $("#a4-media");
        if (media) {
            media.dataset.size = size;
            media.dataset.layout = layout;
        }

        const formula = $("#a4-formula");
        if (formula) formula.dataset.size = size;
    }

    function initConfigControls() {
        ["#font-select", "#size-select", "#margin-select"].forEach((selector) => {
            on(selector, "change", applyTypographyAndMargins);
        });
        ["#image-size-select", "#image-layout-select"].forEach((selector) => {
            on(selector, "change", applyImageOptions);
        });
        ["#cover-title", "#cover-subtitle", "#cover-author", "#cover-institution"].forEach((selector) => {
            on(selector, "input", applyCoverToSheet);
        });
        on("#formula-input", "input", applyFormulaToSheet);

        applyTypographyAndMargins();
        applyImageOptions();
        applyCoverToSheet();
        applyFormulaToSheet();
    }

    /* ---------------------------------------------------------------------
       3.2 — Payload e preview via POST /api/generate-preview
       --------------------------------------------------------------------- */
    function getSelectedNorm() {
        const checked = $('input[name="norm"]:checked');
        return checked ? checked.value : "abnt";
    }

    function collectPayload() {
        const prompt = normalizeText(fieldValue("#prompt-input")).trim();

        const links = normalizeText(fieldValue("#links-input"))
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const images = state.uploadedFiles
            .filter((file) => IMAGE_EXTENSIONS.includes(extOf(file.stored_as || file.filename || "")))
            .map((file) => ({ url: file.url, caption: file.filename || "" }));

        return {
            prompt,
            content: prompt,
            links,
            norm: getSelectedNorm(),
            font_family: fieldValue("#font-select") || "arial",
            font_size: parseInt(fieldValue("#size-select") || "12", 10),
            margin_density: fieldValue("#margin-select") || "normal",
            cover: {
                title: fieldTrim("#cover-title"),
                subtitle: fieldTrim("#cover-subtitle"),
                author: fieldTrim("#cover-author"),
                institution: fieldTrim("#cover-institution")
            },
            image_size: parseInt(fieldValue("#image-size-select") || "60", 10),
            image_layout: fieldValue("#image-layout-select") || "below",
            formula: normalizeText(fieldValue("#formula-input")).trim(),
            images
        };
    }

    /**
     * Converte o HTML recebido do servidor em nós do DOM, removendo
     * scripts, estilos, iframes, atributos "on..." e links javascript:.
     */
    function sanitizeToNodes(html) {
        const parsed = new DOMParser().parseFromString(String(html), "text/html");
        const body = parsed.body;

        UNSAFE_TAGS.forEach((tag) => {
            body.querySelectorAll(tag).forEach((el) => el.remove());
        });

        body.querySelectorAll("*").forEach((el) => {
            Array.from(el.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value.replace(/\s/g, "").toLowerCase();
                const isUrlAttr = name === "href" || name === "src";
                if (name.startsWith("on") || (isUrlAttr && value.startsWith("javascript:"))) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return Array.from(body.childNodes);
    }

    function renderPreviewHtml(html) {
        const sheet = $("#a4-sheet");
        if (!sheet) return;

        let host = $("#a4-content");
        if (!host) {
            host = document.createElement("div");
            host.id = "a4-content";
            sheet.appendChild(host);
        }

        host.textContent = "";
        sanitizeToNodes(html).forEach((node) => host.appendChild(node));
    }

    async function generatePreview() {
        const btn = $("#generate-btn");
        const loading = $("#a4-loading");

        if (btn) btn.disabled = true;
        if (loading) loading.hidden = false;
        setStatus("Gerando preview...", "loading");

        try {
            const resp = await fetch(API_PREVIEW, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(collectPayload())
            });

            if (!resp.ok) {
                setStatus(`Falha no preview: ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const data = await resp.json();
            renderPreviewHtml(typeof data.html === "string" ? data.html : "");

            const used = data.used_links ? ` (${data.used_links} link(s) usado(s))` : "";
            setStatus(`Preview atualizado${used}.`, "ok");
        } catch (err) {
            setStatus(`Falha de rede no preview: ${err.message}`, "error");
        } finally {
            if (loading) loading.hidden = true;
            if (btn) btn.disabled = false;
        }
    }

    /* ---------------------------------------------------------------------
       3.3 — Exportação de PDF via servidor (NOVO)
       --------------------------------------------------------------------- */
    async function downloadPdfFromServer() {
        const btn = $("#pdf-btn");
        if (btn) btn.disabled = true;
        setStatus("Gerando PDF no servidor...", "loading");

        try {
            const resp = await fetch("/api/export-pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(collectPayload())
            });

            if (!resp.ok) {
                setStatus(`Falha ao exportar PDF: ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);

            const title = fieldTrim("#cover-title") || "documento";
            const safeTitle = title.replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "documento";

            const link = document.createElement("a");
            link.href = url;
            link.download = `${safeTitle}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setStatus("PDF gerado e baixado com sucesso.", "ok");
        } catch (err) {
            setStatus(`Falha de rede ao exportar PDF: ${err.message}`, "error");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /* ---------------------------------------------------------------------
       Exportação para .doc (Word), montada com a API DOM
       --------------------------------------------------------------------- */
    function buildWordCss(margin) {
        return `
            @page WordSection1 { size: 21cm 29.7cm; margin: ${margin}; }
            div.WordSection1 { page: WordSection1; }
            p { text-align: justify; margin: 0 0 10pt 0; }
            .a4-cover { text-align: center; margin-bottom: 18pt; }
            .a4-cover-title { font-size: 16pt; font-weight: bold; margin: 0 0 8pt 0; }
            .a4-cover-line { text-align: center; margin: 4pt 0; }
            .a4-title { font-size: 13pt; font-weight: bold; margin: 0 0 10pt 0; }
            .a4-figure { text-align: center; }
            .a4-image-placeholder { border: 1px dashed #9aa6b4; padding: 20pt; text-align: center; color: #6b7785; }
            .a4-figure figcaption { text-align: center; font-size: 9pt; }
            .a4-formula { text-align: center; font-style: italic; border: 1px dashed #9aa6b4; padding: 8pt; margin: 10pt 0; }
        `;
    }

    function buildWordDocument(sheet) {
        const doc = document.implementation.createHTMLDocument("Documento");
        const html = doc.documentElement;
        html.setAttribute("lang", "pt-BR");
        html.setAttribute("xmlns", "http://www.w3.org/TR/REC-html40");
        html.setAttribute("xmlns:o", "urn:schemas-microsoft-com:office:office");
        html.setAttribute("xmlns:w", "urn:schemas-microsoft-com:office:word");

        const meta = doc.createElement("meta");
        meta.setAttribute("charset", "utf-8");

        const style = doc.createElement("style");
        style.textContent = buildWordCss(MARGIN_CM[fieldValue("#margin-select")] || MARGIN_CM.normal);

        doc.head.append(meta, style);

        const wrapper = doc.createElement("div");
        wrapper.className = "WordSection1";
        wrapper.setAttribute(
            "style",
            `font-family: ${sheet.style.fontFamily || "Arial, sans-serif"}; font-size: ${sheet.style.fontSize || "12pt"}; line-height: 1.5;`
        );

        const content = sheet.cloneNode(true);
        content.removeAttribute("id");
        content.removeAttribute("style");
        content.removeAttribute("data-margin");
        content.querySelectorAll("[hidden], .a4-loading").forEach((el) => el.remove());

        wrapper.append(...Array.from(content.childNodes));
        doc.body.appendChild(wrapper);

        return "<!DOCTYPE html>\n" + html.outerHTML;
    }

    function downloadWord() {
        const sheet = $("#a4-sheet");
        if (!sheet) return;

        const title = fieldTrim("#cover-title");
        const baseName = (title || "documento").replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "documento";

        const blob = new Blob(["\ufeff" + buildWordDocument(sheet)], { type: "application/msword" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseName}.doc`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("Arquivo .doc gerado. Abra no Word ou no LibreOffice.", "ok");
    }

    /* ---------------------------------------------------------------------
       Copiar texto e novo documento
       --------------------------------------------------------------------- */
    async function copyText() {
        const sheet = $("#a4-sheet");
        if (!sheet) return;

        const text = sheet.innerText.trim();
        if (text === "") {
            setStatus("Não há texto para copiar.", "error");
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setStatus("Texto copiado para a área de transferência.", "ok");
        } catch {
            setStatus("Não foi possível copiar o texto.", "error");
        }
    }

    function clearDocument() {
        [
            "#prompt-input",
            "#links-input",
            "#cover-title",
            "#cover-subtitle",
            "#cover-author",
            "#cover-institution",
            "#formula-input"
        ].forEach((selector) => {
            const el = $(selector);
            if (el) el.value = "";
        });

        state.uploadedFiles = [];
        renderFileList();

        const host = $("#a4-content");
        if (host) host.textContent = "";

        applyCoverToSheet();
        applyFormulaToSheet();
        setStatus("Novo documento iniciado.", "ok");
    }

    /* ---------------------------------------------------------------------
       Barra de ferramentas e modal de LGPD
       --------------------------------------------------------------------- */
    function initToolbar() {
        on("#generate-btn", "click", () => {
            void generatePreview();
        });

        // AQUI ESTÁ A MUDANÇA DA ETAPA 3.3 (Não usa mais window.print())
        on("#pdf-btn", "click", () => {
            void downloadPdfFromServer();
        });

        on("#docx-btn", "click", downloadWord);
        on("#copy-btn", "click", () => {
            void copyText();
        });
        on("#new-doc-btn", "click", clearDocument);
    }

    function initPrivacyModal() {
        const link = $("#privacy-link");
        const modal = $("#privacy-modal");
        if (!link || !modal) return;

        link.addEventListener("click", (event) => {
            event.preventDefault();
            modal.showModal();
        });

        // Clique direto na caixa do <dialog> (fora do conteúdo interno) fecha o modal
        modal.addEventListener("click", (event) => {
            if (event.target === modal) modal.close();
        });
    }

    /* ---------------------------------------------------------------------
       Inicialização
       --------------------------------------------------------------------- */
    function init() {
        initTheme();
        initUploadZone();
        blockBrowserFileOpen();
        initConfigControls();
        initToolbar();
        initPrivacyModal();
        renderFileList();
        setStatus("Pronto.", "ok");
    }

    document.addEventListener("DOMContentLoaded", init);
})();