const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Determine paths
const electronDir = path.resolve(__dirname, '../../node_modules/.pnpm/electron@35.7.5/node_modules/electron');
const distDir = path.join(electronDir, 'dist');
const zipPath = path.join(__dirname, 'electron.zip');

console.log('Target Electron Directory:', electronDir);
console.log('Dist Directory:', distDir);

// Electron URL
const url = 'https://github.com/electron/electron/releases/download/v35.7.5/electron-v35.7.5-win32-x64.zip';
console.log('Downloading Electron from:', url);

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Download function helper
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        console.log('Redirecting to:', response.headers.location);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

downloadFile(url, zipPath)
  .then(() => {
    console.log('Download complete. Extracting zip...');
    // We can use extract-zip from the pnpm folder
    const extract = require(path.join(electronDir, '..', 'extract-zip'));
    return extract(zipPath, { dir: distDir });
  })
  .then(() => {
    console.log('Extraction complete! Writing path.txt...');
    fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe');
    // Also write to symlinked desktop node_modules just in case
    const localElectronDir = path.resolve(__dirname, 'node_modules/electron');
    if (fs.existsSync(localElectronDir)) {
      if (!fs.existsSync(path.join(localElectronDir, 'dist'))) {
        fs.mkdirSync(path.join(localElectronDir, 'dist'), { recursive: true });
      }
      fs.writeFileSync(path.join(localElectronDir, 'path.txt'), 'electron.exe');
    }
    
    // Cleanup zip
    fs.unlinkSync(zipPath);
    console.log('Electron installed successfully!');
  })
  .catch(err => {
    console.error('Error installing Electron:', err);
    setTimeout(() => {
      if (fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch (e) {}
      }
    }, 1000);
  });
