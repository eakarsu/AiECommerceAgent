import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';

export const usePaginatedApi = (baseUrl, { initialFilters = {}, defaultLimit = 10, defaultSortBy = 'createdAt', defaultSortOrder = 'DESC' } = {}) => {
  const [page, setPage] = useState(1);
  const [limit] = useState(defaultLimit);
  const [filters, setFilters] = useState(initialFilters);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const { get, loading } = useApi();
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', limit);
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        params.set(key, value);
      }
    });

    try {
      const result = await get(`${baseUrl}?${params.toString()}`);
      if (!mountedRef.current) return;

      // Handle both paginated and legacy array responses
      if (result && result.data && typeof result.total === 'number') {
        setData(result.data);
        setTotal(result.total);
      } else if (Array.isArray(result)) {
        setData(result);
        setTotal(result.length);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }, [baseUrl, page, limit, sortBy, sortOrder, filters, get]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setPage(1);
  }, [initialFilters]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    setPage,
    filters,
    handleFilterChange,
    clearFilters,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    loading,
    totalPages,
    limit,
    reload: fetchData
  };
};
