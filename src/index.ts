// Register module aliases for runtime path resolution
import 'module-alias/register';

import dotenv from 'dotenv';
import { logger } from '@/utils/logger';
import { SensorManager } from '@/services/SensorManager';
import { DisplayManager } from '@/services/DisplayManager';
import { AIService } from '@/services/AIService';
import { WebServer } from '@/services/WebServer';
import { AppConfig } from '@/types/config';

// Load environment variables
dotenv.config();

class VoidMainApp {
  private sensorManager: SensorManager;
  private displayManager: DisplayManager;
  private aiService: AIService;
  private webServer: WebServer;
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.sensorManager = new SensorManager(this.config.sensors);
    this.displayManager = new DisplayManager(this.config.display);
    this.aiService = new AIService(this.config.ai);
    this.webServer = new WebServer(this.config.server);
  }

  private loadConfig(): AppConfig {
    return {
      sensors: {
        enabled: process.env.SENSORS_ENABLED === 'true',
        updateInterval: parseInt(process.env.SENSOR_UPDATE_INTERVAL || '1000'),
      },
      display: {
        enabled: process.env.DISPLAY_ENABLED === 'true',
        width: parseInt(process.env.DISPLAY_WIDTH || '1920'),
        height: parseInt(process.env.DISPLAY_HEIGHT || '1080'),
      },
      ai: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        },
        elevenlabs: {
          apiKey: process.env.ELEVENLABS_API_KEY || '',
          voiceId: process.env.ELEVENLABS_VOICE_ID || '',
        },
      },
      server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
        cors: {
          origin: process.env.CORS_ORIGIN || '*',
        },
      },
    };
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting Void Main App...');
      
      // Initialize services
      await this.sensorManager.initialize();
      await this.displayManager.initialize();
      await this.aiService.initialize();
      await this.webServer.start();

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Void Main App started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.webServer.stop();
        await this.displayManager.cleanup();
        await this.sensorManager.cleanup();
        logger.info('Application shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start the application
const app = new VoidMainApp();
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
