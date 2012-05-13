.PHONY: build test

build:
	./build	
test: build
	cd test && mocha --globals section,data,m run.js
	
