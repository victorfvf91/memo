import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions for content
export const contentApi = {
  save: (data: { url: string; title?: string }) =>
    api.post('/content/save', data),
  
  checkJobStatus: (jobId: string) =>
    api.get(`/content/job/${jobId}`),
  
  getAll: (params?: { page?: number; limit?: number; cluster_id?: string; search?: string }) =>
    api.get('/content', { params }),
  
  getById: (id: string) =>
    api.get(`/content/${id}`),
  
  update: (id: string, data: { title?: string; cluster_id?: string }) =>
    api.put(`/content/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/content/${id}`),
  
  process: (id: string) =>
    api.post(`/content/${id}/process`),
};

// API functions for clusters
export const clusterApi = {
  getAll: () =>
    api.get('/clusters'),
  
  create: (data: { name: string; description?: string; contentIds?: string[] }) =>
    api.post('/clusters', data),
  
  getById: (id: string, viewMode?: string) =>
    api.get(`/clusters/${id}`, { params: { viewMode } }),
  
  generateSummary: (id: string) =>
    api.post(`/clusters/${id}/summary`),
  
  addContent: (id: string, data: { contentId: string; isPrimary?: boolean }) =>
    api.post(`/clusters/${id}/content`, data),
  
  removeContent: (id: string, contentId: string) =>
    api.delete(`/clusters/${id}/content/${contentId}`),
  
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/clusters/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/clusters/${id}`),
  
  getSuggestions: (contentId: string) =>
    api.get(`/clusters/suggestions/${contentId}`),
};

// API functions for users
export const userApi = {
  getProfile: () =>
    api.get('/users/profile'),
  
  updateProfile: (data: { name?: string; email?: string }) =>
    api.put('/users/profile', data),
  
  getDashboard: () =>
    api.get('/users/dashboard'),
  
  getActivity: (params?: { page?: number; limit?: number }) =>
    api.get('/users/activity', { params }),
};

// API functions for auth
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  
  getMe: () =>
    api.get('/auth/me'),
}; 