import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library'
import jsQR from 'jsqr'

const reader = new MultiFormatReader()
reader.setHints(new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  [DecodeHintType.TRY_HARDER, true],
]))

/** Reads a QR (MiniTracker labels) or a box barcode (EAN/UPC) from an RGBA frame. */
export function decodeFrame(data: Uint8ClampedArray, width: number, height: number): string | undefined {
  const qr = jsQR(data, width, height)
  if (qr?.data) return qr.data
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height)))).getText()
  } catch {
    return undefined
  }
}
