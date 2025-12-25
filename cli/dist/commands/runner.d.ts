export interface RunnerRegisterOptions {
    name?: string;
}
export declare function runnerRegisterCommand(options: RunnerRegisterOptions): Promise<void>;
export interface RunnerStartOptions {
    dir?: string;
    once?: boolean;
}
export declare function runnerStartCommand(options: RunnerStartOptions): Promise<void>;
export declare function runnerStatusCommand(): Promise<void>;
//# sourceMappingURL=runner.d.ts.map