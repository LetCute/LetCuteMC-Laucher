import { useEffect, useRef, useState } from 'react'
import { SkinViewer, IdleAnimation } from 'skinview3d'

export type SkinModel = 'default' | 'slim'

/** Local default skins bundled in public/skins/ */
const DEFAULT_STEVE = './skins/steve.png'
const DEFAULT_ALEX = './skins/alex.png'

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
    viewer.camera.position.set(0, 0, 58)
    viewer.fov = 50
    viewer.camera.lookAt(0, 2, 0)
    viewer.renderer.setClearColor(0x000000, 0)
    
    // Disable zoom
    if (viewer.controls) {
      viewer.controls.enableZoom = false
    }

    viewerRef.current = viewer

    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]) // Re-create only if canvas size changes

  // Dynamically update rotation
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.autoRotate = autoRotate
      viewerRef.current.autoRotateSpeed = rotateSpeed
    }
  }, [autoRotate, rotateSpeed])

  // Dynamically update skin and model
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.loadSkin(resolvedSkin, { model: model === 'slim' ? 'slim' : 'default' }).catch(() => { })
    }
  }, [resolvedSkin, model])

  // Dynamically update cape
  useEffect(() => {
    if (viewerRef.current) {
      if (resolvedCape) {
        viewerRef.current.loadCape(resolvedCape).catch(() => { })
      } else {
        viewerRef.current.resetCape()
      }
    }
  }, [resolvedCape])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, display: 'block' }}
    />
  )
}

export function LazySkinViewer3D(props: SkinViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
      },
      { rootMargin: '100px' }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: props.width, height: props.height }}>
      {inView ? <SkinViewer3D {...props} /> : null}
    </div>
  )
}
