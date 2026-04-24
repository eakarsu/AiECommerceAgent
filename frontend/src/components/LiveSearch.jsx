import { useState, useRef, useCallback } from 'react';

export const LiveSearch = ({ data, onFilter, searchFields, placeholder, onServerSearch }) => {
  const [query, setQuery] = useState('');
  const debounceRef = useRef(null);

  const filterData = useCallback((searchQuery, sourceData) => {
    if (!searchQuery.trim()) {
      return sourceData;
    }

    const searchLower = searchQuery.toLowerCase();
    return sourceData.filter(item => {
      return searchFields.some(field => {
        // Handle nested fields like 'Product.name'
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        if (!value) return false;
        return String(value).toLowerCase().includes(searchLower);
      });
    });
  }, [searchFields]);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the filter operation
    debounceRef.current = setTimeout(() => {
      if (onServerSearch) {
        onServerSearch(value);
      } else {
        const filtered = filterData(value, data);
        onFilter(filtered);
      }
    }, 150);
  };

  const handleClear = () => {
    setQuery('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (onServerSearch) {
      onServerSearch('');
    } else {
      onFilter(data);
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input
        type="text"
        className="input w-full"
        style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
        placeholder={placeholder || 'Search...'}
        value={query}
        onChange={handleChange}
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
