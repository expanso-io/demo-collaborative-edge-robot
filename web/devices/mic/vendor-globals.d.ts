interface KeywordResult {
  scores: Float32Array;
  spectrogram: { data: Float32Array; frameSize: number };
}

interface KeywordRecognizer {
  ensureModelLoaded(): Promise<void>;
  recognize(input: Float32Array): Promise<KeywordResult>;
  wordLabels(): string[];
  listen(callback: (result: KeywordResult) => void, config: {
    probabilityThreshold: number;
    invokeCallbackOnNoiseAndUnknown: boolean;
    overlapFactor: number;
    suppressionTimeMillis: number;
    includeSpectrogram: boolean;
    audioTrackConstraints: MediaTrackConstraints;
  }): Promise<void>;
  stopListening(): Promise<void>;
}

declare var tf: object;

declare var speechCommands: {
  create(type: string, vocabulary: undefined, model: string, metadata: string): KeywordRecognizer;
};
