const fs = require("fs")
const path = require("path")

const platform = process.platform

let binaryName
if (platform === "win32") {
    binaryName = "kamehouse-server-windows.exe"
} else if (platform === "darwin") {
    const arch = process.arch === "arm64" ? "arm64" : "amd64"
    binaryName = `kamehouse-server-darwin-${arch}`
} else if (platform === "linux") {
    const arch = process.arch === "arm64" ? "arm64" : "amd64"
    binaryName = `kamehouse-server-linux-${arch}`
}

const devBinaryName = platform === "win32" ? "kamehouse.exe" : "kamehouse"
const src = path.resolve(__dirname, "../server", devBinaryName)
const destDir = path.resolve(__dirname, "binaries")
const dest = path.join(destDir, binaryName)

if (!fs.existsSync(src)) {
    console.error("Server binary not found at " + src)
    console.error("Make sure the Go server is built first (go build -o kamehouse.exe ./cmd/kamehouse)")
    process.exit(1)
}

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
}

fs.copyFileSync(src, dest)
if (platform !== "win32") {
    fs.chmodSync(dest, "755")
}
console.log("Copied server binary to " + dest)
