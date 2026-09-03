import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JavaScriptObfuscator from 'javascript-obfuscator'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const targetDirs = [
  path.join(rootDir, 'dist-electron'),
  path.join(rootDir, 'dist/renderer')
]

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false, // Giữ performance cao
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  target: 'node'
}

function getAllJsFiles(dir) {
  let results = []
  if (!fs.existsSync(dir)) return results
  const list = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of list) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath))
    } else if (item.isFile() && item.name.endsWith('.js') && !item.name.endsWith('.map')) {
      results.push(fullPath)
    }
  }
  return results
}

console.log('[Obfuscate] Đang bắt đầu làm rối và mã hóa code bản build...')
let totalObfuscated = 0

// Tắt console log quảng cáo của thư viện obfuscator
const originalConsoleLog = console.log
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[javascript-obfuscator]')) return
  originalConsoleLog(...args)
}

for (const dir of targetDirs) {
  const files = getAllJsFiles(dir)
  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf8')
      // Đặt target phù hợp với renderer vs node/main
      const isRenderer = file.includes('dist\\renderer') || file.includes('dist/renderer')
      const options = {
        ...obfuscatorOptions,
        target: isRenderer ? 'browser' : 'node'
      }
      const obfuscated = JavaScriptObfuscator.obfuscate(code, options)
      fs.writeFileSync(file, obfuscated.getObfuscatedCode(), 'utf8')
      totalObfuscated++
    } catch (err) {
      console.error(`[Obfuscate Error] ${file}:`, err)
    }
  }
}

console.log = originalConsoleLog
console.log(`[Obfuscate] Hoàn tất mã hóa & chống soi code cho ${totalObfuscated} file JavaScript!`)

