export declare class JobWorkerNode {
    id: string;
    name: string;
    private heartbeatInterval?;
    private concurrencyLimit;
    constructor(name?: string, concurrencyLimit?: number);
    register(): Promise<void>;
    startHeartbeat(): void;
    deregister(): Promise<void>;
}
