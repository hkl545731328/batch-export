'use strict';
var log4js = require('log4js');
var path = require('path');

var mongo = require(path.join(__dirname, '../mongo'));
var helper = require(path.join(__dirname, '../libs/helper'));

var logger = log4js.getLogger();

var config = require(path.join(__dirname, '../config.json'));
var findExp = { 'lastMessage.contentType': { $exists: true, $ne: 'text|iframe|screenShare|cardInfo' } };

var chatSessionTask = {
    perpareCollection: function (callback) { // 获取待更新的collection
        callback(null, [{ dbName: 'cc', collectionName: 'app_multi_channel_chat_session' }]);
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
                        var bucketName = '';
                        var url = '';
                        var addresses = '';
                        var dataPath = '';
                        try {
                            bucketName = helper.getQiniuBucketName(data.lastMessage.content); // 过滤不是bucket的数据
                            if (!bucketName) return;
                            url = /http(|s):\/\/(.+)/.exec(data.lastMessage.content.split('?')[0]);
                            if (url && url[2]) {
                                addresses = url[2].match(/(.+?)\/(.+)/); // 取出文件真实路径
                                // var host = addresses[1];
                                dataPath = addresses[2];
                                data.lastMessage.content = config.newHost + dataPath;
                                res.push({ _id: data._id, dataPath: dataPath, rowData: data, bucketName: bucketName });
                            }
                        } catch (e) {
                            logger.error(data.lastMessage.content);
                            logger.error(e);
                        }
                    });
                    callback(null, res);
                } catch (e) {
                    logger.error(data.lastMessage.content);
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

module.exports = chatSessionTask;
