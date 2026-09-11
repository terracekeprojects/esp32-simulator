// Runs audio inference in this browser. Network is used only to fetch runtime/model files.
let pipelinePromise;
let busy = false;
async function getTranscriber() {
  if (!pipelinePromise)
    pipelinePromise = (async () => {
      const { pipeline, env } =
        await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        device: 'wasm',
        dtype: 'q8',
        revision: '5332fcc35e32a33b86612b9a57a89be7906102b1',
        progress_callback: (p) =>
          self.postMessage({
            type: 'progress',
            message: p.file
              ? `${p.file}: ${Math.round(p.progress || 0)}%`
              : p.status,
          }),
      });
    })().catch((e) => {
      pipelinePromise = undefined;
      throw e;
    });
  return pipelinePromise;
}
self.onmessage = async ({ data }) => {
  if (busy) {
    self.postMessage({
      type: 'error',
      message: 'A transcription is already running.',
    });
    return;
  }
  busy = true;
  try {
    const transcriber = await getTranscriber();
    if (data.type === 'load') {
      self.postMessage({ type: 'ready' });
      return;
    }
    if (
      !(data.audio instanceof Float32Array) ||
      data.audio.length < 1600 ||
      data.audio.length > 16000 * 60
    )
      throw Error('Audio must be 0.1–60 seconds of mono 16 kHz PCM.');
    self.postMessage({ type: 'processing' });
    const result = await transcriber(data.audio, {
      language: data.language || 'english',
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({
      type: 'result',
      text: result.text,
      chunks: result.chunks || [],
    });
  } catch (e) {
    self.postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    busy = false;
  }
};
