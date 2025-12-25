export interface SwarmConfig {
    apiUrl: string;
    defaultWorkingDir: string;
}
export interface RunnerConfig {
    runnerToken: string;
    runnerName: string;
    anthropicApiKey: string;
    pollInterval: number;
    maxIterations: number;
}
export declare function loadConfig(): SwarmConfig;
export declare function hasValidConfig(): boolean;
export declare function displayConfig(): void;
export declare function createConfig(options?: {
    global?: boolean;
}): Promise<void>;
export declare function getRunnerConfig(): RunnerConfig;
export declare function setRunnerConfig(updates: Partial<RunnerConfig>): void;
export declare function clearRunnerConfig(): void;
export declare function isRunnerConfigured(): boolean;
export declare function getRunnerConfigPath(): string;
//# sourceMappingURL=config.d.ts.map