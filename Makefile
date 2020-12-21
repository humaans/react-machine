.PHONY: build watch release release-beta test coverage

build:
	@npm run build

watch:
	@npm run watch

release:
	@npm run release

release-beta:
	@npm run release:beta

test:
	@npm run test

coverage:
	@npm run coverage