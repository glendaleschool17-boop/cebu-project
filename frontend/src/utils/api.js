import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

// Session expired handler — redirects to login with a message flag
const handleSessionExpired = async () => {
  try { await signOut(auth); } catch {}
  // Store flag for Login page to display
  sessionStorage.setItem('sessionExpired', '1');
  window.location.href = '/login';
};

const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) return { 'Content-Type': 'application/json' };
  try {
    // forceRefresh=false uses cached token; if expired Firebase will refresh automatically
    // If the user is genuinely signed out / token irrecoverable, getIdToken will throw
    const token = await user.getIdToken(false);
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  } catch {
    await handleSessionExpired();
    return {};
  }
};

const getAuthHeadersMultipart = async () => {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken(false);
    return { Authorization: `Bearer ${token}` };
  } catch {
    await handleSessionExpired();
    return {};
  }
};

const handleResponse = async (res) => {
  if (res.status === 401) {
    await handleSessionExpired();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
};

export const api = {
  get: async (path) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, { headers });
    return handleResponse(res);
  },

  post: async (path, body) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  put: async (path, body) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  uploadFile: async (path, formData) => {
    const headers = await getAuthHeadersMultipart();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(res);
  },

  delete: async (path) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers,
    });
    return handleResponse(res);
  },
};
