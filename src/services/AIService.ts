import { EventEmitter } from 'events';
import OpenAI from 'openai';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { AIConfig } from '@/types/config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface VoiceResponse {
  audioBuffer: Buffer;
  contentType: string;
}

export class AIService extends EventEmitter {
  private config: AIConfig;
  private openai?: OpenAI;
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string;

  constructor(config: AIConfig) {
    super();
    this.config = config;
    this.systemPrompt = this.createSystemPrompt();
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing AI Service...');

    try {
      if (this.config.openai.apiKey) {
        this.openai = new OpenAI({
          apiKey: this.config.openai.apiKey,
        });
        
        // Test connection
        await this.testOpenAIConnection();
        logger.info('OpenAI connection established');
      } else {
        logger.warn('OpenAI API key not provided');
      }

      if (this.config.elevenlabs.apiKey) {
        await this.testElevenLabsConnection();
        logger.info('ElevenLabs connection established');
      } else {
        logger.warn('ElevenLabs API key not provided');
      }

      // Initialize conversation with system prompt
      this.conversationHistory.push({
        role: 'system',
        content: this.systemPrompt,
        timestamp: new Date()
      });

      logger.info('AI Service initialized');
    } catch (error) {
      logger.error('Failed to initialize AI Service:', error);
      throw error;
    }
  }

  private createSystemPrompt(): string {
    return `You are an AI assistant for a Raspberry Pi IoT system called "Void Main". 

Your role is to:
1. Monitor and interpret sensor data from various environmental sensors
2. Provide insights and alerts based on sensor readings
3. Answer questions about the system status and data
4. Help with system configuration and troubleshooting
5. Provide contextual information about the environment

You have access to real-time data from sensors including:
- Temperature and humidity sensors
- Light sensors
- Motion detectors
- Pressure sensors
- Distance sensors

Please be concise, helpful, and focus on actionable insights. When providing responses that will be converted to speech, keep them natural and conversational.

Current system time: ${new Date().toISOString()}`;
  }

  private async testOpenAIConnection(): Promise<void> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.openai.model,
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 10,
      });
      
      logger.debug('OpenAI test response:', response.choices[0]?.message?.content);
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      throw error;
    }
  }

  private async testElevenLabsConnection(): Promise<void> {
    try {
      const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.config.elevenlabs.apiKey,
        },
      });
      
      logger.debug('ElevenLabs voices available:', response.data.voices.length);
    } catch (error) {
      logger.error('ElevenLabs connection test failed:', error);
      throw error;
    }
  }

  public async processMessage(userMessage: string, sensorContext?: any[]): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI service not available');
    }

    try {
      // Add sensor context to the conversation if provided
      let contextualMessage = userMessage;
      if (sensorContext && sensorContext.length > 0) {
        const sensorData = sensorContext.map(sensor => 
          `${sensor.id}: ${sensor.value} ${sensor.unit} (${sensor.timestamp.toISOString()})`
        ).join('\n');
        
        contextualMessage = `Current sensor readings:\n${sensorData}\n\nUser question: ${userMessage}`;
      }

      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: contextualMessage,
        timestamp: new Date()
      });

      // Get response from OpenAI
      const response = await this.openai.chat.completions.create({
        model: this.config.openai.model,
        messages: this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0]?.message?.content || 'No response generated';

      // Add assistant response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date()
      });

      // Trim conversation history if it gets too long
      if (this.conversationHistory.length > 20) {
        // Keep system prompt and last 18 messages
        const systemPrompt = this.conversationHistory[0];
        if (systemPrompt) {
          this.conversationHistory = [
            systemPrompt, // system prompt
            ...this.conversationHistory.slice(-18)
          ];
        }
      }

      logger.info('Generated AI response for user message');
      this.emit('messageProcessed', { userMessage, assistantMessage, timestamp: new Date() });

      return assistantMessage;
    } catch (error) {
      logger.error('Failed to process message with OpenAI:', error);
      throw error;
    }
  }

  public async generateSpeech(text: string): Promise<VoiceResponse | null> {
    if (!this.config.elevenlabs.apiKey || !this.config.elevenlabs.voiceId) {
      logger.warn('ElevenLabs not configured, cannot generate speech');
      return null;
    }

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabs.voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.elevenlabs.apiKey,
          },
          responseType: 'arraybuffer',
        }
      );

      logger.info('Generated speech for text:', text.substring(0, 50) + '...');
      this.emit('speechGenerated', { text, audioLength: response.data.length });

      return {
        audioBuffer: Buffer.from(response.data),
        contentType: 'audio/mpeg',
      };
    } catch (error) {
      logger.error('Failed to generate speech with ElevenLabs:', error);
      throw error;
    }
  }

  public async analyzeSensorData(sensorData: any[]): Promise<string> {
    const analysisPrompt = `Analyze the following sensor data and provide insights:

${sensorData.map(sensor => 
  `${sensor.id} (${sensor.type}): ${sensor.value} ${sensor.unit} at ${sensor.timestamp.toISOString()}`
).join('\n')}

Please provide:
1. Any concerning readings or anomalies
2. Trends or patterns you notice
3. Recommendations or alerts if applicable
4. Overall system status assessment

Keep the response concise and actionable.`;

    return await this.processMessage(analysisPrompt);
  }

  public getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  public clearConversationHistory(): void {
    const systemPrompt = this.conversationHistory[0];
    if (systemPrompt) {
      this.conversationHistory = [systemPrompt]; // Keep system prompt
    } else {
      this.conversationHistory = [];
    }
    logger.info('Conversation history cleared');
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up AI Service...');
    
    this.conversationHistory = [];
    
    logger.info('AI Service cleanup complete');
  }
}
