import type { MojangProfile } from '../../shared/types'

const BASE_URL = 'https://api.minecraftservices.com/minecraft/profile'

/**
 * Lấy thông tin profile (bao gồm skin và capes)
 */
export async function fetchMojangProfile(accessToken: string): Promise<MojangProfile> {
  const res = await fetch(BASE_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch Mojang profile: ${text}`)
  }

  return (await res.json()) as MojangProfile
}

/**
 * Đổi áo choàng (cape)
 * @param capeId ID của cape (lấy từ fetchMojangProfile), truyền rỗng để ẩn cape.
 */
export async function changeMojangCape(accessToken: string, capeId: string): Promise<void> {
  if (!capeId) {
    // Ẩn cape
    const res = await fetch(`${BASE_URL}/capes/active`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to hide cape: ${text}`)
    }
    return
  }

  // Đổi cape
  const res = await fetch(`${BASE_URL}/capes/active`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ capeId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to change cape: ${text}`)
  }
}

/**
 * Upload skin mới lên Mojang
 * @param fileBuffer Dữ liệu ảnh skin dạng Buffer
 * @param variant Kiểu tay ('classic' hoặc 'slim')
 */
export async function uploadMojangSkin(
  accessToken: string,
  fileBuffer: Buffer,
  variant: 'classic' | 'slim'
): Promise<void> {
  const blob = new Blob([fileBuffer], { type: 'image/png' })
  
  const form = new FormData()
  form.append('variant', variant)
  form.append('file', blob, 'skin.png')

  const res = await fetch(`${BASE_URL}/skins`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to upload skin: ${text}`)
  }
}
