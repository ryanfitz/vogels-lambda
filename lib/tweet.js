'use strict';

var vogels = require('vogels'),
    Joi    = require('joi');

var Tweet = vogels.define('Tweet', {
  hashKey : 'id',
  timestamps : true,
  schema : {
    id : vogels.types.uuid(),
    content : Joi.string().required().trim()
  },
  tableName: 'vogelsLambda'
});

module.exports = Tweet;
