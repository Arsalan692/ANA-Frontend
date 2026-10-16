// Checks for images chosen in the browser, shared by the workspace (sample fields) and Cell patterns.
// The screening service checks every upload again (backend/app/uploads.py, same limits).

export const LIMITS = { count: 12, bytes: 20 * 1024 * 1024, pixels: 40_000_000 } as const
type FileMetadata = Pick<File, 'name' | 'type' | 'size' | 'lastModified'>
export const fileKey = (file: FileMetadata) => `${file.name}:${file.size}:${file.lastModified}`

/** How many images one batch may hold, and how its messages name it. Cells are single cropped cells, not sample fields. */
const BATCHES = {
  sample: { count: LIMITS.count, duplicate: 'this file is already in your sample.', full: 'a sample can contain up to 12 images.' },
  cells: { count: 24, duplicate: 'this cell image is already in the list.', full: 'up to 24 cell images can be classified at once.' },
} as const
export type Batch = keyof typeof BATCHES
export const CELL_LIMIT = BATCHES.cells.count

export function validateFile(file: FileMetadata, existingKeys: string[], batch: Batch = 'sample'): string | null {
  // BMP is common in AIDA-style exports and browsers can preview it. TIFF cannot be previewed in the browser yet.
  if (!['image/jpeg', 'image/png', 'image/bmp'].includes(file.type)) return 'use a JPEG, PNG or BMP image.'
  if (file.size === 0) return 'this file is empty.'
  if (file.size > LIMITS.bytes) return 'the file exceeds the 20 MB limit.'
  if (existingKeys.includes(fileKey(file))) return BATCHES[batch].duplicate
  if (existingKeys.length >= BATCHES[batch].count) return BATCHES[batch].full
  return null
}
export function validateDimensions(width: number, height: number): string | null {
  if (width < 1 || height < 1) return 'the image has invalid dimensions.'
  if (width * height > LIMITS.pixels) return 'the image exceeds the 40 megapixel preview limit.'
  return null
}

/** Checks one file, then decodes it to prove it is an image and learn its size. Returns the size, or a message for the user. */
export async function inspectImage(file: File, existingKeys: string[], batch: Batch = 'sample'): Promise<{ width: number; height: number } | string> {
  const invalid = validateFile(file, existingKeys, batch)
  if (invalid) return invalid
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    bitmap.close()
    return validateDimensions(width, height) ?? { width, height }
  } catch {
    return 'this image could not be opened. Choose a valid JPEG, PNG or BMP.'
  }
}

export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
