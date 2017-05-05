var child_process = require('child_process');
var path = require('path');
var assert = require('assert');
var Client = require('./helpers/index');
var asynk = require('asynk');

describe('cluster', function() {
  var clusterNode1;
  var clusterNode2;
  var client;
  var onData1;
  var onData2;

  before(function(done) {
    var ready1 = asynk.deferred();
    var ready2 = asynk.deferred();
    onData1 = function(data) {
      if (data.toString().startsWith("ready")) {
        ready1.resolve();
      } else {
        console.log(data.toString());
      }
    };
    onData2 = function(data) {
      if (data.toString().startsWith("ready")) {
        ready2.resolve();
      } else {
        console.log(data.toString());
      }
    };
    clusterNode2 = child_process.exec('node ' + path.join(__dirname, './apps/clusterNode2.js'));
    clusterNode2.stdout.on('data', onData2);
    clusterNode2.stderr.pipe(process.stdout);

    asynk.when(ready2).asCallback(function(err) {
      clusterNode1 = child_process.exec('node ' + path.join(__dirname, './apps/clusterNode1.js'));
      clusterNode1.stdout.on('data', onData1);
      clusterNode1.stderr.pipe(process.stdout);
    });

    client = new Client('localhost', 8051);
    asynk.when(ready1).asCallback(done);
  });

  it('request second node through first', function(done) {
    client.http.emit('cluster:ping').asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  it('request an unknown node', function(done) {
    client.http.emit('cluster:wrongNode').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'Could not connect to node wrongNode');
      done();
    });
  });

  it('request a dead node', function(done) {
    clusterNode2.kill();
    client.http.emit('cluster:ping').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'Could not connect to node clusterNode2');
      done();
    });
  });

  after(function(done) {
    clusterNode2.removeListener('data', onData2);
    clusterNode2.stderr.unpipe(process.stdout);
    clusterNode1.removeListener('data', onData1);
    clusterNode1.stderr.unpipe(process.stdout);

    clusterNode2.kill();
    clusterNode1.kill();
    done();
  });
});
