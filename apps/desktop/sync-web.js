const fs = require("fs")
const path = require("path")

const src = path.resolve(__dirname, "../web/out")
const dest = path.resolve(__dirname, "./web")

if (!fs.existsSync(src)) {
    console.error("Source directory does not exist: " + src)
    console.error("Please run build in apps/web first.")
    process.exit(1)
}

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src)
    const stats = exists && fs.statSync(src)
    const isDirectory = exists && stats.isDirectory()
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true })
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName))
        })
    } else {
        fs.copyFileSync(src, dest)
    }
}

console.log(`Syncing web assets from ${src} to ${dest}...`)
if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true })
}
copyRecursiveSync(src, dest)
console.log("Sync complete!")
