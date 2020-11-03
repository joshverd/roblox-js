// Dependencies
var parser = require('cheerio');

// Includes
var http = require('../util/http.js').func;
var options = require('../options.js');
var settings = require('../../settings.json');
var clearSession = require('../util/clearSession.js').func;



// Args
exports.required = ['username', 'password'];
exports.optional = ['jar'];

// Define
exports.func = function (args) {
  var url = '//www.roblox.com';
  var httpOpt = {
    url: url
  };

  http(httpOpt).then(function (res) {
    var str = res;
    console.log(res);
    var regex = /setToken\(\'(.*)\'\);/gm

    var token = "";
    while (m = regex.exec(str)) {
      token = m[1];
    }

    var jar = args.jar || options.jar;
    var username = args.username;
    var password = args.password;

    clearSession({jar: jar});
      var url = '//auth.roblox.com/v2/login';
      var post = {
        "ctype": "Username",
        'cvalue': username,
        'password': password
      };
      var httpOpt = {
        url: url,
        options: {
          method: 'POST',
          json: post,
          resolveWithFullResponse: true,
          jar: jar,
          headers: {
            "X-CSRF-TOKEN": token
          }
        }
      };
      return http(httpOpt)
      .then(function (res) {
        var body = res.body;
        console.log(body);
        if (res.statusCode === 200) {
          if (settings.session_only) {
            var cookies = res.headers['set-cookie']; // If the user is already logged in a new cookie will not be returned.
            if (cookies) {
              var session = cookies.toString().match(/\.ROBLOSECURITY=(.*?);/)[1];
              jar.session = session;
            }
          }
        } else {
          var errors = [];
          if (res.statusCode !== 302) {
            var list = parser.load(body)('.validation-summary-errors').find('li');
            for (var i = 0; i < list.length; i++) {
              var err = list.eq(i).text();
              if (err.indexOf('Nice to meet you') > -1) {
                err = 'User does not exist';
              } else if (err.indexOf('robot') > -1) {
                err = 'Captcha';
              }
              errors.push(err);
            }
          } else if (res.headers.location.startsWith('/login/twostepverification')) {
            errors.push('Two step verification is not supported');
          } else {
            throw new Error('Login failed, unknown redirect: ' + res.headers.location);
          }
          throw new Error('Login failed, known issues: ' + JSON.stringify(errors));
        }
      });
  })


};
