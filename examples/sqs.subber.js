var mq = require('../');

var queue = mq.connect({
  provider: 'sqs',
  queueName: 'cabinet',
  awsConfig: {
    apiVersion: '2012-11-05',
    region: 'us-east-1',
    endpoint: 'http://localhost:3000'
  }
});

queue.on('ready', function() {
  console.log('queue ready');
});

queue.on('message', printMessage);

queue.on('error', function(err) {
  console.log(err);
});

function printMessage(message) {
  console.log(message.data.toString());
}
