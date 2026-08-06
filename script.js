// ─── TEMA CLARO / OSCURO ───
function applyTheme(theme){
  const isLight = theme === 'light';
  document.body.setAttribute('data-theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle');
  if(btn){
    btn.textContent = isLight ? '☀️ Claro' : '🌙 Oscuro';
    btn.setAttribute('aria-pressed', String(isLight));
  }
  localStorage.setItem('sim-os-theme', theme);
}
function toggleTheme(){
  const next = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(next);
}
applyTheme(localStorage.getItem('sim-os-theme') || 'dark');

window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
