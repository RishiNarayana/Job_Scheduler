"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_js_1 = require("./connection.js");
const User_js_1 = require("../models/User.js");
const Organization_js_1 = require("../models/Organization.js");
const OrganizationMember_js_1 = require("../models/OrganizationMember.js");
const Project_js_1 = require("../models/Project.js");
const RetryPolicy_js_1 = require("../models/RetryPolicy.js");
const Queue_js_1 = require("../models/Queue.js");
const Job_js_1 = require("../models/Job.js");
const ScheduledJob_js_1 = require("../models/ScheduledJob.js");
const Worker_js_1 = require("../models/Worker.js");
async function migrate() {
    console.log('Running MongoDB Schema migrations (ensuring indexes)...');
    await (0, connection_js_1.connectDB)();
    // Wait for all models to finish building indexes
    await Promise.all([
        User_js_1.User.init(),
        Organization_js_1.Organization.init(),
        OrganizationMember_js_1.OrganizationMember.init(),
        Project_js_1.Project.init(),
        RetryPolicy_js_1.RetryPolicy.init(),
        Queue_js_1.Queue.init(),
        Job_js_1.Job.init(),
        ScheduledJob_js_1.ScheduledJob.init(),
        Worker_js_1.Worker.init(),
    ]);
    console.log('MongoDB Indexes verified and created successfully!');
    await (0, connection_js_1.disconnectDB)();
}
migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
