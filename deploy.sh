#!/bin/bash

# Deployment script for Void Main App on Raspberry Pi

set -e

echo "🚀 Starting deployment of Void Main App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="void-main-app"
APP_DIR="/home/pi/$APP_NAME"
SERVICE_NAME="void-main"
USER="pi"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    log_warn "This script is designed for Raspberry Pi. Continuing anyway..."
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
log_info "Installing dependencies..."
npm ci --production

# Build the application
log_info "Building application..."
npm run build

# Create logs directory
log_info "Creating logs directory..."
mkdir -p logs

# Set up environment file
if [ ! -f ".env" ]; then
    log_info "Creating .env file from template..."
    cp env.example .env
    log_warn "Please edit .env file with your configuration before running the app"
fi

# Install systemd service (if running as root or with sudo)
if [ "$EUID" -eq 0 ] || sudo -n true 2>/dev/null; then
    log_info "Installing systemd service..."
    
    # Update service file with correct paths
    sed "s|/home/pi/void-main-app|$(pwd)|g" void-main.service > /tmp/void-main.service
    sed -i "s|/home/pi/.nvm/versions/node/v18.17.0/bin/node|$(which node)|g" /tmp/void-main.service
    
    sudo cp /tmp/void-main.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable $SERVICE_NAME
    
    log_info "Service installed. You can start it with: sudo systemctl start $SERVICE_NAME"
else
    log_warn "Cannot install systemd service without sudo privileges"
    log_info "To install manually:"
    echo "  sudo cp void-main.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable $SERVICE_NAME"
    echo "  sudo systemctl start $SERVICE_NAME"
fi

# Set up log rotation (if logrotate is available)
if command -v logrotate &> /dev/null; then
    log_info "Setting up log rotation..."
    cat > /tmp/void-main-logrotate << EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
    
    if sudo -n true 2>/dev/null; then
        sudo cp /tmp/void-main-logrotate /etc/logrotate.d/void-main
        log_info "Log rotation configured"
    else
        log_warn "Cannot install log rotation without sudo privileges"
        log_info "To install manually: sudo cp /tmp/void-main-logrotate /etc/logrotate.d/void-main"
    fi
fi

# Check if GPIO permissions are set up
if [ "$(groups | grep -c gpio)" -eq 0 ]; then
    log_warn "User $USER is not in the gpio group"
    log_info "Add user to gpio group: sudo usermod -a -G gpio $USER"
    log_info "Add user to i2c group: sudo usermod -a -G i2c $USER"
    log_info "You'll need to log out and log back in for changes to take effect"
fi

# Check if I2C is enabled
if [ ! -d "/sys/bus/i2c" ]; then
    log_warn "I2C interface is not enabled"
    log_info "Enable I2C: sudo raspi-config -> Interface Options -> I2C -> Yes"
fi

# Display network information
log_info "Network information:"
hostname -I | awk '{print "  Local IP: " $1}'
echo "  Access the web interface at: http://$(hostname -I | awk '{print $1}'):3000"

log_info "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys and configuration"
echo "2. Start the service: sudo systemctl start $SERVICE_NAME"
echo "3. Check status: sudo systemctl status $SERVICE_NAME"
echo "4. View logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "For development:"
echo "  npm run dev    # Start development server"
echo "  npm run build  # Build for production"
echo "  npm start      # Start production server"
