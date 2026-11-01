/** Longest side of the display copy, in pixels. */
export const DISPLAY_MAX = 1600

export interface DisplayCopy {
  blob: Blob
  width: number
  height: number
}

/**
 * Makes the compressed copy shown in the app (WebP, JPEG as fallback). The original is never changed.
 * Browser-only (canvas); tests replace this module.
 */
export async function makeDisplayCopy(file: Blob, maxSide = DISPLAY_MAX): Promise<DisplayCopy> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error("This browser can't read this image format (for example HEIC on some browsers). Try a JPEG or PNG.")
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const width = Math.round(bmp.width * scale)
  const height = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height)
  bmp.close()
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q))
  const webp = await toBlob('image/webp', 0.82)
  const blob = webp && webp.type === 'image/webp' ? webp : await toBlob('image/jpeg', 0.85)
  if (!blob) throw new Error('Could not compress this image')
  return { blob, width, height }
}

/** File extension for a MIME type or file name. */
export function extensionOf(file: { type: string; name?: string }): string {
  const fromName = file.name?.match(/\.([a-z0-9]{2,5})$/i)?.[1]
  if (fromName) return fromName.toLowerCase()
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif' } as Record<string, string>)[file.type] ?? 'img'
}
