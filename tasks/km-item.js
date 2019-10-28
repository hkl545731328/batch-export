'use strict';
var log4js = require('log4js');
var path = require('path');

var mongo = require(path.join(__dirname, '../mongo'));

var logger = log4js.getLogger();

// var config = require(path.join(__dirname, '../config.json'));
var findExp = { attachs: { $exists: true, $ne: {} } };

// km item  km item and km outer item attach exporter
var kmItemTask = {
    perpareCollection: function (callback) { // 获取待更新的collection
        callback(null, [{ dbName: 'cc', collectionName: 'app_km_outer_item' }, { dbName: 'cc', collectionName: 'app_km_item' }]);
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
                        var bucketName = 'm7-km';
                        var dataPaths = [];
                        try {
                            Object.keys(data.attachs).forEach(function (attach) {
                                if (attach && attach.search(/N.+?\/km\//) === -1) return; // 过滤不是bucket的数据
                                dataPaths.push(attach);
                            });
                            if (dataPaths.length > 0) res.push({ _id: data._id, dataPaths: dataPaths, rowData: data, bucketName: bucketName });
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

module.exports = kmItemTask;
