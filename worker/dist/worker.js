"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobWorkerNode = void 0;
const os_1 = __importDefault(require("os"));
const Worker_js_1 = require("../../api/src/models/Worker.js");
const WorkerHeartbeat_js_1 = require("../../api/src/models/WorkerHeartbeat.js");
class JobWorkerNode {
    id = '';
    name;
    heartbeatInterval;
    concurrencyLimit;
    constructor(name, concurrencyLimit = 5) {
        this.name = name || `worker-${os_1.default.hostname()}-${process.pid}`;
        this.concurrencyLimit = concurrencyLimit;
    }
    async register() {
        console.log(`Registering worker node: ${this.name}`);
        const node = await Worker_js_1.Worker.findOneAndUpdate({ name: this.name }, {
            status: 'active',
            concurrencyLimit: this.concurrencyLimit,
            lastHeartbeatAt: new Date(),
            startedAt: new Date()
        }, { upsert: true, new: true });
        this.id = node._id.toString();
        this.startHeartbeat();
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                await Worker_js_1.Worker.findByIdAndUpdate(this.id, {
                    status: 'active',
                    lastHeartbeatAt: new Date()
                });
                // Log worker metrics
                await WorkerHeartbeat_js_1.WorkerHeartbeat.create({
                    workerId: this.id,
                    metrics: {
                        memoryUsage: process.memoryUsage(),
                        uptime: process.uptime(),
                        cpuLoad: os_1.default.loadavg()
                    }
                });
            }
            catch (err) {
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
            await Worker_js_1.Worker.findByIdAndUpdate(this.id, {
                status: 'offline',
                lastHeartbeatAt: new Date()
            });
        }
        catch (err) {
            console.error('Failed to deregister worker:', err);
        }
    }
}
exports.JobWorkerNode = JobWorkerNode;
