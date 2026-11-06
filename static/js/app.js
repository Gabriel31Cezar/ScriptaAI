const THEME_KEY = 'scripta-theme';
const root = document.documentElement;
const toggleButton = document.getElementById('theme-toggle');
const marginSelect = document.getElementById('margin-select');
const fontSelect = document.getElementById('font-select');
const sizeSelect = document.getElementById('size-select');
const sheet = document.getElementById('a4-sheet');

const FONT_FAMILIES = {
    arial: 'Arial, Helvetica, sans-serif',
    times: '"Times New Roman", Times, serif',
    roboto: 'Roboto, Arial, sans-serif',
    monospace: '"Courier New", Courier, monospace'
};

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