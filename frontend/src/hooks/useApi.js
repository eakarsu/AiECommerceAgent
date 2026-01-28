import { useState, useCallback } from 'react';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const request = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      };

      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback((url) => request(url), [request]);

  const post = useCallback((url, data) => request(url, {
    method: 'POST',
    body: JSON.stringify(data)
  }), [request]);

  const put = useCallback((url, data) => request(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  }), [request]);

  const del = useCallback((url) => request(url, {
    method: 'DELETE'
  }), [request]);

  return { loading, error, get, post, put, del };
};
