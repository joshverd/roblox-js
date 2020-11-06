// Includes
var http = require('./http.js').func;

// Args
exports.optional = ['jar'];

// Define
function getGeneralToken (jar) {
  var httpOpt = {
    // This will never actually sign you out because an X-CSRF-TOKEN isn't provided, only received
    url: 'https://groups.roblox.com/v1/groups/1234/payouts', // REQUIRES https. Thanks for letting me know, ROBLOX...
    options: {
      resolveWithFullResponse: true,
      method: 'POST',
      jar: jar
    }
  };
  return http(httpOpt)
  .then(function (res) {
    var xcsrf = res.headers['x-csrf-token'];
    console.log('Found XCSRF TOKEN!', xcsrf);
    if (xcsrf) {
      return xcsrf;
    } else {
      throw new Error('Did not receive X-CSRF-TOKEN');
    }
  });
}

exports.func = function (args) {
  var jar = args.jar;
  return getGeneralToken(jar);
};
