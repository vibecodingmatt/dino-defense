"use strict";

importScripts("zxing-reader-3.1.1.js");

let readyPromise = null;

function prepare() {
  if (!readyPromise) {
    const wasmUrl = new URL("zxing-reader-3.1.1.wasm", self.location.href).href;
    readyPromise = self.ZXingWASM.prepareZXingModule({
      overrides: {
        locateFile: (path, prefix) => path.endsWith(".wasm") ? wasmUrl : prefix + path,
      },
      fireImmediately: true,
    });
  }
  return readyPromise;
}

self.addEventListener("message", async (event) => {
  const message = event.data || {};
  try {
    if (message.type === "init") {
      await prepare();
      self.postMessage({ type: "ready", id: message.id });
      return;
    }

    if (message.type !== "decode") return;
    await prepare();
    const image = {
      width: message.width,
      height: message.height,
      data: new Uint8ClampedArray(message.buffer),
    };
    const results = await self.ZXingWASM.readBarcodes(image, message.options);
    self.postMessage({
      type: "result",
      id: message.id,
      results: results.map((result) => ({
        format: result.format,
        text: result.text,
      })),
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
