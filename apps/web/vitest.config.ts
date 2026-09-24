import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
    test: {
        globals: true,
        environment: "happy-dom",
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary"],
            include: [
                "src/lib/helpers/**",
                "src/components/video/**",
                "src/lib/stores/**",
                "src/lib/config/**",
            ],
            exclude: [
                "src/**/*.test.{ts,tsx}",
                "src/**/*.spec.{ts,tsx}",
                "src/test/**",
            ],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
