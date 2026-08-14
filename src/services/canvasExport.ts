export async function dataUrlToWebp(dataUrl: string, maxBytes = 512 * 1024) {
  const response = await fetch(dataUrl);
  let blob = await response.blob();
  if (blob.size <= maxBytes) return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.78, 0.68, 0.56]) {
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Canvas export failed"))),
        "image/webp",
        quality,
      ),
    );
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error("Artwork is too large to send. Try clearing a little paint.");
}
