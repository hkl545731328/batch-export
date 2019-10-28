'use strict';

var log4js = require('log4js');
var Thenjs = require('thenjs');

var mongo = require('./mongo');
var fs = require('fs');
var path = require('path');

var config = require('./config.json');
var qiniu = require('./libs/qiniu');

log4js.configure('./log4js.json');
var logger = log4js.getLogger();

var taskLimit = 15;

Thenjs()
    .parallel([
        function (cont) {
            mongo.connectDb(cont);
        }
    ])
    .then(function (cont) {
        Thenjs().eachSeries(fs.readdirSync('./tasks'), function (cont2, taskName) {
        // Thenjs().eachSeries(['kefu-im-link-config'], function (cont2, taskName) { // FIXME: for test
            var task = require(path.join(__dirname, './tasks', taskName));
            logger.info('processing task: ', taskName);
            Thenjs()
                .then(function (cont) {
                    task.perpareCollection(cont);
                })
                .eachSeries(null, function (cont3, collectionInfo) {
                    logger.info('processing collection: ', collectionInfo.dbName + ' -- ' + collectionInfo.collectionName);
                    Thenjs()
                        .then(function (cont) { // 计算总数， 按taskLimit为一组进行处理
                            var pageList = [];
                            task.count(collectionInfo, function (err, count) {
                                for (var i = 0; i * taskLimit < count; i++) pageList.push(i + 1);
                                logger.info('im data count: ', count);
                                cont(err, pageList);
                            });
                        })
                        .eachSeries(null, function (cont, value) { // download
                            task.query({
                                page: value,
                                limit: taskLimit,
                                dbName: collectionInfo.dbName,
                                collectionName: collectionInfo.collectionName
                            }, function (err, dataArray) {
                                if (err) cont(err);
                                Thenjs()
                                    .each(dataArray, function (cont2, data) {
                                        Thenjs()
                                            .then(function (cont3) {
                                                logger.info('downloading: ', data._id);
                                                qiniu.downloadFile({ _id: data._id, dataPath: data.dataPath, dataPaths: data.dataPaths, bucket: data.bucketName, rowData: data.rowData }, cont3);
                                            })
                                            .then(function (cont3, data) { cont2(null, data); })
                                            .fail(function () { cont2(); });
                                    })
                                    .then(function (cont2, dataArray) { // persist to db
                                        dataArray = dataArray.filter(function (d) { return !!d; });
                                        Thenjs()
                                            .each(dataArray, function (cont3, data) {
                                                logger.info('persisting: ', data._id);
                                                task.update({
                                                    newHost: config.newHost,
                                                    _id: data._id,
                                                    rowData: data.rowData,
                                                    dataPath: data.dataPath,
                                                    dataPaths: data.dataPaths,
                                                    dbName: collectionInfo.dbName,
                                                    collectionName: collectionInfo.collectionName
                                                }, function (err, res) {
                                                    if (err) {
                                                        logger.error('persist fail: ', data._id);
                                                        cont3(err);
                                                    }
                                                    logger.info('persisted: ', data._id);
                                                    cont3();
                                                });
                                            }).fin(cont2);
                                    })
                                    .fin(cont);
                            });
                        }).fin(cont3);
                })
                .fin(cont2);
        }).fin(cont);
    })
    .fin(function (cont, error) {
        if (error) logger.error(error);
        mongo.disconnectDb();
        cont();
    })
    .fail(function (cont, error) {
        logger.error(error);
    });
