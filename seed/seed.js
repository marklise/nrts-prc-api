'use strict';

//
// Example: node seed.js MONGO_USER MONGO_PASSWORD mongodb nrts-prod
//

const rp = require('request-promise');
const cheerio = require('cheerio');
const u = 'https://arfd.gov.bc.ca/ApplicationPosting/index.jsp?pp=60&cp=';


var Promise         = require('es6-promise').Promise;
var _               = require('lodash');
var request         = require('request');
var fs              = require('fs');
var _applications   = [];
var _commentPeriods = [];
var _organizations  = [];
var _decisions      = [];
var _comments       = [];
var username        = '';
var password        = '';
var protocol        = 'http';
var host            = 'localhost';
var port            = '3000'
var uri             = '';

const options = {
  uri: '',
  transform: function (body) {
    return cheerio.load(body);
  }
};

var args = process.argv.slice(2);
if (args.length !== 5) {
  console.log('');
  console.log('Please specify proper parameters: <username> <password> <protocol> <host> <port>');
  console.log('');
  console.log('eg: node seed.js admin admin http localhost 3000');
  return;
} else {
  username    = args[0];
  password    = args[1];
  protocol    = args[2];
  host        = args[3];
  port        = args[4];
  uri         = protocol + '://' + host + ':' + port + '/'; 
  console.log('Using connection:', uri);
}
// return;
// JWT Login
var jwt_login = null;
var login = function (username, password) {
  return new Promise (function (resolve, reject) {
    var body = JSON.stringify({
        username: username,
        password: password
      });
    request.post({
        url: uri + 'api/login/token',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      }, function (err, res, body) {
        if (err || res.statusCode !== 200) {
          // console.log("err:", err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          // console.log("jwt:", data);
          jwt_login = data.accessToken;
          resolve(data.accessToken);
        }
    });
  });
};

var doWork = function (e, route) {
  return new Promise(function (resolve, reject) {
      console.log("-----------------------");
      console.log("route:", route);
      console.log("e:", e);
      var postBody = JSON.stringify(e);

      // Bind the objectID's
      if (route === 'api/document' || route === 'api/commentperiod') {
        // console.log('app:', _applications);
        // console.log('e._application:', e._application);
        // console.log('e._decision:', e._decision);
        // console.log('e._comment:', e._comment);
        if (e._application) {
          var f = _.find(_applications, {code: e._application});
          e._application = f._id;
        } else if (e._decision) {
          var f = _.find(_decisions, {code: e._decision});
          e._decision = f._id;
        }

        if (route === 'api/document') {
          if (e._comment) {
            var f = _.find(_comments, {code: e._comment});
            e._comment = f._id;
          }
        }
      }
      if (route === 'api/public/comment') {
        // console.log('cmt:', _commentPeriods);
        var f = _.find(_commentPeriods, {code: e.commentPeriod});
        e._commentPeriod = f._id;
      }
      if (route === 'api/application') {
        // console.log('org:1', e.proponent);
        // console.log('org:2', _.find(_organizations, { name: e.proponent}));
        // FOR NOW, USING CLIENT STRING INSTEAD OF REF TO ORGANIZATION
        // var f = _.find(_organizations, { name: e.proponent});
        // e._proponent = f._id;
        e.client = e.client;
      }
      if (route === 'api/decision') {
        var f = _.find(_applications, { code: e._application});
        // e._decision = f._id;
        e._application = f._id;
      }
      postBody = JSON.stringify(e);
      // end bind objectID's

      if (route === 'api/document') {
        var formData = {
          upfile: fs.createReadStream(e.internalURL),
          displayName: e.displayName
        };
        if (e._application) {
          formData._application = e._application;
        }
        if (e._decision) {
          formData._decision = e._decision;
        }
        if (e._comment) {
          // console.log("form:", formData);
          formData._comment = e._comment;
        }
        request.post({ url: uri + route,
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': 'Bearer ' + jwt_login
                      },
                      formData: formData
                    },
          function optionalCallback(err, httpResponse, body) {
            var data = JSON.parse(body);
              if (err) {
                console.error('upload failed:', err);
                reject(null);
              } else {
                // Update it to be public
                request.put({
                    url: uri + route + '/' + data._id + '/publish',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + jwt_login
                    },
                    body: postBody
                }, function (err2, res2, body2) {
                  if (err2 || res2.statusCode !== 200) {
                    console.log("err2:", err2);
                    reject(null);
                  } else {
                    resolve("Updated:", body2._id);
                  }
                });

              }
          }
        );
      } else {
        request.post({
            url: uri + route,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + jwt_login
            },
            body: postBody
          }, function (err, res, body) {
            if (err || res.statusCode !== 200) {
              // console.log("err:", err, res);
              reject(null);
            } else {
              var data = JSON.parse(body);
              // Save the various objects for later lookup
              if (route === 'api/application') {
                  _applications.push(data);
              }
              if (route === 'api/commentperiod') {
                _commentPeriods.push(data);
              }
              if (route === 'api/public/comment') {
                _comments.push(data);
              }
              if (route === 'api/organization') {
                  _organizations.push(data);
              }
              if (route === 'api/decision') {
                _decisions.push(data);
              }

              if (route === 'api/public/comment') {
                // Swap to the authenticated access route.
                route = 'api/comment';
              }
              // Update it to be public - assume everything public
              // unless it has the magic flag.
              if (e.seedDontPublish) {
                resolve();
              } else {
                request.put({
                  url: uri + route + '/' + data._id + '/publish',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + jwt_login
                  },
                  body: postBody
                  }, function (err3, res2, body2) {
                    if (err3 || res2.statusCode !== 200) {
                    console.log("err3:", err3);
                    reject(null);
                  } else {
                    resolve("Updated:", body2._id);
                  }
                });
              }
            }
        });
      }
  });
};

var insertAll = function (route, entries) {
  var self = this;
  return new Promise(function (resolve, reject) {
    console.log("route:", route);
    console.log("entries:", entries);

    Promise.resolve ()
    .then (function () {
      return entries.reduce (function (current, item) {
        return current.then (function () {
          return doWork(item, route);
        });
      }, Promise.resolve());
    }).then(resolve, reject);
  });
};

var updateAll = function (collectionName, entries) {
  if (_.isEmpty(entries)) {
    return Promise.resolve();
  }
  var updates = _.map(entries, function (entry) {
    return update(collectionName, { _id: entry._id }, entry);
  });
  return Promise.all(updates);
};

var getDetails = function (fileObj) {
  return new Promise(function(resolve, reject) {
  request.get({
      url: 'https://comment.nrs.gov.bc.ca/api/public/search/bcgw/crownLandsId/' + fileObj.fileno,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + jwt_login
      },
    }, function (err3, res2, body) {
      if (err3 || res2.statusCode !== 200) {
        console.log("err3:", err3);
        reject(null);
      } else {
        var data = JSON.parse(body);
        console.log("details:", data);
        // parse out the features, and look for a disp
        console.log("Features:", data.totalFeatures, "for CL:", fileObj);
        if (data.totalFeatures !== 0 ) {
          console.log("DISP:", data.features[0].properties.DISPOSITION_TRANSACTION_SID, "Status:", data.features[0].properties.TENURE_STATUS);
          var o = {
              "addedBy": "admin",
              "client": fileObj.client,
              "tags": [
                  [
                      "public"
                  ],
                  [
                      "sysadmin"
                  ]
              ],
              "code": data.features[0].properties.CROWN_LANDS_FILE,
              "name": data.features[0].properties.CROWN_LANDS_FILE,
              "cl_file": data.features[0].properties.CROWN_LANDS_FILE,
              "type": data.features[0].properties.TENURE_TYPE,
              "subtype": data.features[0].properties.TENURE_SUBTYPE,
              "purpose": data.features[0].properties.TENURE_PURPOSE,
              "subpurpose": data.features[0].properties.TENURE_SUBPURPOSE,
              "status": data.features[0].properties.TENURE_STATUS,
              "region": data.features[0].properties.RESPONSIBLE_BUSINESS_UNIT,
              "location": data.features[0].properties.TENURE_LOCATION,
              "businessUnit": data.features[0].properties.RESPONSIBLE_BUSINESS_UNIT,
              "areaHectares": data.features[0].properties.TENURE_AREA_IN_HECTARES,
              "legalDescription": data.features[0].properties.TENURE_LEGAL_DESCRIPTION,
              "agency": "Crown Land Allocation",
              "description": "TBD",
              "tantalisID": data.features[0].properties.DISPOSITION_TRANSACTION_SID,
              "internalID": data.features[0].properties.OBJECTID,
              "interestID": data.features[0].properties.INTRID_SID
          };
          // applist.push(o);
          // resolve(o);
          doWork(o, 'api/application')
          .then(resolve, reject);
        } else {
          resolve(null);
        }
      }
    });
  });
}

var doPageScrape = function (url) {
  return new Promise(function (resolve, reject) {
    // for (var i = 1;i <= 28;i++) {
        options.uri = u + url;
        console.log(options);
        rp(options)
        .then(($) => {
            // console.log($);
            var applist = [];
            return new Promise(function (res, rej) {
              $('.ColorBox1').each(function (i) {
                  var client = $('td', this).children().attr('href');
                  client = client.substr(client.indexOf('rd=')+3);
                  client = client.replace('\' }');
                  var purpsubpurp = $('td', this).next().children().attr('href');
                  purpsubpurp = purpsubpurp.substr(purpsubpurp.indexOf('rd=')+3);
                  purpsubpurp = purpsubpurp.replace('\' }');
                  var region = $('td', this).next().next().children().attr('href');
                  region = region.substr(region.indexOf('rd=')+3);
                  region = region.replace('\' }');
                  var fileno = $('td', this).next().next().next().children().attr('href');
                  fileno = fileno.substr(fileno.indexOf('rd=')+3);
                  fileno = fileno.replace('\' }');
                  var status = $('td', this).next().next().next().next().children().attr('href');
                  status = status.substr(status.indexOf('rd=')+3);
                  status = status.replace('\' }');
                  var date = $('td', this).next().next().next().next().next().children().attr('href');
                  date = date.substr(date.indexOf('rd=')+3);
                  date = date.replace('\' }');
                  var ref = $('td', this).next().next().next().next().next().next().children('a').attr('href');
                  // console.log("i:", i);
                  // console.log(client);
                  // console.log(purpsubpurp);
                  // console.log(region);
                  // console.log(fileno);
                  // console.log(status);
                  // console.log(date);
                  // console.log(ref);
                  var newObj = {
                      client: client,
                      region: region,
                      purpsubpurp: purpsubpurp,
                      fileno: fileno,
                      date: date,
                      ref: ref
                  };
                  applist.push(newObj);
                  // console.log("o:", newObj.ref);
                  // return insertAll('api/application', applist);
                  // return applist;
              });
              $('.ColorBox0').each(function (i) {
                var client = $('td', this).children().attr('href');
                client = client.substr(client.indexOf('rd=')+3);
                client = client.replace('\' }');
                var purpsubpurp = $('td', this).next().children().attr('href');
                purpsubpurp = purpsubpurp.substr(purpsubpurp.indexOf('rd=')+3);
                purpsubpurp = purpsubpurp.replace('\' }');
                var region = $('td', this).next().next().children().attr('href');
                region = region.substr(region.indexOf('rd=')+3);
                region = region.replace('\' }');
                var fileno = $('td', this).next().next().next().children().attr('href');
                fileno = fileno.substr(fileno.indexOf('rd=')+3);
                fileno = fileno.replace('\' }');
                var status = $('td', this).next().next().next().next().children().attr('href');
                status = status.substr(status.indexOf('rd=')+3);
                status = status.replace('\' }');
                var date = $('td', this).next().next().next().next().next().children().attr('href');
                date = date.substr(date.indexOf('rd=')+3);
                date = date.replace('\' }');
                var ref = $('td', this).next().next().next().next().next().next().children('a').attr('href');
                // console.log("i:", i);
                // console.log(client);
                // console.log(purpsubpurp);
                // console.log(region);
                // console.log(fileno);
                // console.log(status);
                // console.log(date);
                // console.log(ref);
                var newObj = {
                    client: client,
                    region: region,
                    purpsubpurp: purpsubpurp,
                    fileno: fileno,
                    date: date,
                    ref: ref
                };
                applist.push(newObj);
                // console.log("o:", newObj.ref);
                // return insertAll('api/application', applist);
                // return applist;
            });
              res(applist);
            });
        })
        .then(function (a) {
          console.log("a:", a.length);
          // resolve(a);
          Promise.resolve ()
          .then (function () {
            return a.reduce (function (current, item) {
              return current.then (function () {
                console.log("item:", item.fileno);
                return getDetails(item);
              });
            }, Promise.resolve());
          }).then(resolve, reject);
        })
        .catch((err) => {
            console.log(err);
        });
    // }
      });
};


console.log("Logging in and getting JWT:");
login(username, password)
// .then(function () {
//   var orglist = require('./orglist.json');
//   return insertAll('api/organization', orglist);
// })
.then(function () {
  // var applist = require('./applist.json');
  const rp = require('request-promise');
  const cheerio = require('cheerio');
  const u = 'https://arfd.gov.bc.ca/ApplicationPosting/index.jsp?pp=60&cp=';
  const options = {
      uri: '',
      transform: function (body) {
        return cheerio.load(body);
      }
    };

    var promises = [];
    for (var i = 1; i <= 28; i++) {
      // doPageScrape(i);
      promises.push(i);
    }

    return new Promise(function (resolve, reject) {
      Promise.resolve ()
      .then (function () {
        return promises.reduce (function (current, item) {
          return current.then (function () {
            return doPageScrape(item);
          });
        }, Promise.resolve());
      })
      .then (resolve, reject);
    });

  // return insertAll('api/application', applist);
})
// .then(function () {
//   var cplist = require('./commentperiodlist.json');
//   return insertAll('api/commentperiod', cplist);
// })
// .then(function () {
//   var dlist = require('./decisionlist.json');
//   return insertAll('api/decision', dlist);
// })
// .then(function () {
//   var clist = require('./commentlist.json');
//   return insertAll('api/public/comment', clist);
// })
// .then(function () {
//   var orglist = require('./doclist.json');
//   return insertAll('api/document', orglist);
// })
.catch(function (err) {
  console.log("ERR:", err);
});
