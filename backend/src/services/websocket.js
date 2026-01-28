import { WebSocketServer } from 'ws';

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of ws connections
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');

      // Parse userId from query string
      const url = new URL(req.url, 'http://localhost');
      const userId = url.searchParams.get('userId');

      if (userId) {
        if (!this.clients.has(userId)) {
          this.clients.set(userId, new Set());
        }
        this.clients.get(userId).add(ws);
        ws.userId = userId;
      }

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to notification server',
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (e) {
          console.error('Invalid WebSocket message:', e);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        if (ws.userId && this.clients.has(ws.userId)) {
          this.clients.get(ws.userId).delete(ws);
          if (this.clients.get(ws.userId).size === 0) {
            this.clients.delete(ws.userId);
          }
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log('WebSocket server initialized');
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      case 'subscribe':
        // Client can subscribe to specific channels
        if (data.channel) {
          ws.channels = ws.channels || new Set();
          ws.channels.add(data.channel);
        }
        break;
      case 'unsubscribe':
        if (data.channel && ws.channels) {
          ws.channels.delete(data.channel);
        }
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Send notification to all connected clients
  broadcast(notification) {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'notification',
      ...notification,
      timestamp: new Date().toISOString()
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  // Send notification to specific user
  sendToUser(userId, notification) {
    if (!this.clients.has(userId.toString())) return;

    const message = JSON.stringify({
      type: 'notification',
      ...notification,
      timestamp: new Date().toISOString()
    });

    this.clients.get(userId.toString()).forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  // Send notification to a specific channel
  broadcastToChannel(channel, notification) {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'notification',
      channel,
      ...notification,
      timestamp: new Date().toISOString()
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.channels?.has(channel)) {
        client.send(message);
      }
    });
  }

  // Notification helpers
  notifyNewOrder(order) {
    this.broadcast({
      category: 'order',
      title: 'New Order',
      message: `Order ${order.orderId} received - $${order.total}`,
      data: { orderId: order.id, orderNumber: order.orderId }
    });
  }

  notifyOrderStatusChange(order) {
    this.broadcast({
      category: 'order',
      title: 'Order Updated',
      message: `Order ${order.orderId} status changed to ${order.status}`,
      data: { orderId: order.id, status: order.status }
    });
  }

  notifyLowStock(alert) {
    this.broadcast({
      category: 'inventory',
      title: 'Low Stock Alert',
      message: alert.message,
      severity: 'warning',
      data: { alertId: alert.id, productId: alert.productId }
    });
  }

  notifyOutOfStock(alert) {
    this.broadcast({
      category: 'inventory',
      title: 'Out of Stock',
      message: alert.message,
      severity: 'critical',
      data: { alertId: alert.id, productId: alert.productId }
    });
  }

  notifyNewReview(review) {
    this.broadcast({
      category: 'review',
      title: 'New Review',
      message: `New ${review.rating}-star review for ${review.productName || 'a product'}`,
      data: { reviewId: review.id, rating: review.rating }
    });
  }

  notifyPaymentReceived(order) {
    this.broadcast({
      category: 'payment',
      title: 'Payment Received',
      message: `Payment of $${order.total} received for order ${order.orderId}`,
      data: { orderId: order.id }
    });
  }

  getConnectedClients() {
    return this.wss ? this.wss.clients.size : 0;
  }
}

export default new WebSocketService();
