declare const currentFrame: number;

declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

declare function registerProcessor(
  name: string, processor: new () => AudioWorkletProcessor,
): void;
