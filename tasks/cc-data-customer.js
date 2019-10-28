'use strict';
var log4js = require('log4js');
var path = require('path');
var Thenjs = require('thenjs');

var mongo = require(path.join(__dirname, '../mongo'));

var logger = log4js.getLogger();

// var config = require(path.join(__dirname, '../config.json'));
var findExp = { attachs: { $exists: true, $ne: [] } };

// cc_data  account customer attach exporter
var customerTask = {
    perpareCollection: function (callback) { // 获取待更新的collection
        mongo.db('bill').collection('platform_account_product').find({ _id: { $regex: /.+_cc/ } }).toArray(function (err, docs) { // 查找有cc product
            if (err) callback(err);
            Thenjs()
                .eachSeries(docs, function (cont, data) {
                    if (!data.dataDB) return cont();
                    var info = /(.+)_cc/.exec(data._id);
                    if (!info[1]) return cont();
                    cont(null, { dbName: data.dataDB, collectionName: info[1] + '_customer' });
                })
                .then(function (cont, res) {
                    callback(null, res.filter(function (d) { return !!d; }));
                }).fail(function (cont, error) {
                    logger.error(error);
                    callback(error);
                });
        });
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
                    var account = /(.+)_customer/.exec(collectionName)[1];
                    docs.forEach(function (data) {
                        var bucketName = 'm7-test';
                        var dataPaths = [];
                        try {
                            if (data.attachs instanceof Array) {
                                data.attachs.forEach(function (attach) {
                                    if (attach.id && attach.id.indexOf(account + '/customer') === -1) return; // 过滤不是bucket的数据
                                    dataPaths.push(attach.id);
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
        callback(null, 'ok'); // no need to persist data
    }
};

module.exports = customerTask;
