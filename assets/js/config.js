(function () {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('api');
  window.APP_CONFIG = {
    API_BASE: String(fromQuery || 'http://localhost:3000').replace(/\/$/, ''),
    APP_DOWNLOAD_URL: '',
  };
})();
