export interface TaskAddOptions {
    description?: string;
    priority?: string;
    risk?: string;
    files?: string;
}
export declare function taskAddCommand(title: string | undefined, options: TaskAddOptions): Promise<void>;
export interface TaskListOptions {
    status?: string;
    limit?: string;
}
export declare function taskListCommand(options: TaskListOptions): Promise<void>;
export declare function taskViewCommand(taskId: string): Promise<void>;
export interface TaskRunOptions {
    dir?: string;
}
export declare function taskRunCommand(taskId: string, options: TaskRunOptions): Promise<void>;
export interface TaskCancelOptions {
    force?: boolean;
}
export declare function taskCancelCommand(taskId: string, options: TaskCancelOptions): Promise<void>;
//# sourceMappingURL=task.d.ts.map