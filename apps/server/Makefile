# ======================================================================
# KameHouse Server Makefile
# ======================================================================
# Usage:
#   make build        - Full production build (web + server)
#   make build-server - Build Go server binary only
#   make build-web    - Build web frontend only
#   make dev          - Start Go server in development mode
#   make dev-web      - Start web frontend dev server
#   make vet          - Run go vet on all packages
#   make test         - Run all Go tests (short mode)
#   make race         - Run tests with race detector on concurrency-critical packages
#   make lint         - Run golangci-lint
#   make clean        - Remove build artifacts
#   make tidy         - Run go mod tidy
# ======================================================================

# Config
BINARY_NAME    := kamehouse
WEB_DIR        := ../web
WEB_OUT_DIR    := $(WEB_DIR)/out
DEST_WEB_DIR   := web
DATA_DIR       ?= ./test_data_dir
SERVER_PORT    ?= 43000
GO             := go
NPM            := npm

# Platform detection
ifeq ($(OS),Windows_NT)
	BINARY := $(BINARY_NAME).exe
	RM_CMD := powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"
	MKDIR  := powershell -Command "New-Item -ItemType Directory -Force"
	COPY   := powershell -Command "Copy-Item -Recurse -Force"
	LDFLAGS := -s -w -H=windowsgui -extldflags '-static'
else
	BINARY := $(BINARY_NAME)
	RM_CMD := rm -rf
	MKDIR  := mkdir -p
	COPY   := cp -r
	LDFLAGS := -s -w
endif

# ======================================================================
# Primary Targets
# ======================================================================

.PHONY: build build-server build-web dev dev-web vet test race lint clean tidy help

## build: Full production build (web frontend + Go server)
build: build-web build-server
	@echo "✅ Full build complete: $(BINARY)"

## build-server: Build the Go server binary with optimized flags
build-server:
	@echo "🔨 Building server..."
	CGO_ENABLED=1 $(GO) build -o $(BINARY) -trimpath -ldflags="$(LDFLAGS)"
	@echo "✅ Server built: $(BINARY)"

## build-server-nosystray: Build without system tray (for desktop app / Linux)
build-server-nosystray:
	@echo "🔨 Building server (no systray)..."
	$(GO) build -o $(BINARY) -trimpath -ldflags="-s -w" -tags=nosystray
	@echo "✅ Server built: $(BINARY)"

## build-web: Build the web frontend and copy to web/ directory
build-web:
	@echo "🌐 Building web frontend..."
	cd $(WEB_DIR) && $(NPM) run build
	@$(RM_CMD) $(DEST_WEB_DIR) 2>/dev/null || true
	@$(MKDIR) $(DEST_WEB_DIR)
	@$(COPY) $(WEB_OUT_DIR)/* $(DEST_WEB_DIR)/
	@echo "✅ Web frontend built and copied to $(DEST_WEB_DIR)/"

# ======================================================================
# Development
# ======================================================================

## dev: Start the Go server in development mode
dev:
	@echo "🚀 Starting dev server on port $(SERVER_PORT)..."
	$(GO) run main.go --datadir="$(DATA_DIR)"

## dev-web: Start the web frontend development server
dev-web:
	@echo "🌐 Starting web dev server..."
	cd $(WEB_DIR) && $(NPM) run dev

# ======================================================================
# Quality Assurance
# ======================================================================

## vet: Run go vet on all internal packages (including tests)
vet:
	@echo "🔍 Running go vet..."
	$(GO) vet ./internal/...
	@echo "✅ go vet passed"

## test: Run Go tests in short mode
test:
	@echo "🧪 Running tests..."
	$(GO) test -short ./internal/...
	@echo "✅ Tests passed"

## lint: Run golangci-lint
lint:
	@echo "🧹 Running linter..."
	golangci-lint run ./internal/...
	@echo "✅ Lint passed"

## race: Run selected packages with the race detector (events, core, handlers)
race:
	@echo "🔬 Running race detector tests..."
	$(GO) test -race -count=1 ./internal/events/... ./internal/core/... ./internal/handlers/...
	@echo "✅ Race detector tests passed"

# ======================================================================
# Maintenance
# ======================================================================

## tidy: Run go mod tidy
tidy:
	@echo "📦 Tidying modules..."
	$(GO) mod tidy
	@echo "✅ Modules tidied"

## clean: Remove build artifacts and temporary files
clean:
	@echo "🧹 Cleaning build artifacts..."
	@$(RM_CMD) $(BINARY) 2>/dev/null || true
	@$(RM_CMD) $(DEST_WEB_DIR) 2>/dev/null || true
	@$(RM_CMD) $(WEB_OUT_DIR) 2>/dev/null || true
	@echo "✅ Clean complete"

## help: Show this help message
help:
	@echo "KameHouse Server Build System"
	@echo "============================="
	@echo ""
	@grep -E '^## ' Makefile | sed 's/^## /  /' | sort
