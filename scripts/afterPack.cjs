const fs = require('fs')
const path = require('path')

module.exports = async function (context) {
  const localesDir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return

  // Chỉ giữ lại tiếng Anh (en-US, en-GB) và tiếng Việt (vi)
  const keep = new Set(['en-US.pak', 'en-GB.pak', 'vi.pak'])
  const files = fs.readdirSync(localesDir)

  for (const f of files) {
    if (f.endsWith('.pak') && !keep.has(f)) {
      try {
        fs.unlinkSync(path.join(localesDir, f))
      } catch (_) {}
    }
  }
}

