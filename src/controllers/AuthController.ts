import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';

interface LoginRequest {
  username: string;
  password: string;
}

interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

export class AuthController {
  private router: Router;
  private users: Map<string, User> = new Map();
  private jwtSecret: string;

  constructor() {
    this.router = Router();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
    this.setupRoutes();
    this.initializeDefaultUser();
  }

  private async initializeDefaultUser(): Promise<void> {
    // Create default admin user
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    
    this.users.set('admin', {
      id: 'admin',
      username: 'admin',
      passwordHash,
      role: 'admin'
    });

    logger.info('Default admin user initialized');
  }

  private setupRoutes(): void {
    this.router.post('/login', this.login.bind(this));
    this.router.post('/logout', this.logout.bind(this));
    this.router.get('/verify', this.verifyToken.bind(this));
    this.router.post('/change-password', this.authenticateToken.bind(this), this.changePassword.bind(this));
  }

  private async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password }: LoginRequest = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
      }

      const user = this.users.get(username);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      logger.info(`User ${username} logged in successfully`);
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private logout(req: Request, res: Response): void {
    // In a real implementation, you might maintain a token blacklist
    res.json({ message: 'Logged out successfully' });
  }

  private verifyToken(req: Request, res: Response): void {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      res.json({ valid: true, user: decoded });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  private authenticateToken(req: Request, res: Response, next: any): void {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      (req as any).user = decoded;
      next();
    } catch (error) {
      res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  private async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = (req as any).user;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current and new password required' });
        return;
      }

      const userData = this.users.get(user.username);
      if (!userData) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const isValidPassword = await bcrypt.compare(currentPassword, userData.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      userData.passwordHash = newPasswordHash;
      this.users.set(user.username, userData);

      logger.info(`Password changed for user ${user.username}`);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
