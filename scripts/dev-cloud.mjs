import { spawn } from 'node:child_process'

const apiPort = process.env.MATCH_API_PORT || '8787'
const extra = process.argv.slice(2)

const api = spawn(process.execPath, ['server/index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, MATCH_API_PORT: apiPort },
})

const vite = spawn('npm', ['run', 'dev', '--', ...extra], {
  stdio: 'inherit',
  env: process.env,
})

function shutdown(code = 0) {
  api.kill()
  vite.kill()
  process.exit(code)
}

api.on('exit', (code) => {
  if (code) shutdown(code)
})
vite.on('exit', (code) => shutdown(code ?? 0))
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
