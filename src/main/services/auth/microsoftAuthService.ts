import http from 'node:http'
import { shell } from 'electron'

export interface MicrosoftAccount {
  id: string
  username: string
  uuid: string
  avatarUrl?: string
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

const CLIENT_ID = 'c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb'

function formatUuid(uuid: string): string {
  if (uuid.length === 32) {
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`
  }
  return uuid
}

export async function loginWithMicrosoft(): Promise<MicrosoftAccount> {
  return new Promise((resolve, reject) => {
    const port = 53248
    const redirectUri = `http://127.0.0.1:${port}`

    const cleanup = () => {
      clearTimeout(timeoutTimer)
      try {
        server.close()
      } catch {}
    }

    const timeoutTimer = setTimeout(() => {
      cleanup()
      reject(new Error('Hết thời gian chờ đăng nhập Microsoft (quá 3 phút).'))
    }, 180000)

    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '', `http://${req.headers.host}`)

      // Skip favicon requests to prevent early server closure
      if (urlObj.pathname === '/favicon.ico') {
        res.writeHead(204)
        res.end()
        return
      }

      const code = urlObj.searchParams.get('code')
      const error = urlObj.searchParams.get('error')

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <html>
            <head>
              <script>
                window.onload = function() {
                  window.close();
                  setTimeout(function() {
                    window.open('', '_self', '');
                    window.close();
                  }, 50);
                };
              </script>
            </head>
            <body style="background: #111; color: #eee; font-family: sans-serif; text-align: center; padding-top: 100px;">
              <h2>Đang đóng trình duyệt...</h2>
            </body>
          </html>
        `)
        cleanup()
        authenticateMinecraftWithCode(code, redirectUri)
          .then(resolve)
          .catch(reject)
      } else if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #111; color: #eee;">
              <h2 style="color: #ea4335;">Đăng nhập thất bại</h2>
              <p>Lỗi: ${error}</p>
            </body>
          </html>
        `)
        cleanup()
        reject(new Error(error))
      } else {
        // Do not close the server for other requests, just return 404
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(port, '127.0.0.1', () => {
      const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=XboxLive.signin%20offline_access`
      void shell.openExternal(authUrl)
    })

    server.on('error', (err) => {
      cleanup()
      reject(new Error(`Không thể khởi động cổng đăng nhập nội bộ: ${err.message}`))
    })
  })
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<MicrosoftAccount> {
  const port = 53248
  const redirectUri = `http://127.0.0.1:${port}`

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Failed to refresh MS token: ${errText}`)
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return authenticateMinecraftWithMsAccessToken(tokenData.access_token, tokenData.refresh_token)
}

async function authenticateMinecraftWithCode(code: string, redirectUri: string): Promise<MicrosoftAccount> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Failed to get MS OAuth token: ${errText}`)
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return authenticateMinecraftWithMsAccessToken(tokenData.access_token, tokenData.refresh_token)
}

async function authenticateMinecraftWithMsAccessToken(
  msAccessToken: string,
  msRefreshToken: string
): Promise<MicrosoftAccount> {
  // Step 1: Xbox Live Auth
  const xblRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  })

  if (!xblRes.ok) {
    const errText = await xblRes.text()
    throw new Error(`Xbox Live Auth failed: ${errText}`)
  }

  const xblData = (await xblRes.json()) as {
    Token: string
    DisplayClaims: { xui: [{ uhs: string }] }
  }

  const xblToken = xblData.Token
  const uhs = xblData.DisplayClaims.xui[0].uhs

  // Step 2: XSTS Auth
  const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  })

  if (!xstsRes.ok) {
    const errText = await xstsRes.text()
    throw new Error(`XSTS Auth failed: ${errText}`)
  }

  const xstsData = (await xstsRes.json()) as {
    Token: string
  }

  const xstsToken = xstsData.Token

  // Step 3: Minecraft Auth
  const mcAuthRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    }),
  })

  if (!mcAuthRes.ok) {
    const errText = await mcAuthRes.text()
    throw new Error(`Minecraft Auth failed: ${errText}`)
  }

  const mcAuthData = (await mcAuthRes.json()) as {
    access_token: string
    expires_in: number
  }

  const mcAccessToken = mcAuthData.access_token

  // Step 4: Get Minecraft Profile
  const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${mcAccessToken}`,
    },
  })

  if (!profileRes.ok) {
    if (profileRes.status === 404) {
      throw new Error('Tài khoản Microsoft này không sở hữu bản quyền game Minecraft.')
    }
    const errText = await profileRes.text()
    throw new Error(`Failed to fetch Minecraft profile: ${errText}`)
  }

  const profileData = (await profileRes.json()) as {
    id: string
    name: string
  }

  return {
    id: profileData.id,
    username: profileData.name,
    uuid: formatUuid(profileData.id),
    accessToken: mcAccessToken,
    refreshToken: msRefreshToken,
    expiresAt: new Date(Date.now() + mcAuthData.expires_in * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
