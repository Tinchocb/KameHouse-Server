const path = require('path');
const electronDir = path.join(__dirname, 'node_modules', 'electron');

const { downloadArtifact } = require(path.join(electronDir, 'node_modules', '@electron/get'));
const extract = require(path.join(electronDir, 'node_modules', 'extract-zip'));
const fs = require('fs');
const os = require('os');

const pkg = require(path.join(electronDir, 'package.json'));
const version = pkg.version;

const platform = process.platform;
const arch = process.arch;

console.log('Starting manual download of Electron v' + version + ' for ' + platform + '-' + arch);

downloadArtifact({
  version,
  artifactName: 'electron',
  platform,
  arch
}).then(zipPath => {
  console.log('Successfully resolved artifact zip to:', zipPath);
  console.log('Extracting to:', path.join(electronDir, 'dist'));
  
  // Make sure dist directory exists or is clean
  const distDir = path.join(electronDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  return extract(zipPath, { dir: distDir }).then(() => {
    console.log('Extraction complete!');
    
    const platformPath = platform === 'win32' ? 'electron.exe' : 'electron';
    fs.writeFileSync(path.join(electronDir, 'path.txt'), platformPath);
    console.log('Wrote path.txt');
  });
}).then(() => {
  console.log('All steps completed successfully!');
}).catch(err => {
  console.error('FAILED during manual installation:');
  console.error(err);
  process.exit(1);
});
