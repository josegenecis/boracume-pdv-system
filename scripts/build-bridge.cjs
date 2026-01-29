const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const run = (cmd, args, cwd, env) => {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: env || process.env })
  if (res.status !== 0) process.exit(res.status || 1)
}

const root = process.cwd()
const nativeBridgeDir = path.join(root, 'native-bridge')

const shimDir = path.join(root, '.bridge-build-bin')
fs.mkdirSync(shimDir, { recursive: true })
if (process.platform !== 'win32') {
  const pythonShim = path.join(shimDir, 'python')
  if (!fs.existsSync(pythonShim)) {
    fs.writeFileSync(pythonShim, '#!/usr/bin/env sh\nexec python3 "$@"\n')
    fs.chmodSync(pythonShim, 0o755)
  }
} else {
  const pythonShim = path.join(shimDir, 'python.cmd')
  if (!fs.existsSync(pythonShim)) {
    fs.writeFileSync(pythonShim, '@echo off\r\npython.exe %*\r\n')
  }
}

const env = {
  ...process.env,
  PATH: `${shimDir}${path.delimiter}${process.env.PATH || ''}`,
  PYTHON: process.platform === 'win32' ? 'python' : 'python3',
}

run('npm', ['install', '--no-audit', '--no-fund'], nativeBridgeDir, env)
const extra = process.argv.includes('--dir') ? ['--dir'] : []
run('npx', ['electron-builder', '--config', 'electron-builder.bridge.json', '--publish=never', ...extra], root, env)
