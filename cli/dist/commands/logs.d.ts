export interface LogsOptions {
    lines?: string;
    follow?: boolean;
    type?: string;
}
export declare function logsCommand(agentId: string | undefined, options: LogsOptions): Promise<void>;
//# sourceMappingURL=logs.d.ts.map