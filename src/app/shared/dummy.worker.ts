/// <reference lib="webworker" />

// Ovaj fajl se nigdje ne uvozi. Postoji samo da bi tsconfig.worker.json imao
// bar jedan fajl koji odgovara "src/**/*.worker.ts" — bez toga TypeScript baca
// "No inputs were found", a webWorkerTsConfig opcija u angular.json postoji
// isključivo da uključi webpackovu ugrađenu podršku za `new Worker(new URL(...))`,
// koju koristi @ffmpeg/ffmpeg (video-compress.ts) za svoj interni worker.

addEventListener('message', ({ data }) => {
  postMessage(data);
});
