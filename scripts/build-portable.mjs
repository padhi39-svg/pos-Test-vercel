import { execSync } from 'child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve('.')
const DIST = resolve('dist/posweb-portable')

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

// 1. Build
console.log('\n=== Building Next.js ===')
run('npm run build')

// 2. Clean dist dir
if (existsSync(DIST)) rmSync(DIST, { recursive: true })
mkdirSync(DIST, { recursive: true })

// 3. Copy .next/
console.log('\n=== Copying .next/ ===')
cpSync(resolve(ROOT, '.next'), resolve(DIST, '.next'), { recursive: true, dereference: true })

// 4. Remove build cache (not needed at runtime)
const cacheDir = resolve(DIST, '.next/cache')
if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true })

// 5. Copy config files
console.log('=== Copying config ===')
copyFileSync(resolve(ROOT, 'package.json'), resolve(DIST, 'package.json'))
const nextCfg = resolve(ROOT, 'next.config.mjs')
if (existsSync(nextCfg)) copyFileSync(nextCfg, resolve(DIST, 'next.config.mjs'))

// 6. Create data/ dir and .env
mkdirSync(resolve(DIST, 'data'), { recursive: true })
writeFileSync(resolve(DIST, '.env'), 'LOCAL_HELPER_BASE=http://127.0.0.1:27128\n')

// 7. Install production only deps
console.log('\n=== Installing production dependencies ===')
run('npm install --production --no-audit --no-fund --loglevel=error', { cwd: DIST })

// 8. Bundle Node.js binary (so client doesn't need Node installed)
console.log('\n=== Bundling Node.js binary ===')
const nodeBin = process.execPath
const nodeTarget = resolve(DIST, 'node-bin', process.platform === 'win32' ? 'node.exe' : 'node')
mkdirSync(resolve(DIST, 'node-bin'), { recursive: true })
copyFileSync(nodeBin, nodeTarget)
// Also copy node_modules/.bin/next which needs node in PATH
console.log(`  ✓ Node.js ${process.version} bundled (${(readFileSync(nodeBin).length / 1024 / 1024).toFixed(1)}MB)`)

// 9. Cleanup npm cache
const npmCache = resolve(DIST, 'node_modules/.cache')
if (existsSync(npmCache)) rmSync(npmCache, { recursive: true, force: true })

// 9. Get version
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))
const ver = pkg.version || '1.0.0'

// 10. Create archive
console.log('\n=== Creating archive ===')
const archivePath = resolve('dist', `posweb-v${ver}`)
const zipFile = `${archivePath}.zip`

if (existsSync(zipFile)) rmSync(zipFile)

const isWin = process.platform === 'win32'
if (isWin) {
  run(`powershell -NoProfile -Command "Compress-Archive -Path '${DIST}' -DestinationPath '${zipFile}' -Force"`)
} else {
  run(`cd dist && zip -r "posweb-v${ver}.zip" posweb-portable`)
}

// 11. Report size
const stats = existsSync(zipFile) ? readFileSync(zipFile).length : 0
const mb = (stats / 1024 / 1024).toFixed(1)

console.log(`\n✓ Portable package created: dist/posweb-v${ver}.zip (${mb}MB)`)
console.log(`  Contains: .next/ (runtime), node_modules/ (prod), server.js + config\n`)
console.log(`  To run: unzip → cd posweb-portable → node server.js --port 3000`)
