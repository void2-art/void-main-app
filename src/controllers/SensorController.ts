import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { SensorManager } from '@/services/SensorManager';

export class SensorController {
  private router: Router;
  private sensorManager: SensorManager | undefined;

  constructor(sensorManager?: SensorManager) {
    this.router = Router();
    this.sensorManager = sensorManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.getAllSensors.bind(this));
    this.router.get('/:sensorId', this.getSensorData.bind(this));
    this.router.get('/:sensorId/history', this.getSensorHistory.bind(this));
  }

  private getAllSensors(req: Request, res: Response): void {
    try {
      if (this.sensorManager) {
        const sensors = this.sensorManager.getAllSensors();
        const systemStatus = this.sensorManager.getSystemStatus();
        
        res.json({ 
          sensors,
          systemStatus,
          message: systemStatus.isSimulation ? 'Running in simulation mode' : 'Connected to hardware sensors'
        });
      } else {
        // Fallback if no sensor manager
        const sensors = [
          { id: 'temperature', type: 'temperature', status: 'disconnected', isSimulated: true },
          { id: 'humidity', type: 'humidity', status: 'disconnected', isSimulated: true },
          { id: 'pressure', type: 'pressure', status: 'disconnected', isSimulated: true },
          { id: 'light', type: 'light', status: 'disconnected', isSimulated: true },
          { id: 'motion', type: 'motion', status: 'disconnected', isSimulated: true },
        ];

        res.json({ 
          sensors,
          systemStatus: { isSimulation: true, sensorCount: 0, hardwareAvailable: false },
          message: 'Sensor manager not initialized'
        });
      }
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
      
      if (this.sensorManager) {
        const sensorData = this.sensorManager.getCurrentSensorValue(sensorId);
        
        if (sensorData) {
          res.json({
            id: sensorId,
            value: sensorData.value,
            unit: sensorData.unit,
            timestamp: sensorData.timestamp,
            status: 'active'
          });
        } else {
          res.status(404).json({ error: `Sensor ${sensorId} not found` });
        }
      } else {
        // Fallback mock data
        const mockData = {
          id: sensorId,
          value: Math.random() * 100,
          unit: this.getUnitForSensor(sensorId),
          timestamp: new Date(),
          status: 'simulated'
        };

        res.json(mockData);
      }
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
