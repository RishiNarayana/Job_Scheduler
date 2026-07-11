export declare class JobProcessor {
    private workerId;
    private running;
    constructor(workerId: string);
    start(): Promise<void>;
    stop(): void;
    private processNextJob;
    private runJob;
}
