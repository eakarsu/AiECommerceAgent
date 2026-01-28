import { useState, useMemo } from 'react';

export const VariantSelector = ({ variants, basePrice, onSelect }) => {
  const [selectedOptions, setSelectedOptions] = useState({});

  const optionTypes = useMemo(() => {
    const types = {};
    for (const variant of variants) {
      if (variant.options && variant.status === 'active') {
        for (const [key, value] of Object.entries(variant.options)) {
          if (value) {
            if (!types[key]) types[key] = new Set();
            types[key].add(value);
          }
        }
      }
    }
    return Object.fromEntries(
      Object.entries(types).map(([k, v]) => [k, [...v]])
    );
  }, [variants]);

  const matchedVariant = useMemo(() => {
    if (Object.keys(selectedOptions).length === 0) return null;
    return variants.find(v => {
      if (v.status !== 'active') return false;
      return Object.entries(selectedOptions).every(
        ([key, value]) => v.options?.[key] === value
      );
    });
  }, [variants, selectedOptions]);

  const handleSelect = (optionType, value) => {
    const newOptions = { ...selectedOptions, [optionType]: value };
    setSelectedOptions(newOptions);

    const matched = variants.find(v => {
      if (v.status !== 'active') return false;
      return Object.entries(newOptions).every(
        ([key, val]) => v.options?.[key] === val
      );
    });

    if (onSelect) onSelect(matched);
  };

  const displayPrice = matchedVariant?.priceOverride
    ? parseFloat(matchedVariant.priceOverride)
    : parseFloat(basePrice);

  return (
    <div className="space-y-4">
      {Object.entries(optionTypes).map(([type, values]) => (
        <div key={type}>
          <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
            {type}
          </label>
          <div className="flex flex-wrap gap-2">
            {values.map(value => (
              <button
                key={value}
                onClick={() => handleSelect(type, value)}
                className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                  selectedOptions[type] === value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ))}

      {matchedVariant && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <span className="font-medium">{matchedVariant.name}</span>
            {' - '}${displayPrice.toFixed(2)}
            {matchedVariant.quantity > 0
              ? ` (${matchedVariant.quantity} in stock)`
              : ' (Out of stock)'}
          </p>
        </div>
      )}
    </div>
  );
};
