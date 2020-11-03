// Includes
var http = require('../util/http.js').func;
var getGeneralToken = require('../util/getGeneralToken.js').func;

const getFunds = ({ jar, token, groupID }) => {
  const httpOptions = {
    url: `https://economy.roblox.com/v1/groups/4346363/currency`,
    options: {
      resolveWithFullResponse: true,
      method: 'GET',
      jar: jar,
      headers: {
        'X-CSRF-TOKEN': token,
      },
    }
  };

  return http(httpOptions)
      .then(res => {
        console.log('Request Status Code: ' + res.statusCode, res.headers, res.body);
        if (res.statusCode !== 200) {
          throw new Error(res.statusMessage);
        }
      })
};

module.exports = (args) => {
  const jar = args.jar;
  const group = args.group;

  return getGeneralToken({ jar: jar })
         .then(xcsrf => {
           return getFunds({ jar, groupID: group, token: xcsrf });
         });
}
