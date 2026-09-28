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
  const initialConnectTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(false);
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
    if (!token || !user || !shouldReconnectRef.current) return;

    if (wsRef.current && (
      wsRef.current.readyState === WebSocket.OPEN ||
      wsRef.current.readyState === WebSocket.CONNECTING
    )) return;

    const configuredBase = String(import.meta.env.VITE_WEBSOCKET_URL || '').trim().replace(/\/$/, '');
    const sameOriginBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const backendPort = String(import.meta.env.VITE_BACKEND_PORT || '').trim();
    const developmentBase = import.meta.env.DEV && backendPort
      ? `ws://${window.location.hostname}:${backendPort}`
      : '';
    const wsUrl = `${configuredBase || developmentBase || sameOriginBase}/ws?userId=${encodeURIComponent(user.id)}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (wsRef.current !== socket) return;
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return;
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

      socket.onclose = () => {
        if (wsRef.current !== socket) return;
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds
        if (shouldReconnectRef.current) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 5000);
        }
      };

      socket.onerror = (error) => {
        if (wsRef.current !== socket) return;
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to connect WebSocket:', e);
    }
  }, [token, user, showToast]);

  // Initialize
  useEffect(() => {
    if (token && user) {
      shouldReconnectRef.current = true;
      fetchNotifications();
      fetchUnreadCount();
      // Defer the initial socket until React's development-only StrictMode
      // mount/cleanup probe has completed. This avoids a short-lived
      // connection during the initial development render.
      initialConnectTimeoutRef.current = setTimeout(() => {
        initialConnectTimeoutRef.current = null;
        connectWebSocket();
      }, 25);
    }

    return () => {
      shouldReconnectRef.current = false;
      if (initialConnectTimeoutRef.current) {
        clearTimeout(initialConnectTimeoutRef.current);
        initialConnectTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = () => {};
        if (socket.readyState === WebSocket.CONNECTING) {
          // Calling close() while CONNECTING produces a browser console error.
          // Allow the handshake to finish, then close the superseded socket.
          socket.onopen = () => socket.close(1000, 'Connection superseded');
        } else if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Notification provider cleanup');
        }
      }
      setIsConnected(false);
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
