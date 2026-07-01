declare module "@xenova/transformers" {
  export const env: {
    allowLocalModels: boolean;
    useBrowserCache: boolean;
    backends?: {
      onnx?: {
        wasm?: {
          numThreads?: number;
        };
      };
    };
  };

  export function pipeline(
    task: "feature-extraction",
    model: string,
  ): Promise<(input: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array | number[] }>>;
}
