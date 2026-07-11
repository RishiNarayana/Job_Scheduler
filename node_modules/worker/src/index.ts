import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../../api/src/db/connection.js';
import { JobWorkerNode } from './worker.js';
import { JobProcessor } from './processor.js';
import { CronScheduler } from './scheduler.js';

dotenv.config();

async function bootstrap() {
  console.log('Bootstrapping job scheduler background worker...');
  await connectDB();

  // Initialize Worker Node registration & heartbeat
  const workerNode = new JobWorkerNode();
  await workerNode.register();

  // Initialize and start Cron Scheduler
  const scheduler = new CronScheduler();
  scheduler.start();

  // Initialize and start Processor loop
  const processor = new JobProcessor(workerNode.id);
  
  // Run processor in background (not blocking bootstrap loop)
  processor.start();

  // Handle graceful shutdowns
  const handleShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    processor.stop();
    scheduler.stop();
    await workerNode.deregister();
    await disconnectDB();
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
