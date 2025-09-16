import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { DisplayConfig, DisplayContent } from '@/types/config';

// Canvas for rendering
let Canvas: any;
let createCanvas: any;

try {
  const canvas = require('canvas');
  Canvas = canvas.Canvas;
  createCanvas = canvas.createCanvas;
} catch (error) {
  logger.warn('Canvas library not available, running without display rendering');
}

export class DisplayManager extends EventEmitter {
  private config: DisplayConfig;
  private canvas?: any;
  private context?: any;
  private isInitialized = false;
  private displayBuffer: DisplayContent[] = [];

  constructor(config: DisplayConfig) {
    super();
    this.config = config;
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing Display Manager...');

    if (!this.config.enabled) {
      logger.info('Display disabled in configuration');
      return;
    }

    try {
      if (createCanvas) {
        this.canvas = createCanvas(this.config.width, this.config.height);
        this.context = this.canvas.getContext('2d');
        this.setupCanvas();
        this.isInitialized = true;
        logger.info(`Display initialized: ${this.config.width}x${this.config.height}`);
      } else {
        logger.warn('Canvas not available, display functionality limited');
      }
    } catch (error) {
      logger.error('Failed to initialize display:', error);
      throw error;
    }
  }

  private setupCanvas(): void {
    if (!this.context) return;

    // Set default styles
    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, this.config.width, this.config.height);
    
    this.context.fillStyle = '#FFFFFF';
    this.context.font = '16px Arial';
    this.context.textAlign = 'left';
    this.context.textBaseline = 'top';
  }

  public async displayText(text: string, x = 10, y = 10, options?: {
    fontSize?: number;
    color?: string;
    font?: string;
  }): Promise<void> {
    if (!this.isInitialized || !this.context) {
      logger.warn('Display not initialized, cannot display text');
      return;
    }

    const fontSize = options?.fontSize || 16;
    const color = options?.color || '#FFFFFF';
    const font = options?.font || 'Arial';

    this.context.font = `${fontSize}px ${font}`;
    this.context.fillStyle = color;
    this.context.fillText(text, x, y);

    logger.debug(`Displayed text: "${text}" at (${x}, ${y})`);
  }

  public async displaySensorData(sensorData: any[]): Promise<void> {
    if (!this.isInitialized) return;

    // Clear previous content
    this.clearDisplay();

    // Display title
    await this.displayText('Sensor Data', 10, 10, { fontSize: 24, color: '#00FF00' });

    // Display sensor readings
    let yOffset = 60;
    for (const sensor of sensorData) {
      const text = `${sensor.id}: ${sensor.value.toFixed(2)} ${sensor.unit}`;
      await this.displayText(text, 10, yOffset, { fontSize: 18 });
      yOffset += 30;
    }

    // Update timestamp
    const timestamp = new Date().toLocaleString();
    await this.displayText(`Updated: ${timestamp}`, 10, this.config.height - 30, { fontSize: 12, color: '#CCCCCC' });
  }

  public async displayDashboard(data: {
    sensors: any[];
    status: string;
    uptime: string;
  }): Promise<void> {
    if (!this.isInitialized) return;

    this.clearDisplay();

    // Header
    await this.displayText('Void Main Dashboard', 10, 10, { fontSize: 28, color: '#00FFFF' });
    await this.displayText(`Status: ${data.status}`, 10, 50, { fontSize: 16, color: '#00FF00' });
    await this.displayText(`Uptime: ${data.uptime}`, 10, 75, { fontSize: 16, color: '#FFFF00' });

    // Sensor data grid
    const cols = 2;
    const rowHeight = 120;
    const colWidth = this.config.width / cols;

    data.sensors.forEach((sensor, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * colWidth + 20;
      const y = 120 + (row * rowHeight);

      // Sensor box
      this.context.strokeStyle = '#444444';
      this.context.strokeRect(x - 10, y - 10, colWidth - 20, rowHeight - 20);

      // Sensor data
      this.displayText(sensor.id.toUpperCase(), x, y, { fontSize: 16, color: '#FFFFFF' });
      this.displayText(`${sensor.value.toFixed(2)} ${sensor.unit}`, x, y + 25, { fontSize: 20, color: '#00FF00' });
      this.displayText(`Type: ${sensor.type}`, x, y + 50, { fontSize: 12, color: '#CCCCCC' });
      this.displayText(`Updated: ${sensor.timestamp.toLocaleTimeString()}`, x, y + 70, { fontSize: 10, color: '#888888' });
    });
  }

  public clearDisplay(): void {
    if (!this.context) return;

    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, this.config.width, this.config.height);
  }

  public async saveFrame(filename: string): Promise<void> {
    if (!this.canvas) {
      logger.warn('Cannot save frame: canvas not available');
      return;
    }

    try {
      const fs = require('fs');
      const buffer = this.canvas.toBuffer('image/png');
      fs.writeFileSync(filename, buffer);
      logger.info(`Frame saved to ${filename}`);
    } catch (error) {
      logger.error('Failed to save frame:', error);
    }
  }

  public getDisplayBuffer(): Buffer | null {
    if (!this.canvas) return null;
    
    try {
      return this.canvas.toBuffer('image/png');
    } catch (error) {
      logger.error('Failed to get display buffer:', error);
      return null;
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Display Manager...');
    
    this.displayBuffer = [];
    this.isInitialized = false;
    
    logger.info('Display Manager cleanup complete');
  }
}
