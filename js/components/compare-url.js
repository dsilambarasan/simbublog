
define(['angular', 'checkSiteStatus', 'siteCompareStatus', 'parseURL'], function () {
  var siteCompare = angular.module('lighthouse.siteCompare', ['lighthouse.compareSite', 'lighthouse.parseURL']);

  var local_PhantomServerConfig = [{
    name: 'localhost',
    description: 'Localhost Screen Shot',
    host: 'http://localhost:3000/status/',
    proxy: '',
    modifier: false
  }];

  var remote_PhantomServerConfig = [{
    name: 'East',
    description: 'East Coast Screen Shot',
    host: 'http://dev.mobiledev.nbcuots.com:3000/status/',
    proxy: '/ec',
    modifier: false
  }/*,
  {
    name: 'West',
    description: 'West Coast Screen Shot',
    host: 'http://dev.west.mobiledev.nbcuots.com:3000/status/',
    proxy: '/wc',
    modifier: false
  }*/];


  siteCompare.factory('compareStatusServers', function () {
    return remote_PhantomServerConfig;
    //return local_PhantomServerConfig;
  });

  siteCompare.factory('compareAppServer', function () {
    return [{
      name: 'East',
      description: 'East Coast Screen Shot',
      host: 'http://dev.mobiledev.nbcuots.com:3000/compare/',
      proxy: '/ec',
      modifier: false
    }];
  });

  siteCompare.controller('siteCompareController', function ($scope, compareAppServer, checkSiteStatus, siteCompareStatus, parseURL, $location, $log, compareStatusServers, $timeout, orders, tempStorage, siteConfig, assignedRules, files, $q, comments, $routeParams, $anchorScroll, $route) {
        $scope.loader = false;
        $scope.testResults = {};

        angular.forEach(compareStatusServers, function (val) {
          var _testId = val.name;
          var _testId_compare = val.name + '_compare';
          var _testId_diff = val.name + '_diff';
          angular.forEach([_testId, _testId_compare, _testId_diff], function(value) {
            $scope.testResults[value] = {};
            $scope.testResults[value].description = val.description;
            $scope.testResults[value].statusImage = false;
            $scope.testResults[value].statusMessage = '';
            $scope.testResults[value].loadingStatus = 'hidden';
            $scope.testResults[value].responseCode = false;
            $scope.testResults[value].responseStatus = false;
            $scope.testResults[value].responseTime = false;
            $scope.testResults[value].pageTitle = false;
            $scope.testResults[value].timestamp = false;
          });
        });

        var _throwErrors = function () {
          // Do something meaningful?
        };

        var imageStorage = [];
        var storage = [];

        var _onPhantomCompareSuccess = function (results) {
          $log.debug('Test Result Digest:', results);
          $scope.loader = false;


          if (results.outage) {
            $log.debug('Outage detected!');
          } else {
            $log.debug('At least one test returned successfully. Site is not experiencing an outage.');
            var temp = tempStorage.get();

            //angular.forEach(compareStatusServers, function (val) {
              var _localtestId = results.results[0].region;
              var _testId = results.results[0].region;
              if ($scope.siteStatus.compareUrl === results.results[0].url) {
                _localtestId = _testId + '_compare';
              }

              imageStorage[_localtestId] = {};
              storage[_localtestId] = {};
              tempStorage.add('siteResponseDescription', '');
              //$log.debug('results[' + _testId + ']', results[_testId]);

              if (results[_testId].hasOwnProperty('statusImage')) {
                if (results[_testId].statusImage !== false) {
                  imageStorage[_localtestId].statusImage = results[_testId].statusImage;
                  imageStorage[_localtestId][results.results[0].url] = results[_testId].statusImage;
                }
                $scope.testResults[_localtestId].statusImage = results[_testId].statusImage;
              }
              if (results[_testId].hasOwnProperty('statusMessage')) {
                storage[_localtestId].statusMessage = $scope.testResults[_localtestId].statusMessage = results[_testId].statusMessage;
              }
              if (results[_testId].hasOwnProperty('loadingStatus')) {
                storage[_localtestId].loadingStatus = $scope.testResults[_localtestId].loadingStatus = results[_testId].loadingStatus;
              }
              if (results[_testId].hasOwnProperty('statusCode')) {
                storage[_localtestId].responseCode = $scope.testResults[_localtestId].responseCode = results[_testId].statusCode;
              }
              if (results[_testId].hasOwnProperty('statusString')) {
                storage[_localtestId].responseStatus = $scope.testResults[_localtestId].responseStatus = results[_testId].statusString;
              }
              if (results[_testId].hasOwnProperty('loadTime')) {
                storage[_localtestId].responseTime = $scope.testResults[_localtestId].responseTime = results[_testId].loadTime;
              }
              if (results[_testId].hasOwnProperty('pageTitle')) {
                storage[_localtestId].pageTitle = $scope.testResults[_localtestId].pageTitle = results[_testId].pageTitle;
              }
              if (results[_testId].hasOwnProperty('timestamp')) {
                storage[_localtestId].timestamp = $scope.testResults[_localtestId].timestamp = results[_testId].timestamp;
              }
              tempStorage.add('siteResponseDescription', storage);
              tempStorage.add('siteResponseImage', imageStorage);


              //console.log(imageStorage.East_compare.statusImage);
              angular.forEach(compareStatusServers, function (val) {
                if (angular.isDefined(imageStorage[results.results[0].region + '_compare'])) {

                  console.log('comikng');
                  siteCompareStatus.compareApplications($scope.siteStatus.url, $scope.siteStatus.compareUrl, compareAppServer).then(_onPhantomResultSuccess, _onPhantomResultError);
                }
              });

              /*var binary = btoa(imageStorage.East_compare.statusImage.split(',')[1]);
              console.log(binary);
              var array = [];
              for (var i = 0; i < binary.length; i++) {
                array.push(binary.charCodeAt(i));
              }
              var file = new Blob([new Uint8Array(array)], {type: 'image/jpeg'});
              console.log(file);*/

            //});

          }
        };

        var _onPhantomCompareError = function (error) {
          $log.debug('Site Status Service Unavailable.', error);
        };

        var _onPhantomResultSuccess = function(results) {
          $scope.loader = false;

          if (results.outage) {
            $log.debug('No difference');
          } else {
            $log.debug('Difference is there');

            var _testId = results.results[0].region;
            var _localtestId = _testId + '_diff';

            imageStorage[_localtestId] = {};
            storage[_localtestId] = {};

            if (results[_testId].hasOwnProperty('statusImage')) {
              if (results[_testId].statusImage !== false) {
                imageStorage[_localtestId].statusImage = results[_testId].statusImage;
              }
              $scope.testResults[_localtestId].statusImage = results[_testId].statusImage;
            }
            if (results[_testId].hasOwnProperty('statusMessage')) {
              storage[_localtestId].statusMessage = $scope.testResults[_localtestId].statusMessage = results[_testId].statusMessage;
            }
            if (results[_testId].hasOwnProperty('loadingStatus')) {
              storage[_localtestId].loadingStatus = $scope.testResults[_localtestId].loadingStatus = results[_testId].loadingStatus;
            }
            if (results[_testId].hasOwnProperty('statusCode')) {
              storage[_localtestId].responseCode = $scope.testResults[_localtestId].responseCode = results[_testId].statusCode;
            }
            if (results[_testId].hasOwnProperty('statusString')) {
              storage[_localtestId].responseStatus = $scope.testResults[_localtestId].responseStatus = results[_testId].statusString;
            }
            if (results[_testId].hasOwnProperty('loadTime')) {
              storage[_localtestId].responseTime = $scope.testResults[_localtestId].responseTime = results[_testId].loadTime;
            }
            if (results[_testId].hasOwnProperty('pageTitle')) {
              storage[_localtestId].pageTitle = $scope.testResults[_localtestId].pageTitle = results[_testId].pageTitle;
            }
            if (results[_testId].hasOwnProperty('timestamp')) {
              storage[_localtestId].timestamp = $scope.testResults[_localtestId].timestamp = results[_testId].timestamp;
            }
          }
        };

        var _onPhantomResultError = function(error) {
          $log.debug('Compare Service Unavailable.', error);
        };

        var _parseUrl = function(url) {
          var urlSplice = url.split('://');
          if (urlSplice.length < 2) {
            url = 'http://' + url;
          } else {
            if (urlSplice[0].toUpperCase() !== 'HTTP' && urlSplice[0].toUpperCase() !== 'HTTPS') {
              _throwErrors();
              return false;
            }
          }
          return url;
        };

        $scope.check = function(siteStatus) {
          // Grab URL from form
          var url = _parseUrl(siteStatus.url);
          var compareUrl = _parseUrl(siteStatus.compareUrl);

          angular.forEach(compareStatusServers, function (val) {
            var _testId = val.name;
            var _testId_compare = val.name + '_compare';
            var _testId_diff = val.name + '_diff';
            angular.forEach([_testId, _testId_compare, _testId_diff], function(value) {
              $scope.testResults[value].statusImage = false;
            });
         });

          $scope.loader = true;

          siteCompareStatus.compareApplications(url, compareUrl, compareAppServer).then(_onPhantomResultSuccess, _onPhantomResultError);
/*
          var url = siteStatus.url;
          parseURL.parse(url).then(function (resp) {
            if (resp.isValid) { // Only continue if the URL is valid
              // Add in the throbber
               angular.forEach(compareStatusServers, function (val) {
                 $scope.testResults[val.name].statusImage = false;
               });

              // URL checking of site status
              checkSiteStatus.checkFromAllOrigins(resp, compareStatusServers).then(_onPhantomCompareSuccess, _onPhantomCompareError);

              tempStorage.add('siteUrl', url);
              $timeout(function() {
                var compareurl = siteStatus.compareUrl;
                parseURL.parse(compareurl).then(function (resp) {
                  if (resp.isValid) { // Only continue if the URL is valid
                    // Add in the throbber
                     angular.forEach(compareStatusServers, function (val) {
                       $scope.testResults[val.name + '_compare'].statusImage = false;
                     });

                    // URL checking of site status
                    checkSiteStatus.checkFromAllOrigins(resp, compareStatusServers).then(_onPhantomCompareSuccess, _onPhantomCompareError);

                    tempStorage.add('compareUrl', compareurl);
                  } else { // If not valid, throw errors
                    _throwErrors();
                  }
                });
              }, 200);
            } else { // If not valid, throw errors
              _throwErrors();
            }
          }); */
        };

  });

});
