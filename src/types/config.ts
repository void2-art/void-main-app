export interface SensorConfig {
  enabled: boolean;
  updateInterval: number;
}

export interface DisplayConfig {
  enabled: boolean;
  width: number;
  height: number;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
}

export interface AIConfig {
  openai: OpenAIConfig;
  elevenlabs: ElevenLabsConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string;
  };
}

export interface AppConfig {
  sensors: SensorConfig;
  display: DisplayConfig;
  ai: AIConfig;
  server: ServerConfig;
}

export interface SensorData {
  id: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'light' | 'motion' | 'distance';
  value: number;
  unit: string;
  timestamp: Date;
  pin?: number;
  address?: number;
}

export interface DisplayContent {
  type: 'text' | 'image' | 'chart' | 'dashboard';
  content: any;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
