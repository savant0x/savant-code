import { MAX_IMAGE_BASE64_SIZE } from '@savant-code/common/constants/images'
import { Jimp } from 'jimp'

import { logger } from './logger'

export interface CompressionResult {
  success: boolean
  buffer?: Buffer
  base64?: string
  mediaType?: string
  width?: number
  height?: number
  error?: string
}

// Compression settings for iterative compression
const COMPRESSION_QUALITIES = [85, 70, 50, 30]
const DIMENSION_LIMITS = [1500, 1200, 800, 600]

/**
 * Attempts to compress an image to fit within the max base64 size.
 * Tries different dimension/quality combinations until one fits.
 */
export async function compressImageToFitSize(
  fileBuffer: Buffer,
): Promise<CompressionResult> {
  const image = await Jimp.read(fileBuffer)
  const originalWidth = image.bitmap.width
  const originalHeight = image.bitmap.height

  let bestBase64Size = Infinity
  let attemptCount = 0

  for (const maxDimension of DIMENSION_LIMITS) {
    for (const quality of COMPRESSION_QUALITIES) {
      attemptCount++

      const testImage = await Jimp.read(fileBuffer)

      // Resize if needed (preserve aspect ratio)
      if (originalWidth > maxDimension || originalHeight > maxDimension) {
        if (originalWidth > originalHeight) {
          testImage.resize({ w: maxDimension })
        } else {
          testImage.resize({ h: maxDimension })
        }
      }

      const testBuffer = await testImage.getBuffer('image/jpeg', { quality })
      const testBase64 = testBuffer.toString('base64')
      const testBase64Size = testBase64.length

      // Track best attempt
      if (testBase64Size < bestBase64Size) {
        bestBase64Size = testBase64Size
      }

      // If this attempt fits, use it
      if (testBase64Size <= MAX_IMAGE_BASE64_SIZE) {
        logger.debug(
          {
            originalSize: fileBuffer.length,
            finalSize: testBuffer.length,
            finalDimensions: `${testImage.bitmap.width}x${testImage.bitmap.height}`,
            quality,
            attempts: attemptCount,
          },
          'Image handler: Successful compression found',
        )

        return {
          success: true,
          buffer: testBuffer,
          base64: testBase64,
          mediaType: 'image/jpeg',
          width: testImage.bitmap.width,
          height: testImage.bitmap.height,
        }
      }
    }
  }

  // No compression attempt succeeded
  const bestSizeKB = (bestBase64Size / 1024).toFixed(1)
  const maxKB = (MAX_IMAGE_BASE64_SIZE / 1024).toFixed(1)
  const originalKB = (fileBuffer.toString('base64').length / 1024).toFixed(1)

  return {
    success: false,
    error: `Image too large even after ${attemptCount} compression attempts. Original: ${originalKB}KB, best compressed: ${bestSizeKB}KB (max ${maxKB}KB). Try using a smaller image.`,
  }
}
