'use strict';
var log4js = require('log4js');
var path = require('path');

var mongo = require(path.join(__dirname, '../mongo'));
var helper = require(path.join(__dirname, '../libs/helper'));

var logger = log4js.getLogger();

var config = require(path.join(__dirname, '../config.json'));
var findExp = { attachment: { $exists: true, $ne: [] } };

var imTask = {
    perpareCollection: function (callback) { // 获取待更新的collection
        callback(null, [{ dbName: 'cc', collectionName: 'app_email_mails' }]);
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
                        var bucketName = 'm7-mail-resource';
                        var url = [];
                        var addresses = '';
                        var dataPath = '';
                        var dataPaths = [];
                        try {
                            if (data.attachment instanceof Array) {
                                data.attachment.forEach(function (attach) {
                                    if (!attach.url) return;
                                    bucketName = helper.getQiniuBucketName(attach.url); // 过滤不是bucket的数据
                                    if (!bucketName) return;
                                    url = /http(|s):\/\/(.+)/.exec(attach.url.split('?')[0]);
                                    if (url && url[2]) {
                                        addresses = url[2].match(/(.+?)\/(.+)/); // 取出文件真实路径
                                        // var host = addresses[1];
                                        dataPath = addresses[2];
                                        attach.url = config.newHost + dataPath;
                                        dataPaths.push(dataPath);
                                    }
                                });
                                if (dataPaths.length > 0) res.push({ _id: data._id, dataPaths: dataPaths, rowData: data, bucketName: bucketName });
                            }
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
        var dbName = config.backUpDbName;
        var collectionName = data.dbName + config.delimiter + data.collectionName;
        mongo.db(dbName).collection(collectionName).updateOne({ _id: data._id }
            , { $set: data.rowData }, { upsert: true }, function (err) {
                if (!err) {
                    callback(null, 'ok');
                } else {
                    logger.error(err);
                    callback(err);
                }
            });
    }
};

module.exports = imTask;
