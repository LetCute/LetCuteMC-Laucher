import { useEffect, useRef } from 'react'
import { SkinViewer, IdleAnimation } from 'skinview3d'

export type SkinModel = 'default' | 'slim'

/** Local default skins bundled in public/skins/ */
const DEFAULT_STEVE = '/skins/steve.png'
const DEFAULT_ALEX = '/skins/alex.png'

interface SkinViewer3DProps {
  /** URL or data-URL of the skin PNG */
  skinUrl?: string
  /** URL or data-URL of the cape PNG */
  capeUrl?: string
  /** Skin model: 'default' (classic wide arms) or 'slim' (thin arms like Alex) */
  model?: SkinModel
  /** Width in px */
  width?: number
  /** Height in px */
  height?: number
  /** Enable auto-rotate */
  autoRotate?: boolean
  /** Rotation speed (default 0.5) */
  rotateSpeed?: number
  /** CSS class for the canvas wrapper */
  className?: string
}

export function SkinViewer3D({
  skinUrl,
  capeUrl,
  model = 'default',
  width = 120,
  height = 150,
  autoRotate = true,
  rotateSpeed = 0.6,
  className,
}: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<SkinViewer | null>(null)

  // Fall back to Steve (default) or Alex (slim) when no skin is provided
  let resolvedSkin = skinUrl || (model === 'slim' ? DEFAULT_ALEX : DEFAULT_STEVE)
  
  // Fix mixed content issues if Mojang API returns http://
  if (resolvedSkin.startsWith('http://textures.minecraft.net')) {
    resolvedSkin = resolvedSkin.replace('http://', 'https://')
  }
  
  let resolvedCape = capeUrl || undefined
  if (resolvedCape?.startsWith('http://textures.minecraft.net')) {
    resolvedCape = resolvedCape.replace('http://', 'https://')
  }

  useEffect(() => {
    if (!canvasRef.current) return

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      skin: resolvedSkin,
      cape: resolvedCape,
      model: model === 'slim' ? 'slim' : 'default',
    })

    // Set nice defaults
    viewer.autoRotate = autoRotate
    viewer.autoRotateSpeed = rotateSpeed
    viewer.animation = new IdleAnimation()
    // Camera position — pull back so full body is visible
    viewer.camera.position.set(0, 0, 58)
    viewer.fov = 50

    viewer.camera.lookAt(0, 2, 0)

    // Transparent background
    viewer.renderer.setClearColor(0x000000, 0)

    viewerRef.current = viewer

    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
    // Re-create viewer when skin, cape, or model changes to ensure correct camera + model
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, autoRotate, rotateSpeed, resolvedSkin, capeUrl, model])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, display: 'block' }}
    />
  )
}
