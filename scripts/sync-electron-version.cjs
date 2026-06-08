const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rootPkgPath = path.join(root, 'package.json');
const electronPkgPath = path.join(root, 'electron', 'package.json');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'));

if (!rootPkg.version) {
  throw new Error('Versão do package.json principal não encontrada.');
}

if (electronPkg.version !== rootPkg.version) {
  electronPkg.version = rootPkg.version;
  fs.writeFileSync(electronPkgPath, `${JSON.stringify(electronPkg, null, 2)}\n`);
  console.log(`Electron version sincronizada para ${rootPkg.version}`);
} else {
  console.log(`Electron version já está em ${rootPkg.version}`);
}
