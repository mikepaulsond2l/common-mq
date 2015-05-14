var events = require('events');
var fs = require('fs');
var path = require('path');
var util = require('util');

// load providers into a hash for dynamic referencing
var ProviderHash = {};
var files = fs.readdirSync(__dirname + '/providers');
files.forEach(function(file) {
  if (path.extname(file) === '.js') {
    ProviderHash[path.basename(file, '.js')] = './providers/' + file;
  }
});

function Queue(options) {
  this.isReady = false;

  try {
    var Provider = require(ProviderHash[options.provider]);
    this._provider = new Provider(this, options);
  } catch (e) {
    var err = new Error('Unable to load provider: ' + options.provider + '\n' + e);
    throw err;
  }

  this._listenerCount = 0;

  this.on('newListener', function(event) {
    if (event !== 'message') return;

    if (++this._listenerCount === 1) {
      this._provider.subscribe();
    }

  });

  this.on('removeListener', function(event) {
    if (event !== 'message') return;

    if (--this._listenerCount === 0) {
      this._provider.unsubscribe();
    }

  });
}

util.inherits(Queue, events.EventEmitter);

Queue.prototype.publish = function(message) {
  this._provider.publish(message);
};

Queue.prototype.ack = function(messageId) {
  this._provider.ack(messageId);
};

Queue.prototype.close = function() {
  this._provider.close();
};

module.exports = exports = Queue;
