import { useEffect, useRef } from 'react'

interface SkinHeadProps {
  /** Full skin texture URL or data-URL */
  skinUrl: string
  /** Render size in px (square) */
  size?: number
  /** Extra CSS class */
  className?: string
}

/**
 * Renders just the head (face) from a Minecraft skin texture.
 * The face is at (8, 8) → (16, 16) in the skin PNG.
 * The hat overlay is at (40, 8) → (48, 16).
 */
export function SkinHead({ skinUrl, size = 36, className }: SkinHeadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Clear
      ctx.clearRect(0, 0, size, size)

      // Pixel-perfect rendering for small Minecraft textures
      ctx.imageSmoothingEnabled = false

      // Draw face layer (8,8) → (16,16) from the skin
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size)

      // Draw hat overlay layer (40,8) → (48,16) on top
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size)
    }

    img.src = skinUrl
  }, [skinUrl, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}
