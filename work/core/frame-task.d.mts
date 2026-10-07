export interface FrameTask<T> {
  request(value: T): void;
  cancel(): void;
  flush(): void;
}

export interface FrameTaskOptions {
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
}

export function createFrameTask<T>(
  run: (value: T | undefined) => void,
  options: FrameTaskOptions,
): FrameTask<T>;
