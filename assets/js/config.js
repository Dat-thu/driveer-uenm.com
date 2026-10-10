(function () {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('api');
  window.APP_CONFIG = {
    API_BASE: String(fromQuery || 'https://driver-uenm.cfd').replace(/\/$/, ''),
    APP_DOWNLOAD_URL: '',
  };
})();
