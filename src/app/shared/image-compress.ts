// Klijentska kompresija slika prije otpremanja u Supabase Storage — fotografije
// sa telefona znaju biti 10-20MB, a to nepotrebno troši storage i sporo se učitava.
// Sve se radi u browseru preko Canvas API-ja, bez ikakve zavisnosti.

export async function compressImage(file: File, maxDimension = 1920, quality = 0.82): Promise<File> {
  // GIF se ne dira — canvas hvata samo prvi frejm, pa bi se animacija izgubila.
  if (file.type === 'image/gif') return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

  // Ako je kompresovana verzija ispala veća (npr. slika je već bila mala/kompresovana),
  // zadrži original — nema smisla praviti stvar goru.
  if (!blob || blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}
