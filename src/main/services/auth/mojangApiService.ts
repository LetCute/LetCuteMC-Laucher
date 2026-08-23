import type { MojangProfile } from '../../../shared/types'

const BASE_URL = 'https://api.minecraftservices.com/minecraft/profile'

/**
 * Lấy thông tin profile (bao gồm skin và capes)
 */
export async function fetchMojangProfile(accessToken: string): Promise<MojangProfile | null> {
  const res = await fetch(BASE_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    if (res.status === 404) {
      return null
    }
    if (res.status === 401) {
      throw new Error('TOKEN_EXPIRED')
    }
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
  // Chuyển Buffer thành Uint8Array để tương thích với cấu trúc BlobPart của TypeScript/DOM
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/png' })

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

/**
 * Kiểm tra xem tài khoản có được phép đổi tên không
 */
export async function checkMojangNameChange(accessToken: string): Promise<{ createdAt: string; nameChangeAllowed: boolean }> {
  const res = await fetch(`${BASE_URL}/namechange`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    if (res.status === 404) return { createdAt: '', nameChangeAllowed: false }
    if (res.status === 401) throw new Error('TOKEN_EXPIRED')
    const text = await res.text()
    throw new Error(`Failed to check name change: ${text}`)
  }

  return (await res.json()) as { createdAt: string; nameChangeAllowed: boolean }
}

/**
 * Gửi yêu cầu đổi tên profile lên Mojang
 */
export async function changeMojangName(accessToken: string, newName: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/name/${encodeURIComponent(newName)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED')
    if (res.status === 403) throw new Error('NAME_UNAVAILABLE_OR_COOLDOWN')
    const text = await res.text()
    throw new Error(`Failed to change name: ${text}`)
  }
}

