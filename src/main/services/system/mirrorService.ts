/**
 * mirrorService.ts
 * Provides CDN fallback / mirror URLs for Mojang, Fabric, Forge, NeoForge, Quilt, and BMCLAPI.
 * When primary official servers are slow or rate-limited (especially in VN/Asia),
 * mirror URLs provide high-speed downloading.
 */

export interface MirrorConfig {
  sourceDomain: string
  mirrorDomain: string
}

/**
 * Known mirror rules mapping official domains to high-speed BMCLAPI / MC mirrors
 */
const MIRROR_RULES: Array<{ match: RegExp; replace: string }> = [
  // Mojang Piston Meta / Version Manifests
  {
    match: /^https?:\/\/piston-meta\.mojang\.com\//i,
    replace: 'https://bmclapi2.bangbang93.com/',
  },
  {
    match: /^https?:\/\/launchermeta\.mojang\.com\//i,
    replace: 'https://bmclapi2.bangbang93.com/',
  },
  // Mojang Resources / Assets (resources.download.minecraft.net)
  {
    match: /^https?:\/\/resources\.download\.minecraft\.net\//i,
    replace: 'https://bmclapi2.bangbang93.com/assets/',
  },
  // Mojang Piston Data / Libraries (piston-data.mojang.com)
  {
    match: /^https?:\/\/piston-data\.mojang\.com\//i,
    replace: 'https://bmclapi2.bangbang93.com/',
  },
  // Mojang Libraries (libraries.minecraft.net)
  {
    match: /^https?:\/\/libraries\.minecraft\.net\//i,
    replace: 'https://bmclapi2.bangbang93.com/maven/',
  },
  // Fabric Maven (maven.fabricmc.net)
  {
    match: /^https?:\/\/maven\.fabricmc\.net\//i,
    replace: 'https://bmclapi2.bangbang93.com/maven/',
  },
  // Fabric Meta (meta.fabricmc.net)
  {
    match: /^https?:\/\/meta\.fabricmc\.net\//i,
    replace: 'https://bmclapi2.bangbang93.com/fabric-meta/',
  },
  // Forge Maven (maven.minecraftforge.net / files.minecraftforge.net)
  {
    match: /^https?:\/\/maven\.minecraftforge\.net\//i,
    replace: 'https://bmclapi2.bangbang93.com/maven/',
  },
  {
    match: /^https?:\/\/files\.minecraftforge\.net\/maven\//i,
    replace: 'https://bmclapi2.bangbang93.com/maven/',
  },
  // NeoForged Maven (maven.neoforged.net)
  {
    match: /^https?:\/\/maven\.neoforged\.net\/releases\//i,
    replace: 'https://bmclapi2.bangbang93.com/maven/',
  },
  // Quilt Maven (maven.quiltmc.org)
  {
    match: /^https?:\/\/maven\.quiltmc\.org\/repository\/release\//i,
    replace: 'https://bmclapi2.bangbang93.com/maven/',
  },
  {
    match: /^https?:\/\/meta\.quiltmc\.org\//i,
    replace: 'https://bmclapi2.bangbang93.com/quilt-meta/',
  }
]

/**
 * Returns a list of candidate URLs for a given target download URL.
 * The primary URL comes first, followed by available high-speed CDN mirrors.
 */
export function getUrlCandidates(originalUrl: string): string[] {
  if (!originalUrl || typeof originalUrl !== 'string') return []
  const candidates: string[] = [originalUrl]

  for (const rule of MIRROR_RULES) {
    if (rule.match.test(originalUrl)) {
      const mirrored = originalUrl.replace(rule.match, rule.replace)
      if (mirrored !== originalUrl && !candidates.includes(mirrored)) {
        candidates.push(mirrored)
      }
      break
    }
  }

  return candidates
}

/**
 * Returns mirror URL directly if applicable, otherwise original URL.
 */
export function getMirroredUrl(originalUrl: string): string {
  const candidates = getUrlCandidates(originalUrl)
  return candidates[1] || originalUrl
}
