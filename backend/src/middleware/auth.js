import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'ai-ecommerce-agent-super-secret-key-2024';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Role hierarchy: admin > manager > user
const roleHierarchy = {
  admin: 3,
  manager: 2,
  user: 1
};

// Middleware to check if user has required role
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role || 'user';

    // Check if user's role is in the allowed roles
    if (roles.includes(userRole)) {
      return next();
    }

    // Check role hierarchy - higher roles can access lower role routes
    const userLevel = roleHierarchy[userRole] || 0;
    const minRequiredLevel = Math.min(...roles.map(r => roleHierarchy[r] || 0));

    if (userLevel >= minRequiredLevel) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

// Middleware to check if user is admin
export const requireAdmin = requireRole('admin');

// Middleware to check if user is manager or above
export const requireManager = requireRole('admin', 'manager');
