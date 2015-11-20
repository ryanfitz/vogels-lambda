#!/usr/bin/env node

'use strict';

var AWS   = require('aws-sdk'),
    async = require('async'),
    _     = require('lodash'),
    path  = require('path'),
    fs    = require('fs'),
    vogels = require('vogels');

AWS.config.update({region : 'us-east-1'});
var dynamodb = new AWS.DynamoDB();
vogels.dynamoDriver(dynamodb);

var cloudformation = new AWS.CloudFormation();
var lambda = new AWS.Lambda();

var internals = {};
internals.stackName = 'vogelsLambdaStack';

internals.lambdaConfig = {
  name : 'vogels-lambda-func',
  handler : 'index.handler',
  runtime : 'nodejs',
  memory : 128,
  timeout : 2,
  zipFile : 'tmp/vogels-lambda.zip'
};

internals.checkStackExists = function (stackName, callback) {
  var params = {
    StackName: stackName
  };

  cloudformation.describeStacks(params, function (err) {
    if (err && err.code === 'ValidationError') {
      return callback(null, false);
    } else if (err) {
      return callback(err);
    } else {
      return callback(null, true);
    }
  });
};

internals.checkFunctionExists = function (funcName, callback) {
  var params = {
    FunctionName: funcName
  };

  lambda.getFunctionConfiguration(params, function (err) {
    if (err && err.code === 'ResourceNotFoundException') {
      return callback(null, false);
    } else if (err) {
      return callback(err);
    } else {
      return callback(null, true);
    }
  });
};

internals.createStack = function (stackName, stackExists, callback) {
  var template = require('../stacks/lambda-cf.json');
  var tempBody = JSON.stringify(template);

  var params = {
    StackName : stackName,
    Capabilities: ['CAPABILITY_IAM'],
    TemplateBody : tempBody
  };

  if (stackExists) {
    return cloudformation.updateStack(params, function (err, data) {
      if (err && err.code === 'ValidationError' && err.message === 'No updates are to be performed.') {
        return callback(null, data);
      } else if (err) {
        return callback(err);
      } else {
        return callback(null, data);
      }
    });
  } else {
    return cloudformation.createStack(params, callback);
  }
};

internals.waitTillStackCompleted = function (stackName, data, callback) {
  var status = 'PENDING';

  var params = {
    StackName : stackName
  };

  var completedStates = ['CREATE_COMPLETE', 'UPDATE_COMPLETE'];
  var pendingStates = ['CREATE_IN_PROGRESS', 'UPDATE_IN_PROGRESS'];

  async.doWhilst(
    function (callback) {
      cloudformation.describeStacks(params, function (err, data) {
        if(err) {
          return callback(err);
        }

        status = _.get(data, 'Stacks[0].StackStatus');

        console.log('cloudformation status', status);

        if (!_.includes(pendingStates, status) && !_.includes(completedStates, status)) {
          return callback(new Error('cloudformation failed ' + status));
        } else if (_.includes(completedStates, status)) {
          return callback();
        } else {
          setTimeout(callback, 5000);
        }
      });
    },
    function () { return !_.includes(completedStates, status); },
    function (err) {
      return callback(err);
    });
};

internals.fetchStackOutputs = function (stackName, callback) {
  var params = {
    StackName : stackName
  };

  cloudformation.describeStacks(params, function (err, data) {
    if (err) {
      return callback(err);
    }

    var output = _.find(_.first(data.Stacks).Outputs, { OutputKey : 'RoleArn' } );
    return callback(null, _.get(output, 'OutputValue'));
  });
};

internals.createLambdaFunction = function (settings, arn, callback) {
  internals.checkFunctionExists(settings.name, function (err, exists) {
    if (err) {
      return callback(err);
    }

    if (exists) {
      return internals.updateFunction(settings, arn, callback);
    } else {
      var zipPath = path.resolve(__dirname, '..', settings.zipFile);
      var params = {
        Code: {
          ZipFile: fs.readFileSync(zipPath)
        },
        FunctionName: settings.name, /* required */
        Handler: settings.handler, /* required */
        Role: arn, /* required */
        Runtime: settings.runtime, /* required */
        Description: 'test',
        MemorySize: settings.memory,
        Timeout: settings.timeout
      };

      return lambda.createFunction(params, callback);
    }
  });
};

internals.updateFunction = function (settings, arn, callback) {
  async.parallel([
    function (callback) {
      var zipPath = path.resolve(__dirname, '..', settings.zipFile);

      var params = {
        FunctionName: settings.name,
        ZipFile: fs.readFileSync(zipPath)
      };

      return lambda.updateFunctionCode(params, callback);
    },
    function (callback) {
      var params = {
        FunctionName: settings.name,
        Handler: settings.handler,
        MemorySize: settings.memory,
        Role: arn,
        Timeout: settings.timeout
      };

      return lambda.updateFunctionConfiguration(params, callback);
    }
  ], callback);
};

internals.initDatabase = function (data, callback) {
  var Tweet = require('../lib/tweet');
  return vogels.createTables(callback);
};

async.waterfall([
  async.apply(internals.checkStackExists, internals.stackName),
  async.apply(internals.createStack, internals.stackName),
  async.apply(internals.waitTillStackCompleted, internals.stackName),
  async.apply(internals.fetchStackOutputs, internals.stackName),
  async.apply(internals.createLambdaFunction, internals.lambdaConfig),
  async.apply(internals.initDatabase),
], function (err, result) {
  if (err) {
    console.error('Deploy failed', err);
  } else {
    console.log('Deploy finished, run `make invoke`');
  }
});
