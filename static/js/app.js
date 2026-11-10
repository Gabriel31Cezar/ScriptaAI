/* ==========================================================================
   ScriptaAI — app.js
   Etapa 1 (interface) + 3.1 (upload) + 3.2 (preview) + 3.3 (exportação)
   + Etapa 5 (carregamento, mensagens amigáveis, teclado, salvar documento,
   lista de documentos salvos, abrir documento salvo)
   + Exclusão de documentos do histórico
   ========================================================================== */

(() => {
    "use strict";

    const ACCEPTED_EXTENSIONS = [".txt", ".md", ".docx", ".mp3", ".mp4", ".png", ".pdf"];
    const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const API_UPLOAD = "/api/upload";
    const API_PREVIEW = "/api/generate-preview";
    const API_EXPORT_PDF = "/api/export-pdf";
    const API_DOCUMENTS = "/api/documents";
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

    // Mensagens amigáveis para códigos HTTP comuns
    const HTTP_MESSAGES = {
        400: "A requisição não pôde ser processada. Revise os dados e tente de novo.",
        404: "Serviço não encontrado. Verifique se o servidor está em execução.",
        413: "Arquivo grande demais para ser enviado.",
        415: "Tipo de arquivo não suportado.",
        422: "Alguns dados estão inválidos. Confira o formulário e tente de novo.",
        500: "Erro interno no servidor. Tente novamente em instantes.",
        503: "Servidor indisponível no momento. Tente novamente em instantes."
    };

    // Rótulos legíveis das normas, usados na lista de documentos salvos
    const NORM_LABELS = {
        abnt: "ABNT",
        "apa-ieee": "APA / IEEE",
        executivo: "Executivo Moderno",
        apostila: "Apostila Compacta"
    };

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

    const setValue = (selector, value) => {
        const el = $(selector);
        if (el) el.value = value;
    };

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

    function setDocsStatus(message, kind = "") {
        const el = $("#docs-status");
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

    /* ---------------------------------------------------------------------
       Mensagens de erro e estados de carregamento
       --------------------------------------------------------------------- */

    /**
     * Converte uma resposta HTTP de erro em uma mensagem curta em português.
     * O detalhe técnico do servidor vai para o console, para depuração.
     */
    async function readErrorDetail(resp) {
        let data = null;
        try {
            data = await resp.json();
        } catch {
            data = null;
        }
        const detail = data ? String(data.error || data.detail || "") : "";
        if (detail) console.error(`[ScriptaAI] HTTP ${resp.status}: ${detail}`);

        if (HTTP_MESSAGES[resp.status]) return HTTP_MESSAGES[resp.status];
        return `Erro inesperado (código ${resp.status}). Tente novamente.`;
    }

    /**
     * Mensagem para falhas de rede (servidor desligado, sem conexão, etc.).
     * O erro técnico original vai para o console.
     */
    function friendlyNetworkError(err) {
        console.error("[ScriptaAI] Falha de rede:", err);
        return "Não foi possível conectar ao servidor. Verifique se ele está em execução e tente novamente.";
    }

    /**
     * Troca o rótulo do botão durante a ação e restaura o original ao final.
     */
    function setBusy(btn, busy, busyLabel = "Aguarde...") {
        if (!btn) return;
        if (busy) {
            if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.textContent;
            btn.textContent = busyLabel;
            btn.disabled = true;
            btn.setAttribute("aria-busy", "true");
        } else {
            btn.textContent = btn.dataset.idleLabel || btn.textContent;
            btn.disabled = false;
            btn.removeAttribute("aria-busy");
        }
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
       Upload via POST /api/upload
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
                setStatus(`Não foi possível enviar os arquivos. ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const data = await resp.json();
            const uploaded = Array.isArray(data.uploads) ? data.uploads : [];
            state.uploadedFiles.push(...uploaded);
            renderFileList();
            setStatus(`${uploaded.length} arquivo(s) enviado(s).`, "ok");
        } catch (err) {
            setStatus(friendlyNetworkError(err), "error");
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

        zone.addEventListener("click", openPicker);

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
       Payload e preview via POST /api/generate-preview
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

        setBusy(btn, true, "Gerando...");
        if (loading) loading.hidden = false;
        setStatus("Gerando preview...", "loading");

        try {
            const resp = await fetch(API_PREVIEW, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(collectPayload())
            });

            if (!resp.ok) {
                setStatus(`Não foi possível gerar o preview. ${await readErrorDetail(resp)}`, "error");
                return false;
            }

            const data = await resp.json();
            renderPreviewHtml(typeof data.html === "string" ? data.html : "");

            const used = data.used_links ? ` (${data.used_links} link(s) usado(s))` : "";
            setStatus(`Preview atualizado${used}.`, "ok");
            return true;
        } catch (err) {
            setStatus(friendlyNetworkError(err), "error");
            return false;
        } finally {
            if (loading) loading.hidden = true;
            setBusy(btn, false);
        }
    }

    /* ---------------------------------------------------------------------
       Salvar documento via POST /api/documents
       --------------------------------------------------------------------- */
    async function saveDocument() {
        const btn = $("#save-doc-btn");
        setBusy(btn, true, "Salvando...");
        setStatus("Salvando documento...", "loading");

        try {
            const resp = await fetch(API_DOCUMENTS, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(collectPayload())
            });

            if (!resp.ok) {
                setStatus(`Não foi possível salvar o documento. ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const data = await resp.json();
            setStatus(`Documento salvo: "${data.title}".`, "ok");
            void loadDocuments();
        } catch (err) {
            setStatus(friendlyNetworkError(err), "error");
        } finally {
            setBusy(btn, false);
        }
    }

    /* ---------------------------------------------------------------------
       Lista e exclusão de documentos salvos (GET e DELETE /api/documents)
       --------------------------------------------------------------------- */

    function formatDate(isoText) {
        const date = new Date(isoText);
        if (Number.isNaN(date.getTime())) return isoText || "";
        return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function renderDocumentsList(docs) {
        const list = $("#docs-list");
        if (!list) return;

        list.textContent = "";
        list.hidden = docs.length === 0;

        docs.forEach((doc) => {
            const li = document.createElement("li");
            li.className = "doc-item";

            const info = document.createElement("div");
            info.className = "doc-info";

            const title = document.createElement("span");
            title.className = "doc-title";
            title.textContent = doc.title || "Documento sem Título";

            const meta = document.createElement("span");
            meta.className = "doc-meta";
            const norm = NORM_LABELS[doc.norm] || doc.norm || "";
            meta.textContent = `${norm} · ${formatDate(doc.created_at)}`;

            info.append(title, meta);

            const actionsDiv = document.createElement("div");
            actionsDiv.className = "doc-actions";
            actionsDiv.style.display = "flex";
            actionsDiv.style.gap = "4px";

            const openBtn = document.createElement("button");
            openBtn.type = "button";
            openBtn.className = "tool-btn doc-open";
            openBtn.textContent = "Abrir";
            openBtn.setAttribute("aria-label", `Abrir documento ${doc.title || "sem título"}`);
            openBtn.addEventListener("click", () => {
                void openDocument(doc.id, openBtn);
            });

            // Botão de exclusão adicionado para limpar rascunhos antigos indesejados
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "tool-btn doc-delete";
            deleteBtn.textContent = "🗑️";
            deleteBtn.title = "Excluir documento";
            deleteBtn.setAttribute("aria-label", `Excluir documento ${doc.title || "sem título"}`);
            deleteBtn.addEventListener("click", (event) => {
                void deleteDocument(doc.id, event);
            });

            actionsDiv.append(openBtn, deleteBtn);
            li.append(info, actionsDiv);
            list.appendChild(li);
        });
    }

    async function loadDocuments() {
        const btn = $("#refresh-docs-btn");
        setBusy(btn, true, "Atualizando...");
        setDocsStatus("Carregando documentos salvos...", "loading");

        try {
            const resp = await fetch(API_DOCUMENTS);

            if (!resp.ok) {
                renderDocumentsList([]);
                setDocsStatus(`Não foi possível carregar a lista. ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const docs = await resp.json();
            const items = Array.isArray(docs) ? docs : [];
            renderDocumentsList(items);

            setDocsStatus(
                items.length === 0
                    ? "Nenhum documento salvo ainda."
                    : `${items.length} documento(s) salvo(s).`,
                "ok"
            );
        } catch (err) {
            renderDocumentsList([]);
            setDocsStatus(friendlyNetworkError(err), "error");
        } finally {
            setBusy(btn, false);
        }
    }

    async function deleteDocument(docId, event) {
        if (event) event.stopPropagation();

        if (!window.confirm("Tem certeza de que deseja excluir este documento do histórico?")) {
            return;
        }

        try {
            const resp = await fetch(`${API_DOCUMENTS}/${encodeURIComponent(docId)}`, {
                method: "DELETE"
            });

            if (!resp.ok && resp.status !== 204) {
                setStatus(`Não foi possível excluir o documento. ${await readErrorDetail(resp)}`, "error");
                return;
            }

            setStatus("Documento excluído com sucesso.", "ok");
            void loadDocuments();
        } catch (err) {
            setStatus(friendlyNetworkError(err), "error");
        }
    }

    async function openDocument(docId, btn) {
        const promptEl = $("#prompt-input");
        const hasCurrentText = promptEl && promptEl.value.trim() !== "";
        if (hasCurrentText && !window.confirm("Abrir este documento vai substituir o conteúdo atual da tela. Continuar?")) {
            return;
        }

        setBusy(btn, true, "Abrindo...");
        setStatus("Abrindo documento salvo...", "loading");

        try {
            const resp = await fetch(`${API_DOCUMENTS}/${encodeURIComponent(docId)}`);

            if (!resp.ok) {
                setStatus(`Não foi possível abrir o documento. ${await readErrorDetail(resp)}`, "error");
                return;
            }

            const doc = await resp.json();
            applyDocumentToForm(doc);

            const previewOk = await generatePreview();
            if (previewOk) {
                setStatus(
                    `Documento aberto: "${doc.title}". Links e arquivos enviados não são restaurados.`,
                    "ok"
                );
            }
        } catch (err) {
            setStatus(friendlyNetworkError(err), "error");
        } finally {
            setBusy(btn, false);
        }
    }

    function applyDocumentToForm(doc) {
        setValue("#prompt-input", doc.content || "");
        setValue("#links-input", "");

        document.querySelectorAll('input[name="norm"]').forEach((radio) => {
            radio.checked = radio.value === doc.norm;
        });

        setValue("#font-select", doc.font_family || "arial");
        setValue("#size-select", String(doc.font_size || 12));
        setValue("#margin-select", doc.margin_density || "normal");

        const cover = doc.cover || {};
        setValue("#cover-title", cover.title || "");
        setValue("#cover-subtitle", cover.subtitle || "");
        setValue("#cover-author", cover.author || "");
        setValue("#cover-institution", cover.institution || "");

        const coverDetails = $(".cover-details");
        if (coverDetails && (cover.title || cover.author)) {
            coverDetails.open = true;
        }

        setValue("#formula-input", doc.formula || "");

        state.uploadedFiles = [];
        renderFileList();

        applyTypographyAndMargins();
        applyImageOptions();
        applyCoverToSheet();
        applyFormulaToSheet();
    }

    /* ---------------------------------------------------------------------
       Exportação de PDF via servidor
       --------------------------------------------------------------------- */
    async function downloadPdfFromServer() {
        const btn = $("#pdf-btn");
        setBusy(btn, true, "Gerando PDF...");
        setStatus("Gerando PDF no servidor. Isso pode levar alguns segundos.", "loading");

        try {
            const resp = await fetch(API_EXPORT_PDF, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(collectPayload())
            });

            if (!resp.ok) {
                setStatus(`Não foi possível gerar o PDF. ${await readErrorDetail(resp)}`, "error");
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
            setStatus(friendlyNetworkError(err), "error");
        } finally {
            setBusy(btn, false);
        }
    }

    /* ---------------------------------------------------------------------
       Exportação para .doc (Word)
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

    async function downloadWord() {
        const sheet = $("#a4-sheet");
        const btn = $("#docx-btn");
        if (!sheet) return;

        setBusy(btn, true, "Gerando Word...");
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));

        try {
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
            setStatus("Arquivo Word (.doc) gerado. Abra no Word ou no LibreOffice.", "ok");
        } catch (err) {
            console.error("[ScriptaAI] Erro ao gerar .doc:", err);
            setStatus("Não foi possível gerar o arquivo Word. Tente novamente.", "error");
        } finally {
            setBusy(btn, false);
        }
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

        on("#save-doc-btn", "click", () => {
            void saveDocument();
        });

        on("#pdf-btn", "click", () => {
            void downloadPdfFromServer();
        });

        on("#docx-btn", "click", () => {
            void downloadWord();
        });

        on("#copy-btn", "click", () => {
            void copyText();
        });

        on("#new-doc-btn", "click", clearDocument);

        on("#refresh-docs-btn", "click", () => {
            void loadDocuments();
        });
    }

    function initPrivacyModal() {
        const link = $("#privacy-link");
        const modal = $("#privacy-modal");
        if (!link || !modal) return;

        link.addEventListener("click", (event) => {
            event.preventDefault();
            modal.showModal();
        });

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
        void loadDocuments();
    }

    document.addEventListener("DOMContentLoaded", init);
})();