export declare class CronScheduler {
    private intervalId?;
    start(): void;
    stop(): void;
    private pollScheduledJobs;
}
