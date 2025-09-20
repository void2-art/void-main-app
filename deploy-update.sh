#!/bin/sh

# Auto-deployment script for Alpine Linux
# This script is triggered by GitHub webhooks to update the application

set -e

# Configuration
REPO_DIR="/home/pi/void-main-app"
BACKUP_DIR="/home/pi/backups"
LOG_FILE="/home/pi/void-main-app/logs/deployment.log"
SERVICE_NAME="void-main"
BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
    log "[INFO] $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    log "[WARN] $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log "[ERROR] $1"
}

# Create directories if they don't exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

log_info "=== Starting auto-deployment ==="
log_info "Commit ID: ${COMMIT_ID:-unknown}"
log_info "Commit Message: ${COMMIT_MESSAGE:-unknown}"
log_info "Author: ${AUTHOR:-unknown}"

# Check if we're in the correct directory
if [ ! -f "$REPO_DIR/package.json" ]; then
    log_error "package.json not found in $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

# Detect if we should use doas or sudo
if command -v doas >/dev/null 2>&1; then
    SUDO_CMD="doas"
elif command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
else
    SUDO_CMD=""
    log_warn "Neither doas nor sudo found, will try direct service commands"
fi

# Function to check if service exists and is running
check_service() {
    if rc-service "$SERVICE_NAME" status >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to stop service
stop_service() {
    if check_service; then
        log_info "Stopping $SERVICE_NAME service..."
        if [ -n "$SUDO_CMD" ]; then
            if $SUDO_CMD rc-service "$SERVICE_NAME" stop; then
                log_info "Service stopped successfully"
            else
                log_warn "Failed to stop service, continuing anyway..."
            fi
        else
            if rc-service "$SERVICE_NAME" stop; then
                log_info "Service stopped successfully"
            else
                log_warn "Failed to stop service, continuing anyway..."
            fi
        fi
    else
        log_warn "Service $SERVICE_NAME not found or not running"
    fi
}

# Function to start service
start_service() {
    log_info "Starting $SERVICE_NAME service..."
    if [ -n "$SUDO_CMD" ]; then
        if $SUDO_CMD rc-service "$SERVICE_NAME" start; then
            log_info "Service started successfully"
        else
            log_error "Failed to start service"
            return 1
        fi
    else
        if rc-service "$SERVICE_NAME" start; then
            log_info "Service started successfully"
        else
            log_error "Failed to start service"
            return 1
        fi
    fi
}

# Function to create backup
create_backup() {
    log_info "Creating backup..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    # Create backup of current dist directory and node_modules
    mkdir -p "$BACKUP_PATH"
    if [ -d "dist" ]; then
        cp -r dist "$BACKUP_PATH/"
    fi
    if [ -d "node_modules" ]; then
        cp -r node_modules "$BACKUP_PATH/"
    fi
    cp package.json "$BACKUP_PATH/" 2>/dev/null || true
    cp package-lock.json "$BACKUP_PATH/" 2>/dev/null || true
    
    log_info "Backup created at $BACKUP_PATH"
    echo "$BACKUP_PATH" > .last-backup
}

# Function to restore backup
restore_backup() {
    if [ -f ".last-backup" ]; then
        BACKUP_PATH=$(cat .last-backup)
        if [ -d "$BACKUP_PATH" ]; then
            log_warn "Restoring from backup: $BACKUP_PATH"
            rm -rf dist node_modules
            cp -r "$BACKUP_PATH"/* .
            log_info "Backup restored"
        else
            log_error "Backup directory not found: $BACKUP_PATH"
        fi
    else
        log_error "No backup information found"
    fi
}

# Function to cleanup old backups (keep last 5)
cleanup_backups() {
    log_info "Cleaning up old backups..."
    cd "$BACKUP_DIR"
    ls -1t | tail -n +6 | xargs -r rm -rf
    cd "$REPO_DIR"
}

# Function to validate deployment
validate_deployment() {
    log_info "Validating deployment..."
    
    # Check if dist directory exists and has files
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        log_error "Deployment validation failed: dist directory is empty"
        return 1
    fi
    
    # Check if main entry point exists
    if [ ! -f "dist/index.js" ]; then
        log_error "Deployment validation failed: index.js not found"
        return 1
    fi
    
    log_info "Deployment validation successful"
    return 0
}

# Main deployment process
deploy() {
    # Create backup before deployment
    create_backup
    
    # Stop the service
    stop_service
    
    # Stash any local changes
    log_info "Stashing local changes..."
    git stash push -m "Auto-stash before deployment $(date)"
    
    # Fetch latest changes
    log_info "Fetching latest changes from GitHub..."
    git fetch origin
    
    # Reset to latest main branch
    log_info "Resetting to origin/$BRANCH..."
    git reset --hard "origin/$BRANCH"
    
    # Clean up any untracked files
    git clean -fd
    
    # Install/update dependencies
    log_info "Installing dependencies..."
    if command -v npm >/dev/null 2>&1; then
        npm ci --production --silent
    else
        log_error "npm not found"
        return 1
    fi
    
    # Build the application
    log_info "Building application..."
    npm run build
    
    # Validate deployment
    if ! validate_deployment; then
        log_error "Deployment validation failed"
        return 1
    fi
    
    # Update deployment info
    cat > .deployment-info.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "commit": "${COMMIT_ID:-unknown}",
  "message": "${COMMIT_MESSAGE:-unknown}",
  "author": "${AUTHOR:-unknown}",
  "branch": "$BRANCH",
  "success": true
}
EOF
    
    # Start the service
    if ! start_service; then
        log_error "Failed to start service after deployment"
        return 1
    fi
    
    # Wait a moment and check if service is still running
    sleep 5
    if check_service; then
        log_info "Service is running successfully"
    else
        log_error "Service failed to start properly"
        return 1
    fi
    
    # Cleanup old backups
    cleanup_backups
    
    log_info "=== Deployment completed successfully ==="
    return 0
}

# Error handling
handle_error() {
    log_error "Deployment failed!"
    log_warn "Attempting to restore from backup..."
    
    restore_backup
    
    # Try to start service with restored backup
    if start_service; then
        log_info "Service restored from backup"
    else
        log_error "Failed to restore service"
    fi
    
    # Update deployment info with failure
    cat > .deployment-info.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "commit": "${COMMIT_ID:-unknown}",
  "message": "${COMMIT_MESSAGE:-unknown}",
  "author": "${AUTHOR:-unknown}",
  "branch": "$BRANCH",
  "success": false,
  "error": "Deployment failed and was rolled back"
}
EOF
    
    exit 1
}

# Set up error handling
trap handle_error ERR

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if git is available
if ! command -v git >/dev/null 2>&1; then
    log_error "git is not installed"
    exit 1
fi

# Check if npm is available
if ! command -v npm >/dev/null 2>&1; then
    log_error "npm is not installed"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check git status
if ! git status >/dev/null 2>&1; then
    log_error "Git repository is in a bad state"
    exit 1
fi

# Check network connectivity
if ! ping -c 1 github.com >/dev/null 2>&1; then
    log_error "No network connectivity to GitHub"
    exit 1
fi

log_info "Pre-deployment checks passed"

# Run the deployment
deploy

log_info "Auto-deployment script completed successfully"
