# ======================================================================
# KameHouse Root Makefile — Monorepo Orchestrator
# ======================================================================
# Usage:
#   make build        - Full production build (web + server)
#   make build-server - Build Go server binary only
#   make build-web    - Build web frontend only
#   make dev          - Start Go server in development mode
#   make dev-web      - Start web frontend dev server
#   make vet          - Run go vet on all packages
#   make test         - Run all Go tests (short mode)
#   make lint         - Run golangci-lint
#   make clean        - Remove build artifacts
#   make tidy         - Run go mod tidy
# ======================================================================

SERVER_DIR := apps/server
WEB_DIR    := apps/web

.PHONY: build build-server build-web dev dev-web vet test lint clean tidy help

## build: Full production build (web frontend + Go server)
build: build-web build-server
	@echo "✅ Full build complete"

## build-server: Build Go server binary
build-server:
	cd $(SERVER_DIR) && $(MAKE) build-server

## build-web: Build web frontend
build-web:
	cd $(SERVER_DIR) && $(MAKE) build-web

## dev: Start Go server in development mode
dev:
	cd $(SERVER_DIR) && $(MAKE) dev

## dev-web: Start web frontend dev server
dev-web:
	cd $(WEB_DIR) && npm run dev

## vet: Run go vet
vet:
	cd $(SERVER_DIR) && $(MAKE) vet

## test: Run Go tests
test:
	cd $(SERVER_DIR) && $(MAKE) test

## lint: Run golangci-lint
lint:
	cd $(SERVER_DIR) && $(MAKE) lint

## tidy: Run go mod tidy
tidy:
	cd $(SERVER_DIR) && $(MAKE) tidy

## clean: Remove build artifacts
clean:
	cd $(SERVER_DIR) && $(MAKE) clean

## help: Show this help message
help:
	@echo "KameHouse Monorepo Build System"
	@echo "==============================="
	@echo ""
	@grep -E '^## ' Makefile | sed 's/^## /  /' | sort
