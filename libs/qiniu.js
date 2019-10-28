var download = require('download');
var path = require('path');
var log4js = require('log4js');
var Thenjs = require('thenjs');

var config = require(path.join(__dirname, '../config.json'));
var logger = log4js.getLogger('download');
var got = require('got');

var bucketMap = config.bucketMap;

var qiniu = {
    downloadFile: function (data, callback) {
        var bucket = data.bucket;
        if (data.dataPaths) {
            Thenjs()
                .each(data.dataPaths, function (cont, dataPath) {
                    var key = dataPath;
                    var downUrl = config.downloadProt + bucketMap[bucket] + '/' + encodeURIComponent(key);
                    got.head(downUrl) // 预检查
                        .then(function () { return download(downUrl, path.join(config.downloadPath, path.dirname(key))); })
                        .then(function () {
                            logger.info(data._id + config.delimiter + dataPath);
                            cont(null, dataPath);
                        })
                        .catch(function (e) {
                            logger.error(e.message + ' ' + downUrl);
                            logger.error(data._id + config.delimiter + dataPath);
                            cont(null, dataPath);
                        });
                }).fin(function () { callback(null, data); });
        } else if (data.dataPath) {
            var key = data.dataPath;
            var downUrl = config.downloadProt + bucketMap[bucket] + '/' + key;
            got.head(downUrl) // 预检查
                .then(function () { return download(downUrl, path.join(config.downloadPath, path.dirname(key))); })
                .then(function () {
                    logger.info(data._id + config.delimiter + data.dataPath);
                    callback(null, data);
                })
                .catch(function (e) {
                    logger.error(e.message + ' ' + downUrl);
                    logger.error(data._id + config.delimiter + data.dataPath);
                    callback(new Error('error download: ' + data._id));
                });
        }
    }
};

module.exports = qiniu;
