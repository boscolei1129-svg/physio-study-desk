# Browser OCR

- `tesseract.min.js` and `worker.min.js` come from the `tesseract.js` 6.0.1 npm package. Its source and licence are at https://github.com/naptha/tesseract.js/tree/v6.0.1.
- `tesseract-core-lstm.wasm.js` comes from the `tesseract.js-core` 6.0.0 npm package. It bundles the browser OCR WebAssembly core with its JavaScript loader. Source is at https://github.com/naptha/tesseract.js-core.
- `eng.traineddata.gz` comes from the Apache-licensed `@tesseract.js-data/eng` 1.0.0 `4.0.0_best_int` distribution. It is an integerised build of https://github.com/tesseract-ocr/tessdata_best, documented at https://github.com/naptha/tessdata.

The engine, worker and model are served from this app's origin. Recognition happens inside the browser, with no request containing the source image or detected text. The scanner is loaded on demand.
