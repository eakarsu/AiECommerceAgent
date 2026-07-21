import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required' });
  const user = await User.findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
  await user.update({ lastLogin: new Date() });
  const token = generateToken(user);
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get('/me', authenticateToken, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'email', 'name', 'role', 'avatar', 'lastLogin'] });
  if (!user) return res.status(401).json({ error: 'Identity is not active' });
  return res.json(user);
});

export default router;
