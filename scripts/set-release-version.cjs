const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const version = String(process.argv[2] || process.env.RELEASE_VERSION || '').trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Versão inválida: ${version || '(vazia)'}`);
}

const updateJsonFile = (filePath) => {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  json.version = version;
  if (json.packages && json.packages['']) {
    json.packages[''].version = version;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
};

[
  path.join(root, 'package.json'),
  path.join(root, 'electron', 'package.json'),
  path.join(root, 'package-lock.json'),
  path.join(root, 'electron', 'package-lock.json'),
].forEach((filePath) => {
  if (fs.existsSync(filePath)) updateJsonFile(filePath);
});

console.log(`Release version definida para ${version}`);
