const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.go') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.md') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.json') || file.endsWith('Makefile')) {
                results.push(file);
            }
        }
    });
    return results;
}

const targetDirs = [
    path.join(__dirname, '../apps/server'),
    path.join(__dirname, '../apps/web'),
    path.join(__dirname, '../Makefile'),
];

let files = [];
targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
        if (fs.statSync(dir).isDirectory()) {
            files = files.concat(walk(dir));
        } else {
            files.push(dir);
        }
    }
});

let updatedCount = 0;
files.forEach(file => {
    // skip node_modules and build outputs entirely
    if (file.includes('node_modules') || file.includes('.git') || file.includes('out') || file.includes('dist') || file.includes('.next')) return;

    let content = fs.readFileSync(file, 'utf8');
    const orig = content;

    content = content.replace(/Seanime/g, 'KameHouse');
    content = content.replace(/seanime/g, 'kamehouse');
    content = content.replace(/SEANIME/g, 'KAMEHOUSE');

    if (content !== orig) {
        fs.writeFileSync(file, content, 'utf8');
        updatedCount++;
    }
});
console.log(`Updated ${updatedCount} files.`);
