import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/utils/logger';
import { ServerConfig } from '@/types/config';
import { AuthController } from '@/controllers/AuthController';
import { SensorController } from '@/controllers/SensorController';
import { AIController } from '@/controllers/AIController';
import { DisplayController } from '@/controllers/DisplayController';
import { DeploymentController } from '@/controllers/DeploymentController';
import { SensorManager } from '@/services/SensorManager';
import { AIService } from '@/services/AIService';
import { DisplayManager } from '@/services/DisplayManager';

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

  constructor(
    config: ServerConfig, 
    sensorManager?: SensorManager,
    aiService?: AIService,
    displayManager?: DisplayManager
  ) {
    this.config = config;
    this.app = express();
    // Try to create HTTPS server with self-signed cert, fallback to HTTP
    this.server = this.createServerWithSSL();
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
      },
    });

    // Initialize controllers
    this.authController = new AuthController();
    this.sensorController = new SensorController(sensorManager);
    this.aiController = new AIController(aiService);
    this.displayController = new DisplayController(displayManager);
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

    // Static files (serve the dashboard)
    this.app.use(express.static('public'));

    // Serve dashboard for root route
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile('index.html', { root: 'public' });
    });

    // Catch-all handler for API routes only
    this.app.get('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'API endpoint not found',
        message: `API route ${req.path} not found`,
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

  private createServerWithSSL(): Server {
    try {
      // Generate self-signed certificate for development
      const cert = this.generateSelfSignedCert();
      
      if (cert) {
        logger.info('Creating HTTPS server with self-signed certificate');
        return createHttpsServer({
          key: cert.key,
          cert: cert.cert
        }, this.app);
      }
    } catch (error) {
      logger.warn('Failed to create HTTPS server, falling back to HTTP:', error);
    }
    
    logger.info('Creating HTTP server');
    return createServer(this.app);
  }

  private generateSelfSignedCert(): { key: string; cert: string } | null {
    try {
      const forge = require('node-forge');
      const pki = forge.pki;
      
      // Generate a keypair
      const keys = pki.rsa.generateKeyPair(2048);
      
      // Create a certificate
      const cert = pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
      
      const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'countryName', value: 'US' },
        { shortName: 'ST', value: 'State' },
        { name: 'localityName', value: 'City' },
        { name: 'organizationName', value: 'Void Main' },
        { shortName: 'OU', value: 'IoT' }
      ];
      
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true },
        { name: 'subjectAltName', altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' },
          { type: 7, ip: '37.0.0.152' },
          { type: 7, ip: this.config.host }
        ]}
      ]);
      
      // Self-sign certificate
      cert.sign(keys.privateKey);
      
      return {
        key: pki.privateKeyToPem(keys.privateKey),
        cert: pki.certificateToPem(cert)
      };
    } catch (error) {
      logger.error('Failed to generate self-signed certificate:', error);
      return null;
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, this.config.host, () => {
          const protocol = this.server instanceof require('https').Server ? 'https' : 'http';
          logger.info(`Web server started on ${protocol}://${this.config.host}:${this.config.port}`);
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
