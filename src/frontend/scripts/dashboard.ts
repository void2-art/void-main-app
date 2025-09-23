// Dashboard API client for Void Main IoT system

// Type declarations for browser environment
declare const document: any;
declare const window: any;
declare const alert: any;
declare const fetch: any;
declare type HTMLDivElement = any;
declare type HTMLInputElement = any;
declare type KeyboardEvent = any;

interface SensorData {
    id: string;
    value: number;
    unit: string;
    timestamp: Date;
    status: string;
}

interface SystemStatus {
    isSimulation: boolean;
    sensorCount: number;
    hardwareAvailable: boolean;
    lastUpdate: Date;
}

interface SensorInfo {
    id: string;
    type: string;
    status: string;
    isSimulated: boolean;
}

interface ApiResponse<T> {
    sensors?: SensorInfo[];
    systemStatus?: SystemStatus;
    message?: string;
    data?: T;
}

interface SystemInfo {
    nodeVersion: string;
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    memory: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
    };
    loadAverage: number[];
    networkInterfaces: Record<string, any[]>;
}

class DashboardManager {
    private refreshInterval: number | null = null;

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        document.addEventListener('DOMContentLoaded', () => {
            this.refreshData();
            this.startAutoRefresh();
        });

        // Handle page visibility changes to pause/resume auto-refresh
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
            }
        });
    }

    private startAutoRefresh(): void {
        this.refreshInterval = window.setInterval(() => {
            this.refreshData();
        }, 5000);
    }

    private stopAutoRefresh(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    public async refreshData(): Promise<void> {
        await Promise.all([
            this.loadSensorData(),
            this.loadSystemInfo()
        ]);
    }

    private async loadSensorData(): Promise<void> {
        try {
            const response = await fetch('/api/sensors');
            const data = await response.json() as ApiResponse<SensorInfo[]>;
            
            const sensorGrid = document.getElementById('sensorGrid');
            if (!sensorGrid) return;
            
            // Update header with system status
            const sensorHeader = document.querySelector('.card-header h3');
            if (data.systemStatus && sensorHeader) {
                const statusIcon = data.systemStatus.isSimulation ? 'fa-microchip' : 'fa-plug';
                const statusText = data.systemStatus.isSimulation ? 'Simulated' : 'Hardware';
                sensorHeader.innerHTML = `Sensor Data (${statusText})`;
                const icon = sensorHeader.parentElement?.querySelector('i');
                if (icon) {
                    icon.className = `fas ${statusIcon}`;
                }
            }
            
            if (data.sensors && data.sensors.length > 0) {
                sensorGrid.innerHTML = '';
                
                // Add system status info
                if (data.systemStatus) {
                    const statusDiv = this.createStatusDiv(data.systemStatus, data.message);
                    sensorGrid.appendChild(statusDiv);
                }
                
                for (const sensor of data.sensors) {
                    try {
                        const sensorResponse = await fetch(`/api/sensors/${sensor.id}`);
                        const sensorData = await sensorResponse.json() as SensorData;
                        
                        const sensorItem = this.createSensorItem(sensor, sensorData);
                        sensorGrid.appendChild(sensorItem);
                    } catch (error) {
                        console.error(`Error loading sensor ${sensor.id}:`, error);
                        
                        const errorItem = this.createErrorSensorItem(sensor);
                        sensorGrid.appendChild(errorItem);
                    }
                }
            } else {
                sensorGrid.innerHTML = '<p>No sensors available</p>';
            }
        } catch (error) {
            console.error('Error loading sensor data:', error);
            const sensorGrid = document.getElementById('sensorGrid');
            if (sensorGrid) {
                sensorGrid.innerHTML = '<p>Error loading sensors</p>';
            }
        }
    }

    private createStatusDiv(systemStatus: SystemStatus, message?: string): HTMLDivElement {
        const statusDiv = document.createElement('div');
        statusDiv.style.gridColumn = '1 / -1';
        statusDiv.style.marginBottom = '15px';
        statusDiv.style.padding = '10px';
        statusDiv.style.backgroundColor = systemStatus.isSimulation ? '#fff3cd' : '#d4edda';
        statusDiv.style.borderRadius = '5px';
        statusDiv.style.fontSize = '0.9rem';
        statusDiv.innerHTML = `
            <strong>Status:</strong> ${message || 'Unknown'}<br>
            <strong>Sensors:</strong> ${systemStatus.sensorCount} active<br>
            <strong>Hardware:</strong> ${systemStatus.hardwareAvailable ? 'Available' : 'Not Available'}
        `;
        return statusDiv;
    }

    private createSensorItem(sensor: SensorInfo, sensorData: SensorData): HTMLDivElement {
        const sensorItem = document.createElement('div');
        sensorItem.className = 'sensor-item';
        
        // Add visual indicator for simulation vs hardware
        const statusIndicator = sensor.isSimulated ? 
            '<i class="fas fa-microchip" style="color: #ffc107; margin-right: 5px;" title="Simulated"></i>' :
            '<i class="fas fa-plug" style="color: #28a745; margin-right: 5px;" title="Hardware"></i>';
        
        sensorItem.innerHTML = `
            <div class="sensor-value">${sensorData.value?.toFixed(1) || 'N/A'}</div>
            <div class="sensor-label">${sensorData.unit || ''}</div>
            <div class="sensor-label">${statusIndicator}${sensor.type}</div>
            <div style="font-size: 0.7rem; color: #888; margin-top: 5px;">
                ${sensor.status} • ${sensor.isSimulated ? 'Sim' : 'HW'}
            </div>
        `;
        return sensorItem;
    }

    private createErrorSensorItem(sensor: SensorInfo): HTMLDivElement {
        const sensorItem = document.createElement('div');
        sensorItem.className = 'sensor-item';
        sensorItem.style.backgroundColor = '#f8d7da';
        sensorItem.innerHTML = `
            <div class="sensor-value">ERR</div>
            <div class="sensor-label">Error</div>
            <div class="sensor-label">${sensor.type}</div>
        `;
        return sensorItem;
    }

    private async loadSystemInfo(): Promise<void> {
        try {
            const response = await fetch('/api/system');
            const data = await response.json() as SystemInfo;
            
            const systemInfo = document.getElementById('systemInfo');
            if (!systemInfo) return;
            
            systemInfo.innerHTML = '';
            
            const info = [
                { label: 'Node.js Version', value: data.nodeVersion || 'Unknown' },
                { label: 'Platform', value: `${data.platform || 'Unknown'} (${data.arch || 'Unknown'})` },
                { label: 'Hostname', value: data.hostname || 'Unknown' },
                { label: 'Uptime', value: this.formatUptime(data.uptime) },
                { label: 'Memory Usage', value: this.formatMemory(data.memory) },
                { label: 'Load Average', value: this.formatLoadAverage(data.loadAverage) },
                { label: 'Status', value: '🟢 Running' }
            ];
            
            info.forEach(item => {
                const infoItem = document.createElement('div');
                infoItem.className = 'info-item';
                infoItem.innerHTML = `
                    <span class="info-label">${item.label}:</span>
                    <span class="info-value">${item.value}</span>
                `;
                systemInfo.appendChild(infoItem);
            });
            
            // Add network interfaces info
            if (data.networkInterfaces) {
                const networkDiv = this.createNetworkInfoDiv(data.networkInterfaces);
                systemInfo.appendChild(networkDiv);
            }
        } catch (error) {
            console.error('Error loading system info:', error);
            const systemInfo = document.getElementById('systemInfo');
            if (systemInfo) {
                systemInfo.innerHTML = '<p>Error loading system info</p>';
            }
        }
    }

    private createNetworkInfoDiv(networkInterfaces: Record<string, any[]>): HTMLDivElement {
        const networkDiv = document.createElement('div');
        networkDiv.style.gridColumn = '1 / -1';
        networkDiv.style.marginTop = '15px';
        networkDiv.style.padding = '10px';
        networkDiv.style.backgroundColor = '#e9ecef';
        networkDiv.style.borderRadius = '5px';
        networkDiv.style.fontSize = '0.8rem';
        
        let networkInfo = '<strong>Network Interfaces:</strong><br>';
        Object.keys(networkInterfaces).forEach(iface => {
            const addresses = networkInterfaces[iface];
            if (addresses) {
                const ipv4 = addresses.find(addr => addr.family === 'IPv4' && !addr.internal);
                if (ipv4) {
                    networkInfo += `${iface}: ${ipv4.address}<br>`;
                }
            }
        });
        
        networkDiv.innerHTML = networkInfo;
        return networkDiv;
    }

    private formatUptime(seconds: number): string {
        if (!seconds) return 'Unknown';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    private formatMemory(memory: SystemInfo['memory']): string {
        if (!memory || !memory.rss) return 'Unknown';
        const mb = Math.round(memory.rss / 1024 / 1024);
        return `${mb} MB`;
    }

    private formatLoadAverage(loadAvg: number[]): string {
        if (!loadAvg || !Array.isArray(loadAvg)) return 'N/A';
        return loadAvg.map(load => load.toFixed(2)).join(', ');
    }

    public async toggleDisplay(): Promise<void> {
        try {
            const response = await fetch('/api/display/status');
            const status = await response.json() as any;
            
            if (status.enabled) {
                await fetch('/api/display/clear', { method: 'POST' });
            } else {
                await fetch('/api/display/dashboard', { method: 'POST' });
            }
            
            alert('Display toggled successfully!');
        } catch (error) {
            console.error('Error toggling display:', error);
            alert('Error toggling display');
        }
    }

    public async clearDisplay(): Promise<void> {
        try {
            await fetch('/api/display/clear', { method: 'POST' });
            alert('Display cleared successfully!');
        } catch (error) {
            console.error('Error clearing display:', error);
            alert('Error clearing display');
        }
    }

    public async takeDashboardSnapshot(): Promise<void> {
        try {
            const response = await fetch('/api/display/screenshot');
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dashboard-${new Date().toISOString().slice(0,19)}.png`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                alert('Screenshot not available');
            }
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('Error taking screenshot');
        }
    }

    public handleChatKeyPress(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            this.sendChatMessage();
        }
    }

    public async sendChatMessage(): Promise<void> {
        const input = document.getElementById('chatInput') as HTMLInputElement;
        const message = input?.value.trim();
        
        if (!message) return;
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Add user message
        chatMessages.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
        input.value = '';
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            
            if (response.ok) {
                const data = await response.json() as any;
                chatMessages.innerHTML += `<p><strong>AI:</strong> ${data.response}</p>`;
            } else {
                chatMessages.innerHTML += `<p><strong>AI:</strong> Sorry, I'm having trouble right now. Please try again later.</p>`;
            }
        } catch (error) {
            console.error('Error sending chat message:', error);
            chatMessages.innerHTML += `<p><strong>AI:</strong> Connection error. Please check your connection and try again.</p>`;
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Initialize dashboard
const dashboard = new DashboardManager();

// Global functions for HTML onclick handlers
(window as any).refreshData = () => dashboard.refreshData();
(window as any).toggleDisplay = () => dashboard.toggleDisplay();
(window as any).clearDisplay = () => dashboard.clearDisplay();
(window as any).takeDashboardSnapshot = () => dashboard.takeDashboardSnapshot();
(window as any).sendChatMessage = () => dashboard.sendChatMessage();
(window as any).handleChatKeyPress = (event: KeyboardEvent) => dashboard.handleChatKeyPress(event);
