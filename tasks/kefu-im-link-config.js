'use strict';
var log4js = require('log4js');
var path = require('path');

var mongo = require(path.join(__dirname, '../mongo'));

var logger = log4js.getLogger();

// var config = require(path.join(__dirname, '../config.json'));
var findExp = { logo: { $exists: true, $ne: {} } };

var imLinkConfigTask = {
    perpareCollection: function (callback) { // 获取待更新的collection
        callback(null, [{ dbName: 'cc', collectionName: 'app_kefu_im_link_config' }, { dbName: 'cc', collectionName: 'app_km_item' }]);
    },
    count: function (data, callback) {
        mongo.db(data.dbName).collection(data.collectionName).find(findExp).count({}, callback);
    },
    query: function (data, callback) {
        var dbName = data.dbName;
        var collectionName = data.collectionName;
        var limit = data.limit || 10;
        var page = data.page || 1;
        var skip = (page - 1) * limit;
        mongo.db(dbName).collection(collectionName).find(findExp).skip(skip).limit(limit).toArray(function (err, docs) {
            if (!err) {
                try {
                    var res = [];
                    docs.forEach(function (data) {
                        var bucketName = 'm7-test';
                        try {
                            if (!data.logo.id) return;
                            if (data.logo.id && data.logo.id.search(/N.+?\/customer\//) === -1) return; // 过滤不是bucket的数据
                            var dataPath = data.logo.id;
                            res.push({ _id: data._id, dataPath: dataPath, rowData: data, bucketName: bucketName });
                        } catch (e) {
                            logger.error(data.message);
                            logger.error(e);
                        }
                    });
                    callback(null, res);
                } catch (e) {
                    logger.error(data.message);
                    logger.error(e);
                }
            } else {
                logger.error(err);
                callback(err);
            }
        });
    },
    update: function (data, callback) {
        callback(null, 'ok'); // no need to persist data
    }
};

module.exports = imLinkConfigTask;
