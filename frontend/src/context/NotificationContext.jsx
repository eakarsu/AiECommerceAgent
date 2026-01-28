import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  // Return default values if context is not available
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      isConnected: false,
      toasts: [],
      fetchNotifications: () => {},
      fetchUnreadCount: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      showToast: () => {},
      removeToast: () => {}
    };
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const { token, user } = useAuth();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  }, [token]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (e) {
      console.error('Failed to fetch unread count:', e);
    }
  }, [token]);

  // Mark notification as read
  const markAsRead = async (id) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n =>
          n.id === id ? { ...n, read: true, readAt: new Date() } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date() })));
        setUnreadCount(0);
      }
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  // Show toast notification
  const showToast = useCallback((notification) => {
    const id = Date.now();
    const toast = { id, ...notification };
    setToasts(prev => [...prev, toast]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // Remove toast
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!token || !user) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001/ws?userId=${user.id}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            // Add to notifications list
            const newNotification = {
              id: data.data?.notificationId || Date.now(),
              category: data.category,
              title: data.title,
              message: data.message,
              severity: data.severity || 'info',
              data: data.data,
              read: false,
              createdAt: data.timestamp
            };

            setNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
            setUnreadCount(prev => prev + 1);

            // Show toast
            showToast(newNotification);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to connect WebSocket:', e);
    }
  }, [token, user, showToast]);

  // Initialize
  useEffect(() => {
    if (token && user) {
      fetchNotifications();
      fetchUnreadCount();
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token, user, fetchNotifications, fetchUnreadCount, connectWebSocket]);

  const value = {
    notifications,
    unreadCount,
    isConnected,
    toasts,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    showToast,
    removeToast
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
