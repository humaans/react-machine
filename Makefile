.PHONY: build release release-beta test coverage

build:
	@npm run build

release:
	@npm run release

release-beta:
	@npm run release:beta

test:
	@npm run test

coverage:
	@npm run coverage