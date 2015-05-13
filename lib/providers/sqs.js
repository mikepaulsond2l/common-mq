var async = require('async'),
    AWS = require('aws-sdk');

function SqsProvider(emitter, options) {
  this._queueUrl = options.awsConfig.endpoint + '/' + options.queueName;
  this.options = options;
  this.emitter = emitter;
  
  process.nextTick(this._initProvider.bind(this));
}

SqsProvider.prototype.publish = function(message) {
  var self = this;
  
  message = typeof message !== 'string' ? 
    message instanceof Buffer ?
    message.toString('base64') :
    JSON.stringify(message) :
    message;
  
  if (self.emitter.isReady) {
    process.nextTick(function() {
      self._sendMessage(message);
    });
  } else {
    self.emitter.once('ready', function() {
      process.nextTick(function() {
        self._sendMessage(message)
      });
    });
  }
};

SqsProvider.prototype.subscribe = function() {

  if (this.emitter.isReady) {
    process.nextTick(this._startPolling.bind(this));
  } else {
    this.emitter.once('ready', this._startPolling.bind(this));
  }
  
};

SqsProvider.prototype.ack = function(messageId) {
  if (!this.options.deleteAfterReceive) {
    process.nextTick(this._deleteMessage.bind(this, messageId));
  }
};

SqsProvider.prototype.unsubscribe = function() {
  var self = this;
  process.nextTick(function() {
    self._isClosed = true;
  });
};

SqsProvider.prototype._deleteMessage = function(receiptHandle) { 
  var self = this;
  
  var param = {
    QueueUrl: self._queueUrl,
    ReceiptHandle: receiptHandle
  };
  
  self._sqs.deleteMessage(param, function(err) {
    if (err) {
      self.emitter.emit('error', err);
    }
  });
};

SqsProvider.prototype._initProvider = function() {
  var self = this;
  
  try {
    this._sqs = new AWS.SQS(this.options.awsConfig);
  } catch (err) {
    self.emitter.emit('error', err);
    throw err;
  }

  self.emitter.isReady = true;
  
  self.emitter.emit('ready');
};

SqsProvider.prototype._poll = function(done) {
  var self = this;
  
  var param = { 
    QueueUrl: self._queueUrl,
    MaxNumberOfMessages: self.options.maxReceiveCount || 1
  };

  if (typeof self.options.visibilityTimeout !== 'undefined') {
    param.VisibilityTimeout = self.options.visibilityTimeout;
    param.WaitTimeSeconds = self.options.waitTimeSeconds;
  }
  
  if (typeof self.options.waitTimeSeconds !== 'undefined') {
    param.WaitTimeSeconds = self.options.waitTimeSeconds;
  }
  
  self._sqs.receiveMessage(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', err);
      done();
      return;
    }
    
    (data.Messages || []).forEach(function(msg) {
      var decoded = msg.Body;
      var isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/gi;

      // first try to detect if it is a base64 string
      // if so convert to Buffer
      if (isBase64.test(msg.Body)) {
        decoded = new Buffer(msg.Body, 'base64');
      } else {
        // next try to decode as json
        // but if it fails just leave as original string
        try {
          decoded = JSON.parse(msg.Body);
        } catch (e) {}
      }

      self.emitter.emit('message', decoded, msg.ReceiptHandle);
      if (!self._isClosed && self.options.deleteAfterReceive) {
        self._deleteMessage(msg.ReceiptHandle);
      }
      
    });
    
    done();
      
  });
};

SqsProvider.prototype._sendMessage = function(message) {  
  var self = this;
  
  var param = { 
    QueueUrl: self._queueUrl,
    MessageBody: message
  };
  
  self._sqs.sendMessage(param, function(err, data) {
    if (err) {
      self.emitter.emit('error', err);
    }
  });
};

SqsProvider.prototype._startPolling = function() {
  var self = this;
  self._isClosed = false;
  
  async.until(
  
    function() { return self._isClosed; },
    
    function(cb) {
      self._poll(function() {
        setTimeout(cb, (self.options.delayBetweenPolls || 0) * 1000);
      });
    },
    
    function(err) {
      if (err) {
        self.emitter.emit('error', err);
      }
    }
  
  );
  
};

module.exports = exports = SqsProvider;
