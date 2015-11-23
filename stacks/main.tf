provider "aws" {
  region = "${var.aws_region}"
}

resource "aws_iam_role" "lambdaRole" {
  name = "vogels_lambda_role"
  assume_role_policy = "${file("${path.module}/assumeRolePolicy.json")}"
}

resource "aws_iam_role_policy" "lambdaAccessPolicy" {
  name = "DynamoDBLambdaAccessPolicy"
  role = "${aws_iam_role.lambdaRole.id}"
  policy = "${file("${path.module}/roleAccessPolicy.json")}"
}

resource "aws_lambda_function" "vogelsLambdaFunc" {
  filename = "tmp/vogels-lambda.zip"
  function_name = "vogels-lambda-func"
  role = "${aws_iam_role.lambdaRole.arn}"
  handler = "index.handler"
  memory_size = 128
  runtime = "nodejs"
  timeout = 2
}

output "roleArn" {
  value = "${aws_iam_role.lambdaRole.arn}"
}

output "lambdaFuncArn" {
  value = "${aws_lambda_function.vogelsLambdaFunc.arn}"
}