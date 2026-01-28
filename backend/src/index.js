import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import routes from './routes/index.js';
import { sequelize } from './models/index.js';
import searchService from './services/search.js';
import recommendationEngine from './services/recommendations.js';
import websocketService from './services/websocket.js';
import uploadService from './services/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(uploadService.uploadDir));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
websocketService.initialize(server);

// Make websocket available to routes
app.set('websocket', websocketService);

// Start server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');

    // Initialize search index
    await searchService.ensureSearchIndex();

    // Start recommendation scheduler
    recommendationEngine.scheduleRecalculation();

    server.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
      console.log(`API endpoints available at http://localhost:${PORT}/api`);
      console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
