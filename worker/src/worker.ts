import os from 'os';
import { Worker } from '../../api/src/models/Worker.js';
import { WorkerHeartbeat } from '../../api/src/models/WorkerHeartbeat.js';

export class JobWorkerNode {
  public id: string = '';
  public name: string;
  private heartbeatInterval?: NodeJS.Timeout;
  private concurrencyLimit: number;

  constructor(name?: string, concurrencyLimit = 5) {
    this.name = name || `worker-${os.hostname()}-${process.pid}`;
    this.concurrencyLimit = concurrencyLimit;
  }

  async register() {
    console.log(`Registering worker node: ${this.name}`);
    const node = await Worker.findOneAndUpdate(
      { name: this.name },
      {
        status: 'active',
        concurrencyLimit: this.concurrencyLimit,
        lastHeartbeatAt: new Date(),
        startedAt: new Date()
      },
      { upsert: true, new: true }
    );
    this.id = node._id.toString();
    this.startHeartbeat();
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await Worker.findByIdAndUpdate(this.id, {
          status: 'active',
          lastHeartbeatAt: new Date()
        });

        // Log worker metrics
        await WorkerHeartbeat.create({
          workerId: this.id,
          metrics: {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            cpuLoad: os.loadavg()
          }
        });
      } catch (err) {
        console.error('Failed to send heartbeat:', err);
      }
    }, 5000);
  }

  async deregister() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    console.log(`Deregistering worker node: ${this.name}`);
    try {
      await Worker.findByIdAndUpdate(this.id, {
        status: 'offline',
        lastHeartbeatAt: new Date()
      });
    } catch (err) {
      console.error('Failed to deregister worker:', err);
    }
  }
}
