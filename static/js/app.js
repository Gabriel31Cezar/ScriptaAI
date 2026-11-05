const THEME_KEY = 'scripta-theme';
const root = document.documentElement;
const toggleButton = document.getElementById('theme-toggle');

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

applyTheme(getInitialTheme());
toggleButton.addEventListener('click', toggleTheme);