'use strict';

var log4js = require('log4js');
var Thenjs = require('thenjs');
var fs = require('fs');

var mongo = require('./mongo');
var im = require('./tasks/im');
var config = require('./config.json');

var logger = log4js.getLogger();
log4js.configure('./log4js.json');

// var taskLimit = 15;
var dataList = [];
var imPersist = fs.readFileSync('output/imPersist.txt', 'utf8'); // 本地数据
var delimiter = config.delimiter; // 分割符
var newHost = config.newHost; // 新地址

Thenjs()
    .parallel([
        function (cont) {
            mongo.connectDb(cont);
        }
    ])
    .then(function (cont) {
        imPersist.split('\n').forEach(function (data) { dataList.push(data); });
        cont(null);
    })
    .eachSeries(dataList, function (cont, value) {
        console.log(value);
        var _id = value.split(delimiter)[0];
        var dataPath = value.split(delimiter)[1];
        im.update({
            newHost: newHost,
            _id: _id,
            dataPath: dataPath
        }, function (err, res) {
            logger.info('processed: ', _id);
            if (err) cont(err);
            cont();
        });
    })
    .fin(function (cont, error, result) {
        mongo.disconnectDb();
    })
    .fail(function (cont, error) {
        logger.info(error);
        logger.info('DEMO END!');
    });
