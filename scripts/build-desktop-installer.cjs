const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const cp = require('child_process')
const os = require('os')

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
  const distElectronDist = path.join(distSrc, 'electron-dist')
  const electronDir = path.join(root, 'electron')
  const electronDist = path.join(electronDir, 'dist')
  const electronOutDir = path.join(electronDir, 'dist-electron')
  const electronNodeModules = path.join(electronDir, 'node_modules')
  const electronExpress = path.join(electronNodeModules, 'express')
  const serialportHostBuild = path.join(electronNodeModules, '@serialport', 'bindings-cpp', 'build')
  const electronPkgPath = path.join(electronDir, 'package.json')
  const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'))
  const outputDirName = `dist-electron-${electronPkg.version}`
  const electronOut = path.join(electronDir, outputDirName)

  if (!fs.existsSync(distSrc)) {
    throw new Error('Pasta dist não encontrada. Rode "npm run build" antes.')
  }

  await rm(distElectronDist)
  await copyDir(distSrc, electronDist)

  if (!fs.existsSync(electronExpress)) {
    run(process.platform === 'win32' ? 'npm.cmd ci' : 'npm ci', electronDir)
  }

  await rm(electronOut)
  await rm(electronOutDir)

  // `npm ci` executado no macOS compila um bindings.node Mach-O em build/Release.
  // O pacote do serialport já inclui o prebuild PE64 correto em prebuilds/win32-x64,
  // mas node-gyp-build prioriza build/Release e faria o Windows carregar o binário
  // do macOS. Retiramos somente esse artefato do host durante o empacotamento.
  let serialportBuildBackup = null
  try {
    if (fs.existsSync(serialportHostBuild)) {
      serialportBuildBackup = await fsp.mkdtemp(path.join(os.tmpdir(), 'popsystem-serialport-host-'))
      await fsp.rename(serialportHostBuild, path.join(serialportBuildBackup, 'build'))
    }

    run('npm run build-win', electronDir)
  } finally {
    if (serialportBuildBackup) {
      await ensureDir(path.dirname(serialportHostBuild))
      await fsp.rename(path.join(serialportBuildBackup, 'build'), serialportHostBuild)
      await rm(serialportBuildBackup)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
