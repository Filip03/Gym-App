// Klijentska kompresija videa preko ffmpeg.wasm — aplikacija nema backend
// server (vidi CLAUDE.md), pa je ovo jedini način da se video stvarno
// prekodira (niža rezolucija/bitrate) bez ičega van browsera.
//
// ffmpeg-core.wasm (~32MB) učitava se sa jsDelivr CDN-a, NE iz našeg build
// outputa — Cloudflare Pages odbija deploy sa pojedinačnim fajlom preko 25MB
// ("Pages only supports files up to 25 MiB in size"), pa fajl ne smije biti
// dio dist-a. Isti princip kao Google Fonts u index.html — spoljni resurs,
// učitava se lijeno tek kad korisnik prvi put otpremi video, i browser ga
// sam keš-uje (CDN šalje dugotrajne cache headere).
//
// Verzija u URL-u (0.12.10) MORA odgovarati @ffmpeg/core verziji instaliranoj
// u package.json — ffmpeg.wasm zahtijeva da JS wrapper i core budu iste verzije.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

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
/**
 * `trim`: isijeci raspon [start, end] u sekundama (Markov zahtjev 12.08.2026)
 * — ide kroz ISTI ffmpeg prolaz kao kompresija (`-ss`/`-to`), pa trimovanje
 * ne košta ništa dodatno. Kad je trim zadat, rezultat se vraća UVIJEK (i da
 * ispadne veći od originala — original bi poništio rez).
 */
export async function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void,
  trim?: { start: number; end: number }
): Promise<File> {
  const ffmpeg = await getFFmpeg();

  const onProgressEvent = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  if (onProgress) ffmpeg.on('progress', onProgressEvent);

  const inputName = `input_${Date.now()}${extensionOf(file.name)}`;
  const outputName = `output_${Date.now()}.mp4`;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const args = ['-i', inputName];
    // -ss/-to POSLIJE -i: sporije (dekodira do reza) ali tačno u kadar —
    // klipovi iz teretane su kratki, tačnost je bitnija.
    if (trim) args.push('-ss', trim.start.toFixed(2), '-to', trim.end.toFixed(2));
    args.push(
      '-vf', "scale='min(1280,iw)':-2",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      outputName
    );
    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as Uint8Array], { type: 'video/mp4' });

    // Ako je "kompresovana" verzija ispala veća (kratak/već kompresovan klip),
    // zadrži original — ali NIKAD kad je zadat trim (original bi poništio rez).
    if (!trim && blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.mp4';
    return new File([blob], newName, { type: 'video/mp4' });
  } finally {
    if (onProgress) ffmpeg.off('progress', onProgressEvent);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
