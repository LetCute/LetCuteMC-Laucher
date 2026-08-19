import { useEffect, useRef } from 'react'

interface SkinBodyProps {
  skinUrl: string
  width?: number
  height?: number
  className?: string
}

export function SkinBody({ skinUrl, width = 64, height = 128, className }: SkinBodyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = false
      
      const scaleX = width / 16
      const scaleY = height / 32

      // Head
      ctx.drawImage(img, 8, 8, 8, 8, 4 * scaleX, 0 * scaleY, 8 * scaleX, 8 * scaleY)
      ctx.drawImage(img, 40, 8, 8, 8, 4 * scaleX, 0 * scaleY, 8 * scaleX, 8 * scaleY) // Hat
      
      // Body
      ctx.drawImage(img, 20, 20, 8, 12, 4 * scaleX, 8 * scaleY, 8 * scaleX, 12 * scaleY)
      if (img.height === 64) ctx.drawImage(img, 20, 36, 8, 12, 4 * scaleX, 8 * scaleY, 8 * scaleX, 12 * scaleY) // Jacket

      // Right Arm (Left on screen)
      ctx.drawImage(img, 44, 20, 4, 12, 0 * scaleX, 8 * scaleY, 4 * scaleX, 12 * scaleY)
      if (img.height === 64) ctx.drawImage(img, 44, 36, 4, 12, 0 * scaleX, 8 * scaleY, 4 * scaleX, 12 * scaleY) // Right Sleeve

      // Left Arm (Right on screen)
      if (img.height === 64) {
        ctx.drawImage(img, 36, 52, 4, 12, 12 * scaleX, 8 * scaleY, 4 * scaleX, 12 * scaleY)
        ctx.drawImage(img, 52, 52, 4, 12, 12 * scaleX, 8 * scaleY, 4 * scaleX, 12 * scaleY) // Left Sleeve
      } else {
        // Mirror old format
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(img, 44, 20, 4, 12, -16 * scaleX, 8 * scaleY, 4 * scaleX, 12 * scaleY)
        ctx.restore()
      }

      // Right Leg (Left on screen)
      ctx.drawImage(img, 4, 20, 4, 12, 4 * scaleX, 20 * scaleY, 4 * scaleX, 12 * scaleY)
      if (img.height === 64) ctx.drawImage(img, 4, 36, 4, 12, 4 * scaleX, 20 * scaleY, 4 * scaleX, 12 * scaleY) // Right Pants

      // Left Leg (Right on screen)
      if (img.height === 64) {
        ctx.drawImage(img, 20, 52, 4, 12, 8 * scaleX, 20 * scaleY, 4 * scaleX, 12 * scaleY)
        ctx.drawImage(img, 4, 52, 4, 12, 8 * scaleX, 20 * scaleY, 4 * scaleX, 12 * scaleY) // Left Pants
      } else {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(img, 4, 20, 4, 12, -12 * scaleX, 20 * scaleY, 4 * scaleX, 12 * scaleY)
        ctx.restore()
      }
    }
    
    // Convert to https to avoid mixed content
    let finalUrl = skinUrl
    if (finalUrl.startsWith('http://textures.minecraft.net')) {
      finalUrl = finalUrl.replace('http://', 'https://')
    }
    img.src = finalUrl
  }, [skinUrl, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height, imageRendering: 'pixelated' }}
    />
  )
}
