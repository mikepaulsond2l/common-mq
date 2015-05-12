var mq = require('../');

var queue = mq.connect({
  provider: 'amqp',
  queueName: 'cabinetmq',
  exchangeName: 'amp.cabinet',
  url: 'amqp://guest:guest@localhost:5672'
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
