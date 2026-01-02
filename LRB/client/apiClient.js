(function () {
  const API_BASE = window.API_BASE_URL || 'http://localhost:4000/api';
  const AUTH_EVENT = 'api:unauthorized';
  let token = null;

  function setToken(next) {
    token = next;
    try {
      if (next) localStorage.setItem('apiToken', next);
      else localStorage.removeItem('apiToken');
    } catch (_) {}
  }

  // Load persisted token on init
  try {
    const saved = localStorage.getItem('apiToken');
    if (saved) token = saved;
  } catch (_) {}

(function attachAuthHelpers() {
  window.addEventListener(AUTH_EVENT, () => {
    // placeholder to ensure event exists even if nobody listens yet
  });
})();

  function notifyUnauthorized(message) {
    setToken(null);
    try {
      localStorage.removeItem('currentSubmission');
      localStorage.removeItem('currentClient');
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { message } }));
    } catch (_) {}
  }

  async function request(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      notifyUnauthorized(data.error || 'Session expired. Please log in again.');
      throw new Error(data.error || 'Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  const apiClient = {
    setToken,

    async signup({ email, password, orgCode }) {
      const res = await request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, orgCode })
      });
      if (res.token) setToken(res.token);
      return res;
    },

    async login({ email, password }) {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (res.token) setToken(res.token);
      return res;
    },

    async forgotPassword(email) {
      return request('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
    },

    async resetPassword(tokenValue, password) {
      return request('/auth/reset', { method: 'POST', body: JSON.stringify({ token: tokenValue, password }) });
    },

    async me() {
      return request('/me');
    },

    async createSubmission({ year, payload }) {
      return request('/submissions', { method: 'POST', body: JSON.stringify({ year, payload }) });
    },

    async updateSubmission({ submissionId, year, payload }) {
      if (!submissionId) throw new Error('submissionId is required for update');
      return request(`/submissions/${submissionId}`, { method: 'PUT', body: JSON.stringify({ year, payload }) });
    },

    async listSubmissions(year) {
      const q = year ? `?year=${encodeURIComponent(year)}` : '';
      return request(`/submissions${q}`);
    },

    async uploadFile({ submissionId, file }) {
      const form = new FormData();
      form.append('file', file);
      form.append('submissionId', submissionId);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    },

    async getMasterTaxRates() {
      return request('/tax-rates/master');
    },

    async getSubmissionTaxRates(submissionId) {
      return request(`/tax-rates/submission/${submissionId}`);
    },

    async importTaxRates({ file, submissionId, isMaster }) {
      const form = new FormData();
      form.append('file', file);
      if (submissionId) form.append('submissionId', submissionId);
      if (isMaster !== undefined) form.append('isMaster', isMaster);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/tax-rates/import`, { method: 'POST', headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Tax rate import failed');
      return data;
    },

    async scrapeTaxRates({ taxYear, county, agency, project, isMaster, submissionId }) {
      return request('/tax-rates/scrape', {
        method: 'POST',
        body: JSON.stringify({ taxYear, county, agency, project, isMaster, submissionId })
      });
    },

    async getTaxRateOptions() {
      return request('/tax-rates/options');
    },

    async scrapeAllTaxRates({ taxYear = 2025 }) {
      return request('/tax-rates/scrape-all', {
        method: 'POST',
        body: JSON.stringify({ taxYear })
      });
    }
  };

  window.apiClient = apiClient;
})();


