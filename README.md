# Void Main App

A TypeScript application for Raspberry Pi 5 that integrates sensors, display output, ChatGPT AI, and ElevenLabs text-to-speech capabilities.

## Features

- **Sensor Integration**: Connect and monitor various sensors (temperature, humidity, pressure, light, motion)
- **Display Output**: Real-time visualization and dashboard display
- **AI Integration**: ChatGPT integration for intelligent responses and analysis
- **Text-to-Speech**: ElevenLabs integration for voice responses
- **Web Interface**: Remote configuration and monitoring via web API
- **Real-time Updates**: WebSocket support for live data streaming

## Hardware Requirements

- Raspberry Pi 5 (or Pi 4)
- MicroSD card (32GB+ recommended)
- Power supply
- HDMI display (optional)
- Various sensors as needed:
  - Temperature/Humidity sensor (e.g., DHT22, BME280)
  - Light sensor (e.g., BH1750)
  - Motion sensor (e.g., PIR)
  - Other GPIO/I2C/SPI sensors

## Software Prerequisites

- Node.js 18+ installed on Raspberry Pi
- Git
- Python 3 (for some native modules)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/void-main-app.git
   cd void-main-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Build the application:**
   ```bash
   npm run build
   ```

5. **Start the application:**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

Copy `env.example` to `.env` and configure the following:

#### Core Settings
- `PORT`: Web server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment (development/production)

#### Security
- `JWT_SECRET`: Secret key for JWT tokens
- `ADMIN_PASSWORD`: Default admin password

#### API Keys
- `OPENAI_API_KEY`: Your OpenAI API key
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `ELEVENLABS_VOICE_ID`: ElevenLabs voice ID for TTS

#### Hardware
- `SENSORS_ENABLED`: Enable/disable sensor monitoring
- `DISPLAY_ENABLED`: Enable/disable display output
- `DISPLAY_WIDTH/HEIGHT`: Display resolution

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify token

### Sensors
- `GET /api/sensors` - Get all sensors
- `GET /api/sensors/:id` - Get specific sensor data
- `GET /api/sensors/:id/history` - Get sensor history

### AI Services
- `POST /api/ai/chat` - Chat with AI
- `POST /api/ai/analyze` - Analyze sensor data
- `POST /api/ai/speech` - Text-to-speech conversion

### Display
- `GET /api/display/status` - Display status
- `POST /api/display/update` - Update display content
- `POST /api/display/clear` - Clear display

### System
- `GET /api/system` - System information
- `GET /health` - Health check

## WebSocket Events

### Client → Server
- `subscribe-sensors` - Subscribe to sensor updates
- `ai-message` - Send message to AI
- `display-update` - Update display content

### Server → Client
- `sensor-update` - Real-time sensor data
- `ai-response` - AI response
- `system-alert` - System alerts

## Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run linter

### Project Structure
```
src/
├── controllers/     # API route controllers
├── services/        # Core business logic
├── middleware/      # Express middleware
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── config/         # Configuration files
```

## Remote Access Setup

For remote access over the internet:

1. **Port Forwarding**: Configure your router to forward port 3000 to your Pi
2. **Dynamic DNS**: Use a service like DuckDNS for stable hostname
3. **SSL/HTTPS**: Configure SSL certificates for secure access
4. **Firewall**: Ensure proper firewall configuration

### Example Router Configuration
- Internal IP: 192.168.1.100 (your Pi's IP)
- External Port: 8080
- Internal Port: 3000
- Protocol: TCP

Access via: `http://your-external-ip:8080`

## Raspberry Pi Setup

### GPIO Pin Configuration
- Refer to your sensor documentation for pin connections
- Common pins used:
  - GPIO 2, 3: I2C (SDA, SCL)
  - GPIO 18: PWM output
  - GPIO 24, 25: Digital I/O

### I2C Setup
Enable I2C interface:
```bash
sudo raspi-config
# Interface Options → I2C → Yes
```

### Permissions
Add user to GPIO group:
```bash
sudo usermod -a -G gpio $USER
sudo usermod -a -G i2c $USER
```

## Troubleshooting

### Common Issues

1. **Sensor not detected**: Check wiring and I2C configuration
2. **Permission denied**: Ensure user is in gpio/i2c groups
3. **Port in use**: Change PORT in .env file
4. **Display not working**: Check DISPLAY_ENABLED in .env

### Logs
Application logs are stored in:
- `logs/app.log` - General application logs
- `logs/error.log` - Error logs
- `logs/exceptions.log` - Uncaught exceptions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check existing GitHub issues
- Create a new issue with detailed information
- Include logs and system information
