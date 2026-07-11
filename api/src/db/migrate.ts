import { connectDB, disconnectDB } from './connection.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { RetryPolicy } from '../models/RetryPolicy.js';
import { Queue } from '../models/Queue.js';
import { Job } from '../models/Job.js';
import { ScheduledJob } from '../models/ScheduledJob.js';
import { Worker } from '../models/Worker.js';

async function migrate() {
  console.log('Running MongoDB Schema migrations (ensuring indexes)...');
  await connectDB();
  
  // Wait for all models to finish building indexes
  await Promise.all([
    User.init(),
    Organization.init(),
    OrganizationMember.init(),
    Project.init(),
    RetryPolicy.init(),
    Queue.init(),
    Job.init(),
    ScheduledJob.init(),
    Worker.init(),
  ]);

  console.log('MongoDB Indexes verified and created successfully!');
  await disconnectDB();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
