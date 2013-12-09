//////////////////////////////
// Check Site Status
//////////////////////////////
define(['angular'], function () {

  var DEFAULT_PHANTOM_URL = 'http://localhost:3000/status/';


  var compareSite = angular.module('lighthouse.compareSite', []);


  compareSite.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
  }]);


  compareSite.factory('siteCompareStatus', function ($q, $http, $log) {

    var _verifyResults = function (results) {
      // Let's assume we have an outage, until proven otherwise.
      var outage = true;
      angular.forEach(results.results, function (v) {
        if (v.success === true) {
          // If we have one success, we can confirm there is no outage.
          outage = false;
        }
      });
      results.outage = outage;
      return results;
    };

    var _processQueryParameters = function (url, compareUrl, params) {
      if (typeof params === 'undefined') {
        params = {};
        params.requestUrl = DEFAULT_PHANTOM_URL + url + '/' + compareUrl;
        return params;
      }

      if (params.hasOwnProperty('host')) {
        params.requestUrl = params.host + url + '/' + compareUrl;

        if (params.hasOwnProperty('proxy')) {
          if (params.proxy !== false && params.proxy !== ''){
            params.requestUrl += params.proxy;
          }
        }
      } else {
        params.requestUrl = url + compareUrl;
      }

      return params;
    };

    var _screenShotSuccess = function (data) {
      return {
        statusImage: data.status,
        statusCode: data.httpStatus,
        loadTime: data.loadTime,
        pageTitle: data.pageTitle,
        headers: data.responseHeaders,
        statusString: data.statusString,
        timestamp: Date(data.timestamp).toLocaleString(),
        statusMessage: 'Success!',
        loadingStatus: 'status-loaded'
      };
    };

    var _screenShotFail = function (error) {
      return {
        statusImage: false,
        statusMessage: error,
        loadingStatus: 'status-error'
      };
    };

    var _successObj = function (url, region, success) {
      return {
        region: region,
        url: url,
        success: success
      };
    };

    var _getQueryParams = function (val) {
      if (val.proxy === false){
        val.proxy = '';
      }

      return {
        host: val.host,
        proxy: val.proxy
      };
    };

    var URLModifiers = {
      getRootDomain: function (urlobject) {
        return urlobject.root;
      }
    };


    /*
      This method makes the actual call(s) to our phanom server.
    */
    var query = function (url, compareUrl, params) {
      $log.debug('Checking URL: ', url);
      var deferred = $q.defer();

      var encodedUrl = encodeURIComponent(url);
      var encodedCompareUrl = encodeURIComponent(compareUrl);
      params = _processQueryParameters(encodedUrl, encodedCompareUrl, params);
      var requestUrl = params.requestUrl;
      $log.debug('Phantom Service Request URL: ', requestUrl);

      $http.get(requestUrl, {timeout: 10000}).success(function (data) {
        if (data.status !== false && data.status !== '') {
          // If we have a screen shot, we return it.
          deferred.resolve(data);
        } else {
          deferred.reject(url + ' is unavailable.');
        }
      }).error(function () {
        deferred.reject('The service could not be reached');
      });

      return deferred.promise;
    };


    /*
      This method takes a configuration object for running multiple tests.

      urlObj - an object that's been returned by our parseURL utility.
      testConfig - an array of tests, with associated configuration
    */
    var compareApplications = function (url, compareUrl, testConfig) {
      console.log(url);
      var deferred = $q.defer();

      var results = {
        results: []
      };

      // We use our own counter because angular.forEach does not
      // appear to guarantee the array is traversed in order.
      //
      // This might be a bug in angular.forEach. ??
      var _countTests = 0;

      angular.forEach(testConfig, function (val) {
        var _url = url;
        var _compareUrl = compareUrl;

        if(val.hasOwnProperty('modifier') && val.modifier !== false && val.modifier !== '') {
          var modFunction = val.modifier;
          if (URLModifiers.hasOwnProperty(modFunction)) {
            //_url = URLModifiers[modFunction](urlObj);
          } else {
            // Throw error: Unrecognized Modifier.
          }
        }

        var _queryParams = _getQueryParams(val);
        var _testId = val.name;

        var _success = function (response) {
          _countTests++;

          console.log('Success Response:', response);

          results[_testId] = _screenShotSuccess(response);
          results.results.push(_successObj(_url, _testId, true));

          if(testConfig.length === _countTests) {
            deferred.resolve(_verifyResults(results));
          }
        };

        var _failure = function (error) {
          _countTests++;

          results[_testId] = _screenShotFail(error[0]);
          results.results.push(_successObj(_url, _testId, false));

          if(testConfig.length === _countTests) {
            deferred.resolve(_verifyResults(results));
          }
        };

        query(_url, _compareUrl, _queryParams).then(_success, _failure);
      });

      return deferred.promise;
    };

    return {
      query: query,
      compareApplications: compareApplications
    };
  });

});
