import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import crypto from 'crypto';
import { logger } from '@/utils/logger';

interface GitHubWebhookPayload {
  ref: string;
  repository: {
    name: string;
    full_name: string;
    clone_url: string;
  };
  head_commit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  };
}

export class DeploymentController {
  private router: Router;
  private webhookSecret: string;
  private deploymentInProgress = false;

  constructor() {
    this.router = Router();
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || '';
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/webhook', this.handleWebhook.bind(this));
    this.router.post('/deploy', this.manualDeploy.bind(this));
    this.router.get('/status', this.getDeploymentStatus.bind(this));
    this.router.get('/logs', this.getDeploymentLogs.bind(this));
  }

  private verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('GitHub webhook secret not configured, skipping signature verification');
      return true; // Allow deployment without secret in development
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = JSON.stringify(req.body);

      if (!this.verifySignature(payload, signature)) {
        logger.error('Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const webhookPayload: GitHubWebhookPayload = req.body;

      // Only deploy on push to main branch
      if (webhookPayload.ref !== 'refs/heads/main') {
        logger.info(`Ignoring push to branch: ${webhookPayload.ref}`);
        res.json({ message: 'Ignored - not main branch' });
        return;
      }

      if (this.deploymentInProgress) {
        logger.warn('Deployment already in progress, ignoring webhook');
        res.status(429).json({ error: 'Deployment already in progress' });
        return;
      }

      logger.info(`Received webhook for commit: ${webhookPayload.head_commit.id}`);
      logger.info(`Commit message: ${webhookPayload.head_commit.message}`);

      // Start deployment asynchronously
      this.startDeployment(webhookPayload);

      res.json({
        message: 'Deployment started',
        commit: webhookPayload.head_commit.id,
        branch: 'main'
      });
    } catch (error) {
      logger.error('Webhook handling error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async manualDeploy(req: Request, res: Response): Promise<void> {
    try {
      if (this.deploymentInProgress) {
        res.status(429).json({ error: 'Deployment already in progress' });
        return;
      }

      logger.info('Manual deployment triggered');
      this.startDeployment();

      res.json({ message: 'Manual deployment started' });
    } catch (error) {
      logger.error('Manual deployment error:', error);
      res.status(500).json({ error: 'Failed to start deployment' });
    }
  }

  private async startDeployment(webhookPayload?: GitHubWebhookPayload): Promise<void> {
    this.deploymentInProgress = true;
    const startTime = new Date();

    try {
      logger.info('Starting deployment process...');

      // Run the deployment script
      const deployScript = process.env.DEPLOY_SCRIPT_PATH || './deploy-update.sh';
      
      await this.executeCommand(deployScript, {
        COMMIT_ID: webhookPayload?.head_commit.id || 'manual',
        COMMIT_MESSAGE: webhookPayload?.head_commit.message || 'Manual deployment',
        AUTHOR: webhookPayload?.head_commit.author.name || 'Manual'
      });

      const duration = Date.now() - startTime.getTime();
      logger.info(`Deployment completed successfully in ${duration}ms`);

      // Optionally restart the application
      if (process.env.AUTO_RESTART === 'true') {
        logger.info('Restarting application...');
        setTimeout(() => {
          process.exit(0); // systemd will restart the service
        }, 1000);
      }
    } catch (error) {
      logger.error('Deployment failed:', error);
    } finally {
      this.deploymentInProgress = false;
    }
  }

  private executeCommand(command: string, env: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const childEnv = { ...process.env, ...env };
      
      exec(command, { env: childEnv, timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Command failed: ${command}`);
          logger.error(`Error: ${error.message}`);
          logger.error(`Stderr: ${stderr}`);
          reject(error);
        } else {
          logger.info(`Command succeeded: ${command}`);
          logger.debug(`Stdout: ${stdout}`);
          resolve(stdout);
        }
      });
    });
  }

  private getDeploymentStatus(req: Request, res: Response): void {
    res.json({
      deploymentInProgress: this.deploymentInProgress,
      lastDeployment: this.getLastDeploymentInfo(),
      webhookConfigured: !!this.webhookSecret
    });
  }

  private getDeploymentLogs(req: Request, res: Response): void {
    try {
      const fs = require('fs');
      const logPath = 'logs/deployment.log';
      
      if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf8');
        const lines = logs.split('\n').slice(-100); // Last 100 lines
        res.json({ logs: lines });
      } else {
        res.json({ logs: ['No deployment logs found'] });
      }
    } catch (error) {
      logger.error('Error reading deployment logs:', error);
      res.status(500).json({ error: 'Failed to read logs' });
    }
  }

  private getLastDeploymentInfo(): any {
    try {
      const fs = require('fs');
      const deployInfoPath = '.deployment-info.json';
      
      if (fs.existsSync(deployInfoPath)) {
        return JSON.parse(fs.readFileSync(deployInfoPath, 'utf8'));
      }
    } catch (error) {
      logger.error('Error reading deployment info:', error);
    }
    return null;
  }

  public getRouter(): Router {
    return this.router;
  }
}
