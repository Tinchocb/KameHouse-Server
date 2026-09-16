import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const codegenDir = path.join(rootDir, "apps", "server", "codegen");

console.log("🔨 Running Go & TypeScript codegen...");
try {
  execSync("go run main.go", {
    cwd: codegenDir,
    stdio: "inherit",
  });
  console.log("✅ Codegen complete: contracts & hooks synchronized.");
} catch (error) {
  console.error("❌ Codegen failed:", error.message);
  process.exit(1);
}
