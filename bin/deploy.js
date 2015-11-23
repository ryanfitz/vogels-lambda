#!/usr/bin/env node

'use strict';

var AWS   = require('aws-sdk'),
    async = require('async'),
    _     = require('lodash'),
    vogels = require('vogels');

AWS.config.update({region : 'us-east-1'});
var dynamodb = new AWS.DynamoDB();
vogels.dynamoDriver(dynamodb);

var internals = {};

internals.initDatabase = function (callback) {
  var Tweet = require('../lib/tweet');
  return vogels.createTables(callback);
};

async.waterfall([
  async.apply(internals.initDatabase),
], function (err) {
  if (err) {
    console.error('Deploy failed', err);
  } else {
    console.log('Deploy finished, run `make invoke`');
  }
});
