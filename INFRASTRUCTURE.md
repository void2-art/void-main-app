# Infrastructure Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Raspberry Pi 5                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Void Main App                          │    │
│  │                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │ Sensor      │  │ Display     │  │ AI Service  │  │    │
│  │  │ Manager     │  │ Manager     │  │             │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  │                                                     │    │
│  │  ┌─────────────────────────────────────────────────┐  │    │
│  │  │           Web Server & API                      │  │    │
│  │  │  • REST API                                     │  │    │
│  │  │  • WebSocket                                    │  │    │
│  │  │  • Authentication                               │  │    │
│  │  └─────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Hardware Layer                         │    │
│  │  • GPIO Sensors                                     │    │
│  │  • I2C/SPI Devices                                  │    │
│  │  • HDMI Display                                     │    │
│  │  • Network Interface                                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Network
                              │
┌─────────────────────────────┼─────────────────────────────┐
│           Local Network     │                             │
│                            │                             │
│  ┌───────────────┐         │         ┌───────────────┐   │
│  │    Router     │─────────┼─────────│   Client      │   │
│  │               │         │         │   Devices     │   │
│  └───────────────┘         │         └───────────────┘   │
│                            │                             │
└─────────────────────────────┼─────────────────────────────┘
                              │
                              │ Internet
                              │
┌─────────────────────────────┼─────────────────────────────┐
│          Cloud Services     │                             │
│                            │                             │
│  ┌───────────────┐         │         ┌───────────────┐   │
│  │   OpenAI      │         │         │  ElevenLabs   │   │
│  │   ChatGPT     │─────────┼─────────│      TTS      │   │
│  │               │         │         │               │   │
│  └───────────────┘         │         └───────────────┘   │
└─────────────────────────────┼─────────────────────────────┘
```

## Component Overview

### Core Services

1. **Sensor Manager**
   - Interfaces with GPIO, I2C, SPI sensors
   - Provides real-time data collection
   - Supports simulation mode for development
   - Configurable polling intervals

2. **Display Manager**
   - Canvas-based rendering system
   - Dashboard visualization
   - Screenshot capabilities
   - Text and graphics output

3. **AI Service**
   - OpenAI ChatGPT integration
   - ElevenLabs text-to-speech
   - Contextual sensor data analysis
   - Conversation management

4. **Web Server**
   - RESTful API endpoints
   - WebSocket real-time communication
   - Authentication & authorization
   - Remote configuration interface

## Network Architecture

### Local Network Access
- **Direct Access**: `http://[pi-ip]:3000`
- **WebSocket**: `ws://[pi-ip]:3000`
- **mDNS**: `http://raspberrypi.local:3000` (if configured)

### Remote Access Options

#### Option 1: Port Forwarding
```
Internet → Router:8080 → Pi:3000
```
- Configure router port forwarding
- Access via public IP: `http://[public-ip]:8080`
- Requires static IP or dynamic DNS

#### Option 2: VPN Access
```
Client → VPN Server → Local Network → Pi:3000
```
- Set up VPN server (e.g., WireGuard, OpenVPN)
- Secure remote access to local network
- Access as if on local network

#### Option 3: Reverse Proxy/Tunnel
```
Pi → Tunnel Service → Internet → Client
```
- Services like ngrok, localtunnel
- No router configuration needed
- May have bandwidth limitations

#### Option 4: Cloud Proxy
```
Pi → Cloud Server → Internet → Client
```
- Custom cloud server as proxy
- Full control over access
- Requires cloud server setup

## Security Considerations

### Authentication
- JWT-based authentication
- Configurable admin credentials
- Role-based access control

### Network Security
- CORS configuration
- Helmet.js security headers
- Input validation and sanitization

### Production Recommendations
- Enable HTTPS with SSL certificates
- Use strong passwords and JWT secrets
- Regular security updates
- Firewall configuration
- VPN for remote access

## Hardware Setup

### GPIO Pin Usage
```
Pin   Function      Device Type
────────────────────────────────
2     I2C SDA      Temperature/Humidity sensors
3     I2C SCL      Pressure sensors, displays
4     GPIO         Digital sensors (motion, etc.)
18    PWM          LED control, servo motors
```

### I2C Device Addresses
```
Address   Device
─────────────────
0x48      ADS1115 (ADC)
0x76      BME280 (Temp/Humidity/Pressure)
0x23      BH1750 (Light sensor)
0x3C      SSD1306 (OLED display)
```

## Data Flow

### Sensor Data Pipeline
```
Sensor → GPIO/I2C → Sensor Manager → WebSocket → Clients
                       ↓
                   AI Analysis → Response → TTS → Audio
```

### Configuration Flow
```
Web Client → API → Configuration Update → Service Restart
```

### Monitoring Flow
```
System Metrics → Logger → Log Files → Optional Log Aggregation
```

## Deployment Strategies

### Development
- Local development with sensor simulation
- Hot reload with `npm run dev`
- Mock external API responses

### Production
- Systemd service for auto-start
- Log rotation configuration
- Environment-specific configuration
- Health monitoring

### High Availability (Optional)
- Multiple Pi devices with load balancing
- Shared configuration storage
- Redundant sensor networks
- Failover mechanisms

## Scaling Considerations

### Horizontal Scaling
- Multiple sensor nodes reporting to central hub
- Distributed sensor networks
- Load balancing for web interface

### Vertical Scaling
- Optimize sensor polling rates
- Efficient data structures
- Caching strategies
- Database optimization (if using persistent storage)

## Monitoring & Maintenance

### Health Checks
- System resources (CPU, memory, disk)
- Service status monitoring
- Sensor connectivity status
- API response times

### Alerting
- Critical system errors
- Sensor disconnections
- High resource usage
- Network connectivity issues

### Maintenance Tasks
- Log rotation and cleanup
- Security updates
- Sensor calibration
- Performance optimization

## Future Enhancements

### Potential Features
- Database integration for historical data
- Mobile app development
- Machine learning for predictive analytics
- Integration with home automation systems
- Multi-tenant support
- Advanced visualization dashboards
