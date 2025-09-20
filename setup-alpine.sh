#!/bin/sh

# Quick setup script for Alpine Linux
# Run with: curl -sSL https://raw.githubusercontent.com/yourusername/void-main-app/main/setup-alpine.sh | sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if running as root
if [ "$(id -u)" = "0" ]; then
    log_error "This script should not be run as root"
    exit 1
fi

# Check if running on Alpine
if [ ! -f /etc/alpine-release ]; then
    log_warn "This script is designed for Alpine Linux"
    read -p "Continue anyway? (y/N): " continue_anyway
    if [ "$continue_anyway" != "y" ] && [ "$continue_anyway" != "Y" ]; then
        exit 1
    fi
fi

log_info "🚀 Setting up Void Main App on Alpine Linux"

# Step 1: Install system packages
log_step "Installing required packages..."
if command -v sudo >/dev/null 2>&1; then
    sudo apk update
    sudo apk add nodejs npm git build-base python3 make g++ curl wget openssh-client openrc
else
    log_error "sudo not available. Please install packages manually:"
    echo "  apk add nodejs npm git build-base python3 make g++ curl wget openssh-client openrc"
    exit 1
fi

# Step 2: Check Node.js version
log_step "Checking Node.js version..."
NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# Step 3: Set up SSH key
log_step "Setting up SSH key for GitHub..."
if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
    log_info "Generating SSH key..."
    ssh-keygen -t ed25519 -C "$(whoami)@alpine-void-main" -N "" -f "$HOME/.ssh/id_ed25519"
    
    eval "$(ssh-agent -s)"
    ssh-add "$HOME/.ssh/id_ed25519"
    
    log_info "SSH public key (add this to GitHub):"
    echo "----------------------------------------"
    cat "$HOME/.ssh/id_ed25519.pub"
    echo "----------------------------------------"
    
    log_warn "Please add this SSH key to your GitHub account before continuing"
    read -p "Press Enter when you've added the key to GitHub..."
    
    # Test SSH connection
    if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        log_info "SSH authentication successful"
    else
        log_error "SSH authentication failed. Please check your GitHub SSH key setup"
        exit 1
    fi
else
    log_info "SSH key already exists"
fi

# Step 4: Get repository information
log_step "Repository setup..."
read -p "Enter your GitHub repository URL (git@github.com:username/void-main-app.git): " REPO_URL
if [ -z "$REPO_URL" ]; then
    log_error "Repository URL is required"
    exit 1
fi

# Step 5: Clone repository
if [ -d "void-main-app" ]; then
    log_warn "Directory 'void-main-app' already exists"
    read -p "Remove and re-clone? (y/N): " remove_existing
    if [ "$remove_existing" = "y" ] || [ "$remove_existing" = "Y" ]; then
        rm -rf void-main-app
    else
        cd void-main-app
        git pull origin main
        log_info "Updated existing repository"
    fi
fi

if [ ! -d "void-main-app" ]; then
    log_step "Cloning repository..."
    git clone "$REPO_URL"
fi

cd void-main-app

# Step 6: Install dependencies
log_step "Installing dependencies..."
npm install

# Step 7: Set up environment
log_step "Setting up environment..."
if [ ! -f ".env" ]; then
    cp env.example .env
    log_info "Created .env file from template"
    
    # Generate webhook secret
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    sed -i "s/your-webhook-secret-here-generate-with-openssl-rand-hex-32/$WEBHOOK_SECRET/" .env
    
    log_warn "Please edit .env file and add your API keys:"
    log_info "  - OPENAI_API_KEY"
    log_info "  - ELEVENLABS_API_KEY"
    log_info "  - ELEVENLABS_VOICE_ID"
    
    read -p "Press Enter to edit .env file now..."
    ${EDITOR:-vi} .env
else
    log_info "Environment file already exists"
fi

# Step 8: Build application
log_step "Building application..."
npm run build

# Step 9: Set up service
log_step "Setting up OpenRC service..."
sudo tee /etc/init.d/void-main > /dev/null << 'EOF'
#!/sbin/openrc-run

name="void-main"
description="Void Main IoT Application"

: ${command_user:=pi}
: ${pidfile:="/run/${RC_SVCNAME}.pid"}

command="/usr/bin/node"
command_args="/home/pi/void-main-app/dist/index.js"
command_background="yes"

directory="/home/pi/void-main-app"

output_log="/home/pi/void-main-app/logs/app.log"
error_log="/home/pi/void-main-app/logs/error.log"

depend() {
    need net
    after firewall
}

start_pre() {
    mkdir -p "$(dirname "$output_log")"
    chown "$command_user" "$(dirname "$output_log")"
    
    if [ ! -f "/home/pi/void-main-app/dist/index.js" ]; then
        eerror "Application not built. Run 'npm run build' first."
        return 1
    fi
}
EOF

# Update service with correct user and paths
sudo sed -i "s|/home/pi|$HOME|g" /etc/init.d/void-main
sudo sed -i "s|command_user:=pi|command_user:=$(whoami)|" /etc/init.d/void-main

sudo chmod +x /etc/init.d/void-main
sudo rc-update add void-main default

# Step 10: Create backup directory
mkdir -p "$HOME/backups"

# Step 11: Start service
log_step "Starting service..."
sudo rc-service void-main start

# Step 12: Check service status
sleep 3
if sudo rc-service void-main status | grep -q "started"; then
    log_info "✅ Service started successfully"
else
    log_error "❌ Service failed to start"
    log_info "Check logs with: tail -f logs/app.log"
fi

# Step 13: Display network information
log_step "Network information..."
LOCAL_IP=$(hostname -I | awk '{print $1}')
log_info "Local access: http://$LOCAL_IP:3000"
log_info "Health check: curl http://$LOCAL_IP:3000/health"

# Step 14: Webhook setup instructions
log_step "Webhook setup..."
WEBHOOK_SECRET=$(grep GITHUB_WEBHOOK_SECRET .env | cut -d'=' -f2)
log_info "Webhook URL (for GitHub): http://$LOCAL_IP:3000/api/deploy/webhook"
log_info "Webhook Secret: $WEBHOOK_SECRET"

echo ""
log_info "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure port forwarding on your router (if needed for remote access)"
echo "2. Set up GitHub webhook with the URL and secret shown above"
echo "3. Test deployment by pushing to main branch"
echo ""
echo "Useful commands:"
echo "  sudo rc-service void-main status    # Check service status"
echo "  tail -f logs/app.log               # View application logs"
echo "  tail -f logs/deployment.log        # View deployment logs"
echo "  ./deploy-update.sh                 # Manual deployment"
echo ""
echo "Configuration files:"
echo "  .env                               # Environment variables"
echo "  /etc/init.d/void-main             # Service configuration"
