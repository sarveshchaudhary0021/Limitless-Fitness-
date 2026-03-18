(function() {
  const savedTheme = localStorage.getItem('limitless_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();
