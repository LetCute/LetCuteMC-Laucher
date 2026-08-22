import { useEffect, useRef } from 'react'

interface CapePreviewProps {
  /** Full cape texture URL or data-URL */
  capeUrl: string
  /** Render width in px */
  width?: number
  /** Render height in px */
  height?: number
  /** Extra CSS class */
  className?: string
}

/**
 * Renders just the back/front of a Minecraft cape texture.
 * The cape pattern (front/back) is usually at X:1, Y:1 (Front) or X:12, Y:1 (Back)
 * with a width of 10 and height of 16 in the 64x32 texture.
 */
export function CapePreview({ capeUrl, width = 20, height = 32, className }: CapePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !capeUrl) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let finalUrl = capeUrl
    if (finalUrl.startsWith('http://textures.minecraft.net')) {
      finalUrl = finalUrl.replace('http://', 'https://')
    }

    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 1, 1, 10, 16, 0, 0, width, height)
    }

    img.onerror = () => {
      if (window.launcherApi?.fetchMojangTexture) {
        window.launcherApi.fetchMojangTexture(finalUrl).then((base64) => {
          if (base64) {
            const fallbackImg = new Image()
            fallbackImg.onload = () => {
              ctx.clearRect(0, 0, width, height)
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(fallbackImg, 1, 1, 10, 16, 0, 0, width, height)
            }
            fallbackImg.src = base64
          }
        })
      }
    }

    img.src = finalUrl
  }, [capeUrl, width, height])

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
