build-all: build-web build-desktop

build-web:
	pnpm build
	rm -rf ../server/web
	mkdir -p ../server/web
	cp -r out/* ../server/web/

build-desktop:
	pnpm build
	rm -rf ../desktop/web
	mkdir -p ../desktop/web
	cp -r out/* ../desktop/web/

.PHONY: build-all build-web build-desktop

