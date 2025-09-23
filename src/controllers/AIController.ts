import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { AIService } from '@/services/AIService';

export class AIController {
  private router: Router;
  private aiService: AIService | undefined;

  constructor(aiService?: AIService) {
    this.router = Router();
    this.aiService = aiService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/chat', this.chat.bind(this));
    this.router.post('/analyze', this.analyzeSensorData.bind(this));
    this.router.post('/speech', this.textToSpeech.bind(this));
    this.router.get('/conversation', this.getConversation.bind(this));
    this.router.delete('/conversation', this.clearConversation.bind(this));
  }

  private async chat(req: Request, res: Response): Promise<void> {
    try {
      const { message, includeSensorData } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (this.aiService) {
        // Use the actual AIService
        const response = await this.aiService.processMessage(message);
        
        res.json({
          userMessage: message,
          response: response,
          timestamp: new Date()
        });
      } else {
        // Fallback response
        const response = await this.processMessage(message);
        
        res.json({
          userMessage: message,
          response: response,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error('Error in AI chat:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  }

  private async analyzeSensorData(req: Request, res: Response): Promise<void> {
    try {
      const { sensorData } = req.body;

      if (!sensorData || !Array.isArray(sensorData)) {
        res.status(400).json({ error: 'Sensor data array is required' });
        return;
      }

      // Mock analysis - this would use your AIService
      const analysis = `Based on the sensor data:
- Temperature: ${sensorData.find(s => s.type === 'temperature')?.value || 'N/A'}°C
- Humidity: ${sensorData.find(s => s.type === 'humidity')?.value || 'N/A'}%
- All readings appear normal and within expected ranges.`;

      res.json({
        analysis,
        timestamp: new Date(),
        dataPoints: sensorData.length
      });
    } catch (error) {
      logger.error('Error analyzing sensor data:', error);
      res.status(500).json({ error: 'Failed to analyze sensor data' });
    }
  }

  private async textToSpeech(req: Request, res: Response): Promise<void> {
    try {
      const { text } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      // This would integrate with your AIService and ElevenLabs
      // For now, return a mock response
      res.json({
        message: 'Speech generation would be implemented here',
        text: text.substring(0, 100),
        audioUrl: '/api/ai/audio/placeholder.mp3'
      });
    } catch (error) {
      logger.error('Error generating speech:', error);
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  }

  private getConversation(req: Request, res: Response): void {
    try {
      // This would get conversation history from AIService
      const conversation = [
        {
          role: 'system',
          content: 'System initialized',
          timestamp: new Date()
        }
      ];

      res.json({ conversation });
    } catch (error) {
      logger.error('Error getting conversation:', error);
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  }

  private clearConversation(req: Request, res: Response): void {
    try {
      // This would clear conversation history in AIService
      logger.info('Conversation history cleared');
      res.json({ message: 'Conversation history cleared' });
    } catch (error) {
      logger.error('Error clearing conversation:', error);
      res.status(500).json({ error: 'Failed to clear conversation' });
    }
  }

  public async processMessage(message: string): Promise<string> {
    // Mock implementation - this would use your AIService
    return `You said: "${message}". This is a mock response from the AI system.`;
  }

  public getRouter(): Router {
    return this.router;
  }
}
