(function () {
  const STORAGE_KEY = 'tq-theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    const buttons = [
      document.getElementById('theme-toggle-mobile'),
      document.getElementById('theme-toggle-desktop'),
      document.getElementById('theme-toggle-admin')
    ];

    buttons.forEach(btn => {
      if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    });
  }

  applyTheme(getPreferredTheme());

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getPreferredTheme());

    const buttons = [
      document.getElementById('theme-toggle-mobile'),
      document.getElementById('theme-toggle-desktop'),
      document.getElementById('theme-toggle-admin')
    ];

    buttons.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          const current =
            document.documentElement.getAttribute('data-theme') === 'dark'
              ? 'dark'
              : 'light';

          const next = current === 'dark' ? 'light' : 'dark';

          localStorage.setItem(STORAGE_KEY, next);
          applyTheme(next);
        });
      }
    });
  });
})();
