(() => {
  'use strict';
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('siteMenu');
  const backdrop = document.getElementById('menuBackdrop');
  const close = document.getElementById('menuClose');
  if (!toggle || !menu || !backdrop || !close) return;
  let previousFocus = null;
  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (open) { previousFocus = document.activeElement; close.focus(); }
    else if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('[data-menu-close]').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false); });
  const themeButton = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('vinn503_theme', theme); } catch (_) {}
    if (themeLabel) themeLabel.textContent = theme === 'light' ? 'Aktifkan tema gelap' : 'Aktifkan tema terang';
    if (themeButton) themeButton.setAttribute('aria-pressed', String(theme === 'light'));
  };
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('vinn503_theme') === 'light' ? 'light' : 'dark'; } catch (_) {}
  applyTheme(savedTheme);
  themeButton?.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
})();
