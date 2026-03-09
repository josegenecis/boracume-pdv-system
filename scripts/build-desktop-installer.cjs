const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const cp = require('child_process')

async function rm(dir) {
  await fsp.rm(dir, { recursive: true, force: true })
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true })
}

async function copyDir(src, dst) {
  await rm(dst)
  await ensureDir(dst)
  await fsp.cp(src, dst, { recursive: true })
}

function run(command, cwd) {
  cp.execSync(command, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, PAGER: 'cat' },
  })
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const distSrc = path.join(root, 'dist')
  const electronDir = path.join(root, 'electron')
  const electronDist = path.join(electronDir, 'dist')
  const electronNodeModules = path.join(electronDir, 'node_modules')
  const electronExpress = path.join(electronNodeModules, 'express')
  const electronPkgPath = path.join(electronDir, 'package.json')
  const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'))
  const outputDirName = `dist-electron-${electronPkg.version}`
  const electronOut = path.join(electronDir, outputDirName)

  if (!fs.existsSync(distSrc)) {
    throw new Error('Pasta dist não encontrada. Rode "npm run build" antes.')
  }

  await copyDir(distSrc, electronDist)

  if (!fs.existsSync(electronExpress)) {
    run('npm.cmd ci', electronDir)
  }

  await rm(electronOut)

  run('npm run build-win', electronDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

