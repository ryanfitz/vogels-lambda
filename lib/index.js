'use strict';

var Tweet = require('./tweet');

exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  Tweet.create({content : event.content}, function (err, tweet) {
    if (err)  {
      return context.fail(err);
    }

    return context.succeed(tweet.get());
  });
};
