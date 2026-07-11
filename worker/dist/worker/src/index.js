"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const connection_js_1 = require("../../api/src/db/connection.js");
const worker_js_1 = require("./worker.js");
const processor_js_1 = require("./processor.js");
const scheduler_js_1 = require("./scheduler.js");
dotenv_1.default.config();
async function bootstrap() {
    console.log('Bootstrapping job scheduler background worker...');
    await (0, connection_js_1.connectDB)();
    // Initialize Worker Node registration & heartbeat
    const workerNode = new worker_js_1.JobWorkerNode();
    await workerNode.register();
    // Initialize and start Cron Scheduler
    const scheduler = new scheduler_js_1.CronScheduler();
    scheduler.start();
    // Initialize and start Processor loop
    const processor = new processor_js_1.JobProcessor(workerNode.id);
    // Run processor in background (not blocking bootstrap loop)
    processor.start();
    // Handle graceful shutdowns
    const handleShutdown = async (signal) => {
        console.log(`Received ${signal}. Starting graceful shutdown...`);
        processor.stop();
        scheduler.stop();
        await workerNode.deregister();
        await (0, connection_js_1.disconnectDB)();
        console.log('Worker processes stopped. Exiting.');
        process.exit(0);
    };
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
bootstrap().catch((err) => {
    console.error('Fatal error during bootstrap:', err);
    process.exit(1);
});
