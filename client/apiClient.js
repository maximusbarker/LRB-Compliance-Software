(function () {
  const API_BASE = window.API_BASE_URL || 'http://localhost:4000/api';
  const AUTH_EVENT = 'api:unauthorized';
  let token = null;
  let apiDownUntil = 0; // timestamp ms; when > Date.now(), we short-circuit requests

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
    // Circuit breaker: if server was unreachable recently, don't spam requests.
    if (apiDownUntil && Date.now() < apiDownUntil) {
      throw new Error('Cannot connect to server. Please start the backend and try again.');
    }

    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (err) {
      // Network error (e.g., ERR_CONNECTION_REFUSED): back off for 30s.
      apiDownUntil = Date.now() + 30_000;
      throw new Error('Cannot connect to server. Make sure it is running on localhost:4000.');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      // Only notify unauthorized if we had a token (means session expired)
      // If no token, it's expected and we shouldn't trigger the unauthorized handler
      if (token) {
        notifyUnauthorized(data.error || 'Session expired. Please log in again.');
      }
      throw new Error(data.error || 'Unauthorized');
    }
    if (res.status === 429) {
      // Rate limiting - return the error message from server
      throw new Error(data.error || 'Too many requests. Please try again later.');
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  const apiClient = {
    setToken,
    isApiAvailable() {
      return !apiDownUntil || Date.now() >= apiDownUntil;
    },

    async signup({ email, password, county, agency }) {
      const res = await request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, county, agency })
      });
      if (res.token) setToken(res.token);
      return res;
    },

    async getCounties() {
      return await request('/auth/counties', { method: 'GET' });
    },

    async getAgencies(county) {
      return await request(`/auth/agencies/${encodeURIComponent(county)}`, { method: 'GET' });
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

    async createSubmission({ year, payload, status }) {
      return request('/submissions', { method: 'POST', body: JSON.stringify({ year, payload, status }) });
    },

    async updateSubmission({ submissionId, year, payload }) {
      if (!submissionId) throw new Error('submissionId is required for update');
      return request(`/submissions/${submissionId}`, { method: 'PUT', body: JSON.stringify({ year, payload }) });
    },

    async listSubmissions(year) {
      const q = year ? `?year=${encodeURIComponent(year)}` : '';
      return request(`/submissions${q}`);
    },

    async deleteSubmission(submissionId) {
      if (!submissionId) throw new Error('submissionId is required for deletion');
      return request(`/submissions/${submissionId}`, { method: 'DELETE' });
    },

    async finalizeSubmission({ submissionId, attestationName }) {
      if (!submissionId) throw new Error('submissionId is required for final submit');
      return request(`/submissions/${submissionId}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ attestationName })
      });
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

    async listUploads(submissionId) {
      if (!submissionId) throw new Error('submissionId is required');
      return request(`/uploads/submission/${encodeURIComponent(submissionId)}`, { method: 'GET' });
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


