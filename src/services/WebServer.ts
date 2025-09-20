import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/utils/logger';
import { ServerConfig } from '@/types/config';
import { AuthController } from '@/controllers/AuthController';
import { SensorController } from '@/controllers/SensorController';
import { AIController } from '@/controllers/AIController';
import { DisplayController } from '@/controllers/DisplayController';
import { DeploymentController } from '@/controllers/DeploymentController';

export class WebServer {
  private app: Express;
  private server: Server;
  private io: SocketIOServer;
  private config: ServerConfig;
  private authController: AuthController;
  private sensorController: SensorController;
  private aiController: AIController;
  private displayController: DisplayController;
  private deploymentController: DeploymentController;

  constructor(config: ServerConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
      },
    });

    // Initialize controllers
    this.authController = new AuthController();
    this.sensorController = new SensorController();
    this.aiController = new AIController();
    this.displayController = new DisplayController();
    this.deploymentController = new DeploymentController();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSockets();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: this.config.cors.origin,
      credentials: true,
    }));

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/auth', this.authController.getRouter());
    this.app.use('/api/sensors', this.sensorController.getRouter());
    this.app.use('/api/ai', this.aiController.getRouter());
    this.app.use('/api/display', this.displayController.getRouter());
    this.app.use('/api/deploy', this.deploymentController.getRouter());

    // System info endpoint
    this.app.get('/api/system', (req: Request, res: Response) => {
      res.json({
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        loadAverage: process.platform === 'linux' ? require('os').loadavg() : null,
        hostname: require('os').hostname(),
        networkInterfaces: require('os').networkInterfaces(),
      });
    });

    // Static files (if you want to serve a web UI)
    this.app.use(express.static('public'));

    // Catch-all handler
    this.app.get('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.path} not found`,
      });
    });

    // Error handler
    this.app.use((error: any, req: Request, res: Response, next: any) => {
      logger.error('Express error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    });
  }

  private setupWebSockets(): void {
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Join sensor data room
      socket.join('sensor-updates');

      // Handle sensor data subscription
      socket.on('subscribe-sensors', () => {
        socket.join('sensor-data');
        logger.debug(`Client ${socket.id} subscribed to sensor data`);
      });

      socket.on('unsubscribe-sensors', () => {
        socket.leave('sensor-data');
        logger.debug(`Client ${socket.id} unsubscribed from sensor data`);
      });

      // Handle AI chat
      socket.on('ai-message', async (data: { message: string }) => {
        try {
          // This would integrate with your AI service
          const response = await this.aiController.processMessage(data.message);
          socket.emit('ai-response', response);
        } catch (error) {
          logger.error('Error processing AI message:', error);
          socket.emit('ai-error', { error: 'Failed to process message' });
        }
      });

      // Handle display updates
      socket.on('display-update', (data: any) => {
        // Broadcast display updates to other clients
        socket.broadcast.emit('display-changed', data);
      });

      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  public broadcastSensorData(sensorData: any): void {
    this.io.to('sensor-data').emit('sensor-update', sensorData);
  }

  public broadcastSystemAlert(alert: any): void {
    this.io.emit('system-alert', alert);
  }

  public broadcastDisplayUpdate(displayData: any): void {
    this.io.emit('display-update', displayData);
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, this.config.host, () => {
          logger.info(`Web server started on http://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('Stopping web server...');
      
      this.io.close(() => {
        logger.info('Socket.IO server closed');
      });

      this.server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
