
SRC = $(shell find index.js lib -name "*.js" -type f | sort)
TESTSRC = $(shell find test -name "*.js" -type f | sort)

default: test

ZIP_FILENAME = vogels-lambda.zip
FUNC_NAME = vogels-lambda-func

AWS_PROFILE = default

lint: $(SRC) $(TESTSRC)
	@node_modules/.bin/jshint --reporter node_modules/jshint-stylish $^
test: lint
	@node node_modules/lab/bin/lab -a code
test-cov:
	@node node_modules/lab/bin/lab -a code -t 100
test-cov-html:
	@node node_modules/lab/bin/lab -a code -r html -o coverage.html

create-zip:
	@mkdir -p tmp
	@zip -q -r tmp/$(ZIP_FILENAME) index.js lib/ node_modules/

deploy: lint create-zip
	@./bin/deploy.js

invoke:
	@aws lambda invoke \
		--function-name $(FUNC_NAME) \
		--payload file://test/testEvent.json \
		--profile $(AWS_PROFILE) \
		tmp/lambda_output.txt > /dev/null
	@cat tmp/lambda_output.txt

.PHONY: test test-cov test-cov-html
