// Klijentska kompresija videa preko ffmpeg.wasm — aplikacija nema backend
// server (vidi CLAUDE.md), pa je ovo jedini način da se video stvarno
// prekodira (niža rezolucija/bitrate) bez ičega van browsera.
//
// ffmpeg-core.wasm (~32MB) NIJE u glavnom bundle-u — kopira se iz
// node_modules u dist preko angular.json assets glob-a i učitava lijeno,
// tek kad korisnik prvi put otpremi video. Service worker ga onda keš-uje
// (ngsw-config.json, "assets" grupa, installMode "lazy").

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = `${document.baseURI.replace(/\/$/, '')}/assets/ffmpeg`;

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }

  return loadPromise;
}

function extensionOf(name: string): string {
  const match = name.match(/\.[^.]+$/);
  return match ? match[0] : '.mp4';
}

// Skalira na max 1280px širine (visina se računa da ostane paran broj — h264 to zahtijeva)
// i umjeren CRF/bitrate. "veryfast" preset je kompromis brzina/veličina, bitan jer se
// sve ovo dešava na klijentovom telefonu, ne na serveru.
export async function compressVideo(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  const ffmpeg = await getFFmpeg();

  const onProgressEvent = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  if (onProgress) ffmpeg.on('progress', onProgressEvent);

  const inputName = `input_${Date.now()}${extensionOf(file.name)}`;
  const outputName = `output_${Date.now()}.mp4`;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale='min(1280,iw)':-2",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as Uint8Array], { type: 'video/mp4' });

    // Ako je "kompresovana" verzija ispala veća (kratak/već kompresovan klip), zadrži original.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.mp4';
    return new File([blob], newName, { type: 'video/mp4' });
  } finally {
    if (onProgress) ffmpeg.off('progress', onProgressEvent);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
