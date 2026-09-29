import { describe, expect, it } from 'vitest'
import { fileKey, LIMITS, validateDimensions, validateFile } from './filePolicy'

const image = { name: 'field.png', type: 'image/png', size: 1024, lastModified: 1 }

describe('sample image policy', () => {
  it('accepts PNG and JPEG within the configured limits', () => {
    expect(validateFile(image, [])).toBeNull()
    expect(validateFile({ ...image, name: 'field.jpg', type: 'image/jpeg', size: LIMITS.bytes }, [])).toBeNull()
  })
  it('rejects unsupported, empty, oversized, and repeated files', () => {
    expect(validateFile({ ...image, type: 'image/svg+xml' }, [])).toContain('JPEG or PNG')
    expect(validateFile({ ...image, size: 0 }, [])).toContain('empty')
    expect(validateFile({ ...image, size: LIMITS.bytes + 1 }, [])).toContain('20 MB')
    expect(validateFile(image, [fileKey(image)])).toContain('already')
  })
  it('enforces the sample limit without treating a matching filename alone as a duplicate', () => {
    expect(validateFile(image, Array.from({ length: LIMITS.count }, (_, i) => String(i)))).toContain('12 images')
    expect(validateFile({ ...image, size: 2048 }, [fileKey(image)])).toBeNull()
  })
  it('limits decoded dimensions', () => {
    expect(validateDimensions(8000, 5000)).toBeNull()
    expect(validateDimensions(8001, 5000)).toContain('40 megapixel')
    expect(validateDimensions(0, 300)).toContain('invalid')
  })
})
