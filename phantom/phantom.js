// Dependencies
var express = require('express');
var cors = require('cors');
var phantom = require('phantom');
var exec = require('child_process').exec;
var fs = require('fs');
var async = require('async');


// Set up Express app
var app = express();


// Container for debug messages.
var _debugMessages = {
  getTimestamp: function () {
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDate();
    var hours = date.getHours();
    var mins = date.getMinutes();
    var secs = date.getSeconds();

    if (month < 10) {
      month = '0' + month;
    }
    if (day < 10) {
      day = '0' + day;
    }
    if (hours < 10) {
      hours = '0' + hours;
    }
    if (mins < 10) {
      mins = '0' + mins;
    }
    if (secs < 10) {
      secs = '0' + secs;
    }
    return '[' + year + '-' + month + '-' + day + '@' + hours + ':' + mins + ':' + secs + ']';
  },
  getHead: function (label, requestId) {
    if(typeof requestId !== 'undefined' && requestId !== '') {
      return this.getTimestamp() + '[ReqID: ' + requestId + ']' + '[' + label + '] ';
    } else {
      return this.getTimestamp() + '[' + label + '] ';
    }
  },
  log: function (msg) {
    console.log(msg);
  },
  listening: function (msg) {
    this.log(this.getHead('Listening') + 'Listening on port: ' + msg);
    this.log('');
  },
  newRequest: function (useProxy, msg, requestId) {
    this.log(this.getHead('Request', requestId) + 'Incoming request from: ' + msg);
    if (useProxy !== false) {
      this.log(this.getHead('Request', requestId) + 'Requesting Proxy: ' + useProxy);
    }
  },
  validOrigin: function (msg, requestId) {
    this.log(this.getHead('NEW', requestId) + 'Request origin acknowledged: ' + msg);
  },
  invalidOrigin: function (msg, requestId) {
    this.log(this.getHead('NEW', requestId) + 'Request origin not recognized: ' + msg);
  },
  noProxy: function (requestId) {
    this.log(this.getHead('Proxy', requestId) + 'No proxy requested.');
  },
  usingProxy: function (msg, requestId) {
    this.log(this.getHead('Proxy', requestId) + 'Using Proxy: ' + msg);
  },
  unknownProxy: function (msg, requestId) {
    this.log(this.getHead('Proxy', requestId) + 'Unrecognized Proxy ID: ' + msg);
    this.log(this.getHead('Proxy', requestId) + 'Continuing with no proxy configured.');
  },
  reportUrl: function (msg, requestId) {
    this.log(this.getHead('URL', requestId) + 'Attempting to access: ' + msg);
  },
  newOutboundPort: function (msg, requestId) {
    this.log(this.getHead('Outbound Port', requestId) + 'Opening new outbound port: ' + msg);
  },
  closeOutboundPort: function (msg, requestId) {
    this.log(this.getHead('Outbound Port', requestId) + 'Closing current outbound port: ' + msg);
  },
  usingOutboundPort: function (msg, requestId) {
    this.log(this.getHead('Outbound Port', requestId) + 'Using current outbound port: ' + msg);
  },
  requestComplete: function (success, url, requestId) {
    if (success === true) {
      this.log(this.getHead('SUCCESS!', requestId) + 'Screenshot of ' + url + ' returned successfully!');
    } else {
      this.log(this.getHead('FAIL!', requestId) + 'Screenshot of ' + url + ' request failed!');
    }
  }
};


// Proxy Configuration
var _proxyConfig = {
  nyc: 'proxyanbcge.nbc.com:80',
  ec: '173.213.208.231:80',
  wc: '216.178.96.20:80'
};


// Whitelist Configuration
var _whitelistConfig = [
  'http://avalon.local:8000',
  'http://localhost:8000',
  'http://local.mobiledev.nbcuots.com:8000',
  'http://dev.mobiledev.nbcuots.com:8000',
  'dev.west.mobiledev.nbcuots.com:8000',
  'http://avalon.local',
  'http://localhost',
  'http://local.mobiledev.nbcuots.com',
  'http://dev.mobiledev.nbcuots.com',
  'dev.west.mobiledev.nbcuots.com'
];


// Routes Configuration
var _routesConfig = {
  // Set up endpoint for basic requests
  noproxy: '/status/:url',
  // Set up endpoint for request plus proxy
  proxy: '/status/:url/:proxy',
  compare: '/compare/:url/:compareurl',
  proxycompare: '/compare/:url/:compareurl/:proxy'
};


// Main Configuration Object
var Config = {
  // Cross-Origin Resource Sharing Configuration
  getCorsOptions: {
    // If the origin of the request is in our whitelist, we'll let the request in
    valid: function (origin, requestId) {
      Config.debug.validOrigin(origin, requestId);
      return { origin: true };
    },
    // If the origin is not in our whitelist, we'll reject the request
    invalid: function (origin, requestId) {
      Config.debug.invalidOrigin(origin, requestId);
      return { origin: false };
    }
  },

  // Proxy Configuration & Handling
  proxies: _proxyConfig,
  getProxyConfig: function (proxyId, requestId) {
    if (proxyId === false) {
      Config.debug.noProxy(requestId);
      return '';
    }

    if (Config.proxies.hasOwnProperty(proxyId)) {
      var proxyAddress = Config.proxies[proxyId];
      Config.debug.usingProxy(proxyAddress, requestId);
      return '--proxy=' + proxyAddress;
    }

    Config.debug.unknownProxy(proxyId, requestId);
    return '';
  },

  // Network Ports Configuration & Handling
  inboundPort: 3000,
  outboundPort: 12300,
  newOutboundPort: function (requestId) {
    Config.outboundPort++;
    Config.debug.newOutboundPort(Config.outboundPort, requestId);
  },
  closeOutboundPort: function (requestId) {
    Config.debug.closeOutboundPort(Config.outboundPort, requestId);
    Config.outboundPort--;
  },
  getOutboundPort: function (requestId) {
    Config.debug.usingOutboundPort(Config.outboundPort, requestId);
    return Config.outboundPort;
  },

  // Whitelist Configuration & Handling
  whitelist: _whitelistConfig,
  inWhitelist: function (item) {
    return (Config.whitelist.indexOf(item) !== -1);
  },

  // Routes Configuration
  routes: _routesConfig,

  // Debug Messages Handling
  debug: _debugMessages,

  // Track Requests
  requestId: 1000
};


// Cross-Origin Resource Sharing: Async Check
var corsOptionsDelegate = function (request, callback) {
  var requestId = Config.requestId++;
  request._global_id = requestId;
  var origin = request.header('Origin');
  var validOrigin = (Config.inWhitelist(origin)) ? 'valid' : 'invalid';
  callback(null, Config.getCorsOptions[validOrigin](origin, requestId));
};

function compareRequest(url, proxyId, res, requestId) {
  var results = {
    url: url,
    proxy: proxyId,
    status: false,
    loadTime: 0,
    pageTitle: '',
    responseHeaders: {},
    statusString: ''
  };

  var proxyConfig = Config.getProxyConfig(proxyId, requestId);

  var options = {
    port: Config.getOutboundPort(requestId)
  };
 // var arr = [url, compareurl];

  // New PhantomJS instance
  phantom.create(proxyConfig, options, function (ph) {

    var start_time = Date.now();

    // Create page with PhantomJS
    ph.createPage(function (page) {

      page.set('paperSize', {
        format: 'A4',
        orientation: 'landscape'
      });
      page.set('viewportSize', {width: 1024, height: 800}, function(result) {
        console.log(result);
      });
      page.set('onResourceReceived', function(resource) {
        // Phantom will fire this event for every resource on the page.

        // id: 1 appears to be the base page that we've requested.
        // Further, the page appears to get trigered twice:
        //  once for stage: "start" and once for stage: "end"
        //  So we collect the data on the end stage.
        //    NOTE: This was an arbitrary choice. I did not see any clear advantage to one over the other.
        if (resource.id === 1 && resource.stage === 'end') {
          results.responseHeaders = resource.headers;
          results.httpStatus = resource.status;
        }
      });

      var render = {
        success: function () {
          page.evaluate(function () {
            var title = '';
            if (document.getElementsByTagName('title').length) {
              title = document.getElementsByTagName('title')[0].textContent;
            }
            return title;
          }, function (title) {
            results.pageTitle = title;
          });

          var end_time = Date.now();
          var load_time = end_time - start_time;

          var i = 1;
          var filename = requestId + '_' + i + '.png';
          fs.exists(requestId + '_' + i + '.png', function (exists) {
            if (exists) {
              i++;
              filename = requestId + '_' + i + '.png';
            }
            page.render(filename);
          });
          // Save Screen Shot to Buffer
          page.renderBase64('png', function (buffer) {
            Config.closeOutboundPort(requestId);
            results.status = buffer;
            results.loadTime = load_time;
            results.statusString = 'up';
            results.title = this.title;
            results.timestamp = Date.now();
            render.postRender(true, results);
          });
        },
        fail: function () {
          // Return failure
          Config.closeOutboundPort(requestId);
          results.status = false;
          results.statusString = 'down';
          render.postRender(false, results);
        },
        postRender: function (success, results) {
          Config.debug.requestComplete(success, url, requestId);
          if (success == true) {
          fs.exists(requestId + '_2.png', function(exists) {
            if(exists) {
              fs.exists(requestId + '_1.png', function(exists) {
                if(exists) {
                  exec('compare -fuzz 20% -metric AE -highlight-color blue ' + requestId + '_1.png ' + requestId + '_2.png ' + requestId + '_3.png', function (err, stdout, stderr) {
                     console.log(err);
                     fs.exists(requestId + '_3.png', function(exists) {
                       if(exists) {
                         var base64_data = new Buffer(fs.readFileSync(requestId + '_3.png')).toString('base64');
                         results.status = base64_data;
                         res.jsonp(results);
                       } else {
                         results.status = false;
                         results.statusString = 'Error in taking screenshot, might be due to wrong urls, please check your site urls';
                         res.jsonp(results);
                       }
                     });
                  });
                }
              });
            }
          });
          } else {
            res.jsonp(results);
          }
          ph.exit();
        }
      };

      // Attempt to open a page
        page.open(url, function (status) {
          Config.debug.reportUrl(url, requestId);
          if (status === 'success') {

	  // If we are able to open the URL
          render.success();

          } else {
            // If we are not able to open the URL
            render.fail();
          }
        });

    });

  });
}

// Function to test to see if the URL is available
function testURL (url, proxyId, res, requestId) {
  var results = {
    url: url,
    proxy: proxyId,
    status: false,
    loadTime: 0,
    pageTitle: '',
    responseHeaders: {},
    statusString: ''
  };

  var proxyConfig = Config.getProxyConfig(proxyId, requestId);

  var options = {
    port: Config.getOutboundPort(requestId)
  };

  // New PhantomJS instance
  phantom.create(proxyConfig, options, function (ph) {

    var start_time = Date.now();

    // Create page with PhantomJS
    ph.createPage(function (page) {

      page.set('onResourceReceived', function(resource) {
        // Phantom will fire this event for every resource on the page.

        // id: 1 appears to be the base page that we've requested.
        // Further, the page appears to get trigered twice:
        //  once for stage: "start" and once for stage: "end"
        //  So we collect the data on the end stage.
        //    NOTE: This was an arbitrary choice. I did not see any clear advantage to one over the other.
        if (resource.id === 1 && resource.stage === 'end') {
          results.responseHeaders = resource.headers;
          results.httpStatus = resource.status;
        }
      });

      var render = {
        success: function () {
          page.evaluate(function () {
            var title = '';
            if (document.getElementsByTagName('title').length) {
              title = document.getElementsByTagName('title')[0].textContent;
            }
            return title;
          }, function (title) {
            results.pageTitle = title;
          });

          var end_time = Date.now();
          var load_time = end_time - start_time;

          // Save Screen Shot to Buffer
          page.renderBase64('png', function (buffer) {
            Config.closeOutboundPort(requestId);
            results.status = buffer;
            results.loadTime = load_time;
            results.statusString = 'up';
            results.title = this.title;
            results.timestamp = Date.now();
            render.postRender(true, results);
          });
        },
        fail: function () {
          // Return failure
          Config.closeOutboundPort(requestId);
          results.status = false;
          results.statusString = 'down';
          render.postRender(false, results);
        },
        postRender: function (success, results) {
          Config.debug.requestComplete(success, url, requestId);
          res.jsonp(results);
          ph.exit();
        }
      };

      // Attempt to open a page
      page.open(url, function (status) {
        Config.debug.reportUrl(url, requestId);
        if (status === 'success') {
          // If we are able to open the URL
          render.success();
        } else {
          // If we are not able to open the URL
          render.fail();
        }
      });

    });

  });
}


// Process incoming request, and prepare environment.
function processRequest (request, response) {
  var origin = request.headers.origin;
  var url = request.params.url;
  var useProxy = false;
  if (typeof request.params.proxy !== 'undefined') {
    useProxy = request.params.proxy;
  }
  if (request.params.compareurl !== undefined) {
    var compareurl = request.params.compareurl;
    fs.exists(request._global_id + '_1.png', function(exists) {
      if (exists) {
        fs.unlinkSync(request._global_id + '_1.png');
      }
    });
    fs.exists(request._global_id + '_2.png', function(exists) {
      if (exists) {
        fs.unlinkSync(request._global_id + '_2.png');
      }
    });
    fs.exists(request._global_id + '_3.png', function(exists) {
      if (exists) {
        fs.unlinkSync(request._global_id + '_3.png');
      }
    });

    compareHandler(origin, url, useProxy, response, request._global_id);
    setTimeout(function() {
    compareHandler(origin, compareurl, useProxy, response, request._global_id);
    }, 1000);
  } else {
    requestHandler(origin, url, useProxy, response, request._global_id);
  }
}


// Handle request.
function requestHandler (origin, url, proxy, response, requestId) {
  Config.debug.newRequest(proxy, origin, requestId);
  Config.newOutboundPort(requestId);
  testURL(url, proxy, response, requestId);
}

// Handle request.
function compareHandler (origin, url, proxy, response, requestId) {
  Config.debug.newRequest(proxy, origin, requestId);
  Config.newOutboundPort(requestId);
  compareRequest(url, proxy, response, requestId);
}

// ---- MAIN PROCESSING, BELOW THIS LINE ----

// Configure Routes
for (var route in Config.routes) {
  app.get(Config.routes[route], cors(corsOptionsDelegate), processRequest);
}

// Start Server
app.listen(Config.inboundPort, function () {
  Config.debug.listening(Config.inboundPort);
});
