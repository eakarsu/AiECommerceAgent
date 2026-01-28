import { useState } from 'react';
import { useApi } from '../hooks/useApi';

export const Reports = () => {
  const [exportFilters, setExportFilters] = useState({
    orders: { startDate: '', endDate: '', status: '' },
    products: { category: '', status: '' },
    customers: { segment: '', status: '' },
    alerts: { status: '', type: '' }
  });
  const [exporting, setExporting] = useState({});
  const { loading } = useApi();

  const handleExport = async (type) => {
    setExporting(prev => ({ ...prev, [type]: true }));
    try {
      const filters = exportFilters[type];
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/export/${type}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Export failed');
    } finally {
      setExporting(prev => ({ ...prev, [type]: false }));
    }
  };

  const reportCards = [
    {
      type: 'orders',
      title: 'Orders Report',
      description: 'Export all orders with customer info, status, and totals',
      icon: '📦',
      color: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
      filters: [
        {
          key: 'startDate',
          label: 'From Date',
          type: 'date'
        },
        {
          key: 'endDate',
          label: 'To Date',
          type: 'date'
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: ['', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']
        }
      ]
    },
    {
      type: 'products',
      title: 'Products Report',
      description: 'Export product catalog with pricing and inventory',
      icon: '🏷️',
      color: 'bg-green-50 border-green-200',
      iconBg: 'bg-green-100',
      filters: [
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          options: ['', 'Electronics', 'Clothing', 'Home', 'Sports', 'Beauty']
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: ['', 'active', 'inactive', 'discontinued']
        }
      ]
    },
    {
      type: 'customers',
      title: 'Customers Report',
      description: 'Export customer data with segments and lifetime value',
      icon: '👥',
      color: 'bg-purple-50 border-purple-200',
      iconBg: 'bg-purple-100',
      filters: [
        {
          key: 'segment',
          label: 'Segment',
          type: 'select',
          options: ['', 'new', 'regular', 'vip', 'at_risk', 'churned']
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: ['', 'active', 'inactive']
        }
      ]
    },
    {
      type: 'inventory-alerts',
      title: 'Inventory Alerts Report',
      description: 'Export stock alerts with product details and status',
      icon: '⚠️',
      color: 'bg-yellow-50 border-yellow-200',
      iconBg: 'bg-yellow-100',
      filters: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: ['', 'active', 'acknowledged', 'resolved']
        },
        {
          key: 'type',
          label: 'Alert Type',
          type: 'select',
          options: ['', 'low_stock', 'out_of_stock', 'overstock', 'reorder_needed']
        }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1>
        <p className="text-gray-500">Generate and download CSV reports for your data</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {reportCards.map(card => (
          <div key={card.type} className={`${card.color} border rounded-lg p-6`}>
            <div className="flex items-start gap-4">
              <div className={`${card.iconBg} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {card.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{card.description}</p>

                <div className="space-y-3">
                  {card.filters.map(filter => (
                    <div key={filter.key} className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 w-24">{filter.label}:</label>
                      {filter.type === 'date' ? (
                        <input
                          type="date"
                          value={exportFilters[card.type === 'inventory-alerts' ? 'alerts' : card.type][filter.key]}
                          onChange={(e) => setExportFilters(prev => ({
                            ...prev,
                            [card.type === 'inventory-alerts' ? 'alerts' : card.type]: {
                              ...prev[card.type === 'inventory-alerts' ? 'alerts' : card.type],
                              [filter.key]: e.target.value
                            }
                          }))}
                          className="input flex-1"
                        />
                      ) : (
                        <select
                          value={exportFilters[card.type === 'inventory-alerts' ? 'alerts' : card.type][filter.key]}
                          onChange={(e) => setExportFilters(prev => ({
                            ...prev,
                            [card.type === 'inventory-alerts' ? 'alerts' : card.type]: {
                              ...prev[card.type === 'inventory-alerts' ? 'alerts' : card.type],
                              [filter.key]: e.target.value
                            }
                          }))}
                          className="input flex-1"
                        >
                          {filter.options.map(opt => (
                            <option key={opt} value={opt}>
                              {opt || 'All'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleExport(card.type)}
                  disabled={exporting[card.type]}
                  className="btn btn-primary mt-4 w-full"
                >
                  {exporting[card.type] ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span> Exporting...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      📥 Download CSV
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats Info */}
      <div className="bg-gray-50 rounded-lg p-6 border">
        <h3 className="text-lg font-semibold mb-3">Export Tips</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            CSV files can be opened in Excel, Google Sheets, or any spreadsheet application
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Use filters to narrow down the data before exporting
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Large exports may include thousands of rows - apply date filters for better performance
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            All timestamps are in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
          </li>
        </ul>
      </div>
    </div>
  );
};
