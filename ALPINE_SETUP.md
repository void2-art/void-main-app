# Alpine Linux Setup Guide

This guide covers setting up automatic deployment on Alpine Linux for the Void Main App.

## Prerequisites

### 1. Install Required Packages

```bash
# Update package index
sudo apk update

# Install Node.js and npm
sudo apk add nodejs npm

# Install Git
sudo apk add git

# Install OpenRC (init system)
sudo apk add openrc

# Install build tools for native modules
sudo apk add build-base python3 make g++

# Install additional utilities
sudo apk add curl wget openssh-client
```

### 2. Create User and Directory Structure

```bash
# Create application user (if not exists)
sudo adduser -D -s /bin/sh pi

# Create directories
sudo mkdir -p /home/pi/void-main-app
sudo mkdir -p /home/pi/backups
sudo mkdir -p /home/pi/.ssh

# Set ownership
sudo chown -R pi:pi /home/pi/
```

## SSH Key Setup for GitHub

### 1. Generate SSH Key

```bash
# Switch to pi user
su - pi

# Generate SSH key
ssh-keygen -t ed25519 -C "pi@alpine-void-main"

# Start SSH agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Display public key
cat ~/.ssh/id_ed25519.pub
```

### 2. Add SSH Key to GitHub

1. Copy the public key output from above
2. Go to GitHub → Settings → SSH and GPG keys
3. Click "New SSH key"
4. Paste the key and give it a title like "Alpine Pi - Void Main"
5. Click "Add SSH key"

### 3. Test SSH Connection

```bash
ssh -T git@github.com
# Should respond with: "Hi [username]! You've successfully authenticated..."
```

## Clone and Setup Repository

```bash
# Clone repository
cd /home/pi
git clone git@github.com:yourusername/void-main-app.git
cd void-main-app

# Install dependencies
npm install

# Create environment file
cp env.example .env

# Edit environment file
vi .env  # or nano .env
```

### Environment Configuration

Edit `.env` with your specific settings:

```bash
# Add these additional Alpine/deployment specific settings
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
DEPLOY_SCRIPT_PATH=/home/pi/void-main-app/deploy-update.sh
AUTO_RESTART=true

# Set your API keys
OPENAI_API_KEY=your-key-here
ELEVENLABS_API_KEY=your-key-here
ELEVENLABS_VOICE_ID=your-voice-id-here
```

## OpenRC Service Setup

### 1. Create Service Script

```bash
sudo vi /etc/init.d/void-main
```

Add the following content:

```bash
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
    # Ensure log directory exists
    mkdir -p "$(dirname "$output_log")"
    chown "$command_user" "$(dirname "$output_log")"
    
    # Check if application is built
    if [ ! -f "/home/pi/void-main-app/dist/index.js" ]; then
        eerror "Application not built. Run 'npm run build' first."
        return 1
    fi
}
```

### 2. Make Service Executable and Enable

```bash
# Make executable
sudo chmod +x /etc/init.d/void-main

# Add to default runlevel
sudo rc-update add void-main default

# Start the service
sudo rc-service void-main start

# Check service status
sudo rc-service void-main status
```

## GitHub Webhook Configuration

### 1. Configure Webhook Secret

Generate a secure webhook secret:

```bash
# Generate random secret
openssl rand -hex 32
```

Add this to your `.env` file:
```bash
GITHUB_WEBHOOK_SECRET=your-generated-secret-here
```

### 2. Set Up GitHub Webhook

1. Go to your GitHub repository
2. Navigate to Settings → Webhooks
3. Click "Add webhook"
4. Configure:
   - **Payload URL**: `http://your-pi-ip:3000/api/deploy/webhook`
   - **Content type**: `application/json`
   - **Secret**: Use the secret from your `.env` file
   - **Events**: Select "Just the push event"
   - **Active**: ✓ Checked

### 3. Configure Network Access

#### Option A: Port Forwarding (Simple)

1. Configure your router to forward external port to Pi:
   - External port: 8080 (or your choice)
   - Internal IP: Your Pi's local IP
   - Internal port: 3000

2. Update webhook URL to use your public IP:
   - `http://your-public-ip:8080/api/deploy/webhook`

#### Option B: ngrok (Testing/Development)

```bash
# Install ngrok (if not available via apk)
wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.tgz
tar xzf ngrok-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Run ngrok
ngrok http 3000

# Use the HTTPS URL for webhook
```

#### Option C: Cloudflare Tunnel (Recommended for Production)

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Set up tunnel (requires Cloudflare account)
cloudflared tunnel login
cloudflared tunnel create void-main
cloudflared tunnel route dns void-main void-main.yourdomain.com
cloudflared tunnel run void-main
```

## Build and Deploy

### 1. Initial Build

```bash
cd /home/pi/void-main-app

# Build the application
npm run build

# Restart service
sudo rc-service void-main restart
```

### 2. Test Auto-Deployment

```bash
# Test the deployment script manually
./deploy-update.sh

# Check logs
tail -f logs/deployment.log
```

### 3. Test Webhook

Make a change to your repository and push to main branch:

```bash
# On your development machine
echo "# Test change" >> README.md
git add README.md
git commit -m "Test auto-deployment"
git push origin main
```

Check the deployment logs on your Pi:

```bash
tail -f /home/pi/void-main-app/logs/deployment.log
```

## Monitoring and Maintenance

### Check Service Status

```bash
# Service status
sudo rc-service void-main status

# View logs
tail -f /home/pi/void-main-app/logs/app.log

# View deployment logs
tail -f /home/pi/void-main-app/logs/deployment.log

# System resource usage
top
```

### Manual Deployment

```bash
# Trigger manual deployment via API
curl -X POST http://localhost:3000/api/deploy/deploy \
  -H "Authorization: Bearer your-jwt-token"

# Or run script directly
cd /home/pi/void-main-app
./deploy-update.sh
```

### Backup Management

```bash
# List backups
ls -la /home/pi/backups/

# Restore from specific backup
cp -r /home/pi/backups/backup-YYYYMMDD-HHMMSS/* /home/pi/void-main-app/
sudo rc-service void-main restart
```

## Troubleshooting

### Common Issues

1. **Permission Denied on GPIO**
   ```bash
   sudo adduser pi gpio
   sudo adduser pi i2c
   # Logout and login again
   ```

2. **Service Won't Start**
   ```bash
   # Check if build exists
   ls -la /home/pi/void-main-app/dist/
   
   # Rebuild if needed
   cd /home/pi/void-main-app
   npm run build
   ```

3. **Webhook Not Working**
   ```bash
   # Check if port is accessible
   curl http://localhost:3000/health
   
   # Check webhook endpoint
   curl -X POST http://localhost:3000/api/deploy/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

4. **Git Authentication Failed**
   ```bash
   # Test SSH connection
   ssh -T git@github.com
   
   # Re-add SSH key if needed
   ssh-add ~/.ssh/id_ed25519
   ```

### Log Locations

- Application logs: `/home/pi/void-main-app/logs/app.log`
- Error logs: `/home/pi/void-main-app/logs/error.log`
- Deployment logs: `/home/pi/void-main-app/logs/deployment.log`
- Service logs: Use `sudo rc-service void-main status`

### Performance Optimization

```bash
# For Raspberry Pi, consider limiting Node.js memory
export NODE_OPTIONS="--max-old-space-size=512"

# Add to service script if needed
```

## Security Recommendations

1. **Firewall Configuration**
   ```bash
   # Install and configure iptables
   sudo apk add iptables iptables-openrc
   
   # Basic firewall rules
   sudo iptables -A INPUT -i lo -j ACCEPT
   sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
   sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
   sudo iptables -A INPUT -j DROP
   
   # Save rules
   sudo /etc/init.d/iptables save
   sudo rc-update add iptables default
   ```

2. **Regular Updates**
   ```bash
   # Update Alpine packages regularly
   sudo apk update && sudo apk upgrade
   
   # Update Node.js dependencies
   cd /home/pi/void-main-app
   npm audit fix
   ```

3. **Backup Strategy**
   - Automated backups are created before each deployment
   - Consider setting up off-site backups for configuration
   - Regular testing of backup restoration

This setup provides a robust auto-deployment system for your Alpine Linux Raspberry Pi!
