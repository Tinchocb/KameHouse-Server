build-all:
	rm -rf ../web
	rm -rf ../web-denshi
	pnpm build
	cp -r out ../web
	pnpm build:denshi
	cp -r out-denshi ../web-denshi
	rm -rf ../kamehouse-denshi/web-denshi
	cp -r ../web-denshi ../kamehouse-denshi/web-denshi

build-web:
	rm -rf ../web
	pnpm build
	cp -r out ../web

build-denshi:
	rm -rf ../web-denshi
	pnpm build:denshi
	cp -r out-denshi ../web-denshi
	rm -rf ../kamehouse-denshi/web-denshi
	cp -r ../web-denshi ../kamehouse-denshi/web-denshi

.PHONY: build-all build-web build-denshi
