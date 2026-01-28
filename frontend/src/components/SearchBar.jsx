import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';

export const SearchBar = ({ onSearchResults }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const { get } = useApi();
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (q) => {
    if (q.length < 2) {
      setSuggestions([]);
      onSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      // Fetch both suggestions and search results
      const [suggestData, searchData] = await Promise.all([
        get(`/api/products/search/suggest?q=${encodeURIComponent(q)}`),
        get(`/api/products/search?q=${encodeURIComponent(q)}`)
      ]);

      setSuggestions(suggestData || []);
      setShowSuggestions(suggestData && suggestData.length > 0);
      onSearchResults(searchData);
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      onSearchResults(null);
      setSuggestions([]);
      return;
    }

    // Debounce search - performs search as user types
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) {
      onSearchResults(null);
      return;
    }

    setSearching(true);
    setShowSuggestions(false);
    try {
      const data = await get(`/api/products/search?q=${encodeURIComponent(q)}`);
      onSearchResults(data);
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
    handleSearch(suggestion.name);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onSearchResults(null);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            className="input w-full"
            style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
            placeholder="Search products by name, category, or description..."
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          />
          {query && (
            <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={searching}
          className="btn btn-primary"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
              onClick={() => handleSuggestionClick(s)}
            >
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-xs text-gray-400">{s.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
