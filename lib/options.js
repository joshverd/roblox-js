// Includes
var settings = require('../settings.json');
var jar = require('./util/jar.js').func;

// Define
exports.init = function () {
  exports.jar = jar();

  var cacheList = [];
  var cache = settings.cache;
  for (var name in cache) {
    var item = cache[name];
    var cacheObj = {
      name: name,
      refresh: item['refresh'],
      expire: item['expire']
    };
    cacheList.push(cacheObj);
  }
  exports.cache = {}

  var queue = settings.queue;

  exports.queue = queue;
};

exports.init();
