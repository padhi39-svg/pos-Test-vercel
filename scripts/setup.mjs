import { execSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

console.log('=== POS Web Setup ===\n')

try {
  const nodeVer = execSync('node -v', { encoding: 'utf8' }).trim()
  console.log(`✓ Node.js ${nodeVer}`)
} catch {
  console.error('Error: Node.js not found. Install from https://nodejs.org')
  process.exit(1)
}

try {
  const npmVer = execSync('npm -v', { encoding: 'utf8' }).trim()
  console.log(`✓ npm ${npmVer}`)
} catch {
  console.error('Error: npm not found.')
  process.exit(1)
}

console.log('\n→ Installing npm dependencies...')
execSync('npm install --loglevel=error', { stdio: 'inherit', cwd: resolve('.') })
console.log('✓ npm install complete')

const envPath = resolve('.env')
if (!existsSync(envPath)) {
  console.log('\n→ Creating .env file...')
  writeFileSync(envPath, 'LOCAL_HELPER_BASE=http://127.0.0.1:27128\n')
  console.log('✓ .env created')
}

console.log('\n=== Setup Complete ===')
console.log('\nAvailable services:')
console.log('  pos-web (Next.js):  npm run start    → http://localhost:3000')
console.log('  tunnel-server:      cd bin/tunnel-server && cargo run --release')
console.log('  local-helper:       node local-helper/index.js')
console.log('\nOr use the GUI Service Manager:')
console.log('  cd bin/print_helper_rs && cargo run --release -p gui-service-manager')
console.log('')
