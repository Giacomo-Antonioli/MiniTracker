/** A colour family (red, blue, bone…) for a hex colour, for brands whose data has none. */
export function colourFamily(hex: string, type?: string): string {
  if (type === 'metallic') return 'metallic'
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (l < 0.12) return 'black'
  if (l > 0.9 && s < 0.5) return 'white'
  let h = 0
  if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)
  if (h < 0) h += 360
  if (s < 0.15) return 'grey'
  if (h >= 20 && h < 50 && s < 0.45 && l > 0.6) return 'bone'
  if ((h < 35 || h >= 350) && s >= 0.3 && s < 0.85 && l >= 0.55 && l < 0.85) return 'skin'
  if (h >= 10 && h < 45 && l < 0.45) return 'brown'
  if (h < 15 || h >= 345) return 'red'
  if (h < 45) return 'orange'
  if (h < 70) return 'yellow'
  if (h < 160) return 'green'
  if (h < 195) return 'teal'
  if (h < 255) return 'blue'
  if (h < 290) return 'purple'
  return 'pink'
}
