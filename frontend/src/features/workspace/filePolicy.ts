export const LIMITS = { count: 12, bytes: 20 * 1024 * 1024, pixels: 40_000_000 } as const
type FileMetadata = Pick<File, 'name' | 'type' | 'size' | 'lastModified'>
export const fileKey = (file: FileMetadata) => `${file.name}:${file.size}:${file.lastModified}`

export function validateFile(file: FileMetadata, existingKeys: string[]): string | null {
  // BMP is common in AIDA-style exports and browsers can preview it. TIFF cannot be previewed in the browser yet.
  if (!['image/jpeg', 'image/png', 'image/bmp'].includes(file.type)) return 'use a JPEG, PNG or BMP image.'
  if (file.size === 0) return 'this file is empty.'
  if (file.size > LIMITS.bytes) return 'the file exceeds the 20 MB limit.'
  if (existingKeys.includes(fileKey(file))) return 'this file is already in your sample.'
  if (existingKeys.length >= LIMITS.count) return 'a sample can contain up to 12 images.'
  return null
}
export function validateDimensions(width: number, height: number): string | null {
  if (width < 1 || height < 1) return 'the image has invalid dimensions.'
  if (width * height > LIMITS.pixels) return 'the image exceeds the 40 megapixel preview limit.'
  return null
}
export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
