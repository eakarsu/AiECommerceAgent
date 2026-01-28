import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'success': return 'text-green-600 bg-green-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'order': return '🛒';
      case 'inventory': return '📦';
      case 'payment': return '💳';
      case 'review': return '⭐';
      default: return '🔔';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notification) => {
    // Mark as read if unread
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Show notification details
    setSelectedNotification(notification);
    setIsOpen(false);
  };

  const closeDetailModal = () => {
    setSelectedNotification(null);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-2xl"
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <p className="text-xs text-gray-500">
                  {isConnected ? (
                    <span className="text-green-600">Live updates enabled</span>
                  ) : (
                    <span className="text-gray-400">Connecting...</span>
                  )}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">🔔</div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getSeverityColor(notification.severity)}`}>
                        {getCategoryIcon(notification.category)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="bg-gray-50 px-4 py-2 border-t">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/notifications');
                  }}
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b ${
              selectedNotification.severity === 'critical' ? 'bg-red-50' :
              selectedNotification.severity === 'warning' ? 'bg-yellow-50' :
              selectedNotification.severity === 'success' ? 'bg-green-50' :
              'bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getCategoryIcon(selectedNotification.category)}</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedNotification.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        selectedNotification.severity === 'critical' ? 'bg-red-200 text-red-800' :
                        selectedNotification.severity === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                        selectedNotification.severity === 'success' ? 'bg-green-200 text-green-800' :
                        'bg-blue-200 text-blue-800'
                      }`}>
                        {selectedNotification.severity?.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
                        {selectedNotification.category?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Message */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Message</h3>
                <p className="text-gray-800">{selectedNotification.message}</p>
              </div>

              {/* Technical Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Technical Details</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Notification ID:</span>
                    <p className="font-mono text-gray-800">{selectedNotification.id}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className={`font-medium ${selectedNotification.read ? 'text-gray-600' : 'text-blue-600'}`}>
                      {selectedNotification.read ? 'Read' : 'Unread'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Created At:</span>
                    <p className="text-gray-800">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedNotification.readAt && (
                    <div>
                      <span className="text-gray-500">Read At:</span>
                      <p className="text-gray-800">{new Date(selectedNotification.readAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Additional Data */}
                {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Additional Data</h4>
                    <div className="bg-white rounded border p-3 font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(selectedNotification.data, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                onClick={closeDetailModal}
                className="btn btn-secondary"
              >
                Close
              </button>
              {selectedNotification.category === 'order' && selectedNotification.data?.orderId && (
                <button
                  onClick={() => {
                    closeDetailModal();
                    navigate('/orders');
                  }}
                  className="btn btn-primary"
                >
                  View Order
                </button>
              )}
              {selectedNotification.category === 'inventory' && (
                <button
                  onClick={() => {
                    closeDetailModal();
                    navigate('/inventory');
                  }}
                  className="btn btn-primary"
                >
                  View Inventory
                </button>
              )}
              {selectedNotification.category === 'review' && (
                <button
                  onClick={() => {
                    closeDetailModal();
                    navigate('/reviews');
                  }}
                  className="btn btn-primary"
                >
                  View Reviews
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Toast Container Component
export const ToastContainer = () => {
  const { toasts, removeToast } = useNotifications();

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      case 'success': return 'bg-green-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${getSeverityStyles(toast.severity)}`}
        >
          <div className="flex-1">
            <p className="font-medium">{toast.title}</p>
            <p className="text-sm opacity-90">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
