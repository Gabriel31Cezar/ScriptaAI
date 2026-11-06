const THEME_KEY = 'scripta-theme';
const PREVIEW_DELAY_MS = 2000;
const root = document.documentElement;
const toggleButton = document.getElementById('theme-toggle');
const marginSelect = document.getElementById('margin-select');
const fontSelect = document.getElementById('font-select');
const sizeSelect = document.getElementById('size-select');
const sheet = document.getElementById('a4-sheet');
const imageSizeSelect = document.getElementById('image-size-select');
const imageLayoutSelect = document.getElementById('image-layout-select');
const mediaBox = document.getElementById('a4-media');
const formulaInput = document.getElementById('formula-input');
const formulaBox = document.getElementById('a4-formula');
const privacyLink = document.getElementById('privacy-link');
const privacyModal = document.getElementById('privacy-modal');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const generateBtn = document.getElementById('generate-btn');
const pdfBtn = document.getElementById('pdf-btn');
const copyBtn = document.getElementById('copy-btn');
const newDocBtn = document.getElementById('new-doc-btn');
const promptInput = document.getElementById('prompt-input');
const linksInput = document.getElementById('links-input');
const loadingBox = document.getElementById('a4-loading');
const previewStatus = document.getElementById('preview-status');

const FONT_FAMILIES = {
    arial: 'Arial, Helvetica, sans-serif',
    times: '"Times New Roman", Times, serif',
    roboto: 'Roboto, Arial, sans-serif',
    monospace: '"Courier New", Courier, monospace'
};

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.docx', '.mp3', '.mp4'];

const coverBox = document.getElementById('a4-cover');
const coverFields = [
    { input: document.getElementById('cover-title'), output: document.getElementById('out-title') },
    { input: document.getElementById('cover-subtitle'), output: document.getElementById('out-subtitle') },
    { input: document.getElementById('cover-author'), output: document.getElementById('out-author') },
    { input: document.getElementById('cover-institution'), output: document.getElementById('out-institution') }
];

function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    toggleButton.textContent = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
}

function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
        return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}

function applyMargin(value) {
    sheet.setAttribute('data-margin', value);
}

function applyFont(value) {
    sheet.style.fontFamily = FONT_FAMILIES[value];
}

function applySize(value) {
    sheet.style.fontSize = value + 'pt';
}

// Tamanho escolhido vale para imagem e fórmula
function applyImageSize(value) {
    mediaBox.setAttribute('data-size', value);
    formulaBox.setAttribute('data-size', value);
}

function applyImageLayout(value) {
    mediaBox.setAttribute('data-layout', value);
}

function updateFormula() {
    const value = formulaInput.value.trim();
    formulaBox.textContent = value;
    formulaBox.hidden = value === '';
}

function updateCover() {
    let hasAnyText = false;

    coverFields.forEach(({ input, output }) => {
        const value = input.value.trim();
        output.textContent = value;
        output.hidden = value === '';
        if (value !== '') {
            hasAnyText = true;
        }
    });

    coverBox.hidden = !hasAnyText;
}

function openPrivacyModal(event) {
    event.preventDefault();
    privacyModal.showModal();
}

function closeOnBackdropClick(event) {
    // Clique direto na própria caixa <dialog> (fora do conteúdo interno) fecha o modal
    if (event.target === privacyModal) {
        privacyModal.close();
    }
}

function formatSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isAcceptedFile(name) {
    const lower = name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function renderFileList(files) {
    fileList.textContent = '';

    if (files.length === 0) {
        fileList.hidden = true;
        return;
    }

    files.forEach(file => {
        const accepted = isAcceptedFile(file.name);

        const item = document.createElement('li');
        item.className = 'file-item' + (accepted ? '' : ' is-invalid');

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = file.name;

        const meta = document.createElement('span');
        meta.className = 'file-size';
        meta.textContent = accepted ? formatSize(file.size) : 'formato não aceito';

        item.append(name, meta);
        fileList.appendChild(item);
    });

    fileList.hidden = false;
}

function setDragHighlight(active) {
    uploadZone.classList.toggle('is-dragover', active);
}

function refreshSheet() {
    applyMargin(marginSelect.value);
    applyFont(fontSelect.value);
    applySize(sizeSelect.value);
    applyImageSize(imageSizeSelect.value);
    applyImageLayout(imageLayoutSelect.value);
    updateCover();
    updateFormula();
}

function formatTime(date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function generatePreview() {
    generateBtn.disabled = true;
    sheet.setAttribute('aria-busy', 'true');
    loadingBox.hidden = false;
    previewStatus.textContent = 'Gerando preview...';

    setTimeout(() => {
        refreshSheet();
        loadingBox.hidden = true;
        sheet.removeAttribute('aria-busy');
        generateBtn.disabled = false;
        previewStatus.textContent = 'Preview atualizado às ' + formatTime(new Date()) + '.';
    }, PREVIEW_DELAY_MS);
}

// Novo Documento: limpa campos de texto, arquivos, capa e fórmula. Mantém as escolhas de formatação.
function clearDocument() {
    promptInput.value = '';
    linksInput.value = '';

    coverFields.forEach(({ input }) => {
        input.value = '';
    });
    updateCover();

    formulaInput.value = '';
    updateFormula();

    fileInput.value = '';
    renderFileList([]);

    previewStatus.textContent = 'Novo documento iniciado.';
}

// Copiar Texto: usa a API moderna da área de transferência (funciona em localhost e HTTPS)
async function copyText() {
    const text = sheet.innerText.trim();

    if (text === '') {
        previewStatus.textContent = 'Não há texto para copiar.';
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        previewStatus.textContent = 'Texto copiado para a área de transferência.';
    } catch (error) {
        previewStatus.textContent = 'Não foi possível copiar o texto.';
    }
}

// Baixar PDF: abre a caixa de impressão do navegador, que mostra só a folha A4
function printSheet() {
    previewStatus.textContent = 'Abrindo caixa de impressão...';
    window.print();
}

applyTheme(getInitialTheme());
toggleButton.addEventListener('click', toggleTheme);

applyMargin(marginSelect.value);
marginSelect.addEventListener('change', () => applyMargin(marginSelect.value));

applyFont(fontSelect.value);
fontSelect.addEventListener('change', () => applyFont(fontSelect.value));

applySize(sizeSelect.value);
sizeSelect.addEventListener('change', () => applySize(sizeSelect.value));

coverFields.forEach(({ input }) => {
    input.addEventListener('input', updateCover);
});

updateCover();

applyImageSize(imageSizeSelect.value);
imageSizeSelect.addEventListener('change', () => applyImageSize(imageSizeSelect.value));

applyImageLayout(imageLayoutSelect.value);
imageLayoutSelect.addEventListener('change', () => applyImageLayout(imageLayoutSelect.value));

formulaInput.addEventListener('input', updateFormula);
updateFormula();

privacyLink.addEventListener('click', openPrivacyModal);
privacyModal.addEventListener('click', closeOnBackdropClick);

// Upload: seleção pelo clique
fileInput.addEventListener('change', () => {
    renderFileList(Array.from(fileInput.files));
});

// Upload: arrastar e soltar
['dragenter', 'dragover'].forEach(type => {
    uploadZone.addEventListener(type, event => {
        event.preventDefault();
        setDragHighlight(true);
    });
});

['dragleave', 'drop'].forEach(type => {
    uploadZone.addEventListener(type, event => {
        event.preventDefault();
        setDragHighlight(false);
    });
});

uploadZone.addEventListener('drop', event => {
    renderFileList(Array.from(event.dataTransfer.files));
});

// Impede que o navegador abra um arquivo solto fora da área de upload
['dragover', 'drop'].forEach(type => {
    window.addEventListener(type, event => event.preventDefault());
});

// Botão Gerar/Atualizar Preview
generateBtn.addEventListener('click', generatePreview);

// Botões Baixar PDF, Copiar Texto e Novo Documento
pdfBtn.addEventListener('click', printSheet);
copyBtn.addEventListener('click', copyText);
newDocBtn.addEventListener('click', clearDocument);

// Quando a caixa de impressão fecha (salvou ou cancelou), atualiza o status
window.addEventListener('afterprint', () => {
    previewStatus.textContent = 'Caixa de impressão fechada.';
});