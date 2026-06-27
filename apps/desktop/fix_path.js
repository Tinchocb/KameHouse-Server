const fs = require('fs');
const path = require('path');
const electronDir = path.resolve(__dirname, '../../node_modules/.pnpm/electron@35.7.5/node_modules/electron');
fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe');

const localElectron = path.join(__dirname, 'node_modules/electron/path.txt');
if (fs.existsSync(path.dirname(localElectron))) {
  fs.writeFileSync(localElectron, 'electron.exe');
}
console.log('Fixed path.txt without newlines successfully!');
