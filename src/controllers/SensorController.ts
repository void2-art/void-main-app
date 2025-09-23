import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';

export class SensorController {
  private router: Router;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.getAllSensors.bind(this));
    this.router.get('/:sensorId', this.getSensorData.bind(this));
    this.router.get('/:sensorId/history', this.getSensorHistory.bind(this));
  }

  private getAllSensors(req: Request, res: Response): void {
    try {
      // This would integrate with your SensorManager
      const sensors = [
        { id: 'temperature', type: 'temperature', status: 'active' },
        { id: 'humidity', type: 'humidity', status: 'active' },
        { id: 'pressure', type: 'pressure', status: 'active' },
        { id: 'light', type: 'light', status: 'active' },
        { id: 'motion', type: 'motion', status: 'active' },
      ];

      res.json({ sensors });
    } catch (error) {
      logger.error('Error getting sensors:', error);
      res.status(500).json({ error: 'Failed to get sensor data' });
    }
  }

  private getSensorData(req: Request, res: Response): void {
    try {
      const { sensorId } = req.params;
      
      if (!sensorId) {
        res.status(400).json({ error: 'Sensor ID is required' });
        return;
      }
      
      // Mock sensor data - this would come from SensorManager
      const mockData = {
        id: sensorId,
        value: Math.random() * 100,
        unit: this.getUnitForSensor(sensorId),
        timestamp: new Date(),
        status: 'active'
      };

      res.json(mockData);
    } catch (error) {
      logger.error('Error getting sensor data:', error);
      res.status(500).json({ error: 'Failed to get sensor data' });
    }
  }

  private getSensorHistory(req: Request, res: Response): void {
    try {
      const { sensorId } = req.params;
      const { hours = '24' } = req.query;

      // Mock historical data
      const history = Array.from({ length: parseInt(hours as string) }, (_, i) => ({
        value: Math.random() * 100,
        timestamp: new Date(Date.now() - (i * 60 * 60 * 1000))
      }));

      res.json({
        sensorId,
        timeRange: `${hours} hours`,
        data: history
      });
    } catch (error) {
      logger.error('Error getting sensor history:', error);
      res.status(500).json({ error: 'Failed to get sensor history' });
    }
  }

  private getUnitForSensor(sensorId: string): string {
    const units: { [key: string]: string } = {
      temperature: '°C',
      humidity: '%',
      pressure: 'hPa',
      light: 'lux',
      motion: 'boolean'
    };
    return units[sensorId] || 'units';
  }

  public getRouter(): Router {
    return this.router;
  }
}
