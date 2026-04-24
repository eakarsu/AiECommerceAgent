import { useState } from 'react';

export const AdvancedSearch = ({ filters, values, onChange, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600"
      >
        <span>🔍 Filters</span>
        {activeCount > 0 && (
          <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">{activeCount}</span>
        )}
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
          <div className="flex flex-wrap gap-3">
            {filters.map(filter => (
              <div key={filter.key} className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">{filter.label}</label>
                {filter.type === 'select' && (
                  <select
                    value={values[filter.key] || ''}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">All</option>
                    {filter.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {filter.type === 'date' && (
                  <input
                    type="date"
                    value={values[filter.key] || ''}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="input text-sm"
                  />
                )}
                {filter.type === 'number' && (
                  <input
                    type="number"
                    placeholder={filter.placeholder || ''}
                    value={values[filter.key] || ''}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="input text-sm"
                  />
                )}
                {filter.type === 'text' && (
                  <input
                    type="text"
                    placeholder={filter.placeholder || `Search ${filter.label.toLowerCase()}...`}
                    value={values[filter.key] || ''}
                    onChange={(e) => onChange(filter.key, e.target.value)}
                    className="input text-sm"
                  />
                )}
              </div>
            ))}
          </div>
          {activeCount > 0 && (
            <button onClick={onClear} className="text-sm text-red-600 hover:text-red-800">
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};
