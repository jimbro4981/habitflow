const routes = new Map();
let currentRoute = null;

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

export function getCurrentRoute() {
  return currentRoute;
}

export function initRouter() {
  const handleRoute = () => {
    const hash = window.location.hash.slice(1) || '/';
    currentRoute = hash;
    const renderFn = routes.get(hash);
    const content = document.getElementById('page-content');
    if (renderFn && content) {
      content.innerHTML = '';
      content.style.animation = 'none';
      content.offsetHeight; // trigger reflow
      content.style.animation = 'fadeIn 0.3s ease';
      renderFn(content);
    }
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === hash);
    });
    // Show/hide FAB (only on Today page)
    const fab = document.getElementById('fab-add');
    if (fab) fab.style.display = hash === '/' ? 'flex' : 'none';
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
