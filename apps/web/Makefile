build-all:
	rm -rf ../web
	rm -rf ../web-denshi
	npm run build
	cp -r out ../web
	npm run build:denshi
	cp -r out-denshi ../web-denshi
	rm -rf ../kamehouse-denshi/web-denshi
	cp -r ../web-denshi ../kamehouse-denshi/web-denshi

build-web:
	rm -rf ../web
	npm run build
	cp -r out ../web

build-denshi:
	rm -rf ../web-denshi
	npm run build:denshi
	cp -r out-denshi ../web-denshi
	rm -rf ../kamehouse-denshi/web-denshi
	cp -r ../web-denshi ../kamehouse-denshi/web-denshi

.PHONY: build-all build-web build-denshi
