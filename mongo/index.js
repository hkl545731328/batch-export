var log4js = require('log4js');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var path = require('path');

var config = require(path.join(__dirname, '../config.json'));
var logger = log4js.getLogger();

var host = config.dbIp;
var port = config.dbPort;
var dbName = config.dbName;
var dbUsername = config.dbUserName;
var dbPassword = config.dbPassword;
var dbPoolSize = config.dbPoolSize;
var dbHaInterval = config.dbHaInterval;

var reportHost = config.reportDbIp;
var reportPort = config.reportDbPort;
var reportDbName = config.reportDbName;
var reportDbUsername = config.reportDbUserName;
var reportDbPassword = config.reportDbPassword;
var reportDbPoolSize = config.reportDbPoolSize;
var reportDbHaInterval = config.reportDbHaInterval;

var DBMaster = 'db_master';
var dbClient = '';
var reportDbClient = '';
var db = '';
var reportDb = '';
var connectedDb = {};
function DB (callback) {
    if (db) {
        return;
    }
    var url = 'mongodb://' + dbUsername + ':' + dbPassword + '@' + host + ':' + port + '/' + dbName + '?authSource=admin&maxPoolSize=' + dbPoolSize;
    MongoClient.connect(url, {
        haInterval: parseInt(dbHaInterval),
        useUnifiedTopology: true
    }, function (err, client) {
        if (err) {
            logger.info('connect db failed!' + err);
            callback(err);
        } else {
            logger.info('Connected correctly to server');
            dbClient = client;
            db = client.db(dbName);
            // initDbConnects();
            db.on('error', function () {
                logger.info('数据库连接出现异常');
            });
            db.on('ha', function () {
                logger.info('数据库连接可用性检查');
            });
            db.on('reconnect', function () {
                logger.info('数据库重连完成');
            });
            callback(null, 'ok');
        }
    });
}

function reportDB () {
    if (reportDb) {
        return;
    }
    var reportUrl = 'mongodb://' + reportDbUsername + ':' + reportDbPassword + '@' + reportHost + ':' + reportPort + '/' + reportDbName + '?authSource=admin&maxPoolSize=' + reportDbPoolSize;

    MongoClient.connect(reportUrl, {
        mongos: {
            haInterval: parseInt(reportDbHaInterval)
        }
    }, function (err, reportClient) {
        if (err) {
            logger.info('connect reportdb failed!' + err);
        } else {
            logger.info('Connected reportDb correctly to server');
            reportDbClient = reportClient;
            reportDb = reportClient.db(dbName);

            reportDb.on('error', function () {
                logger.info('数据库连接出现异常');
            });
            reportDb.on('ha', function () {
                logger.info('数据库连接可用性检查');
            });
            reportDb.on('reconnect', function () {
                logger.info('数据库重连完成');
            });
        }
    });
}
// eslint-disable-next-line no-unused-vars
function initDbConnects () {
    if (!db) {
        logger.info('db is null! can not init dbConnects!!!!!');
    } else {
        db.collection(DBMaster).findOne({ master_key: 'db_status' }, function (err, doc) {
            if (!err) {
                var dbs = doc.db_names;
                for (var i = 0; i < dbs.length; i++) {
                    initDB(dbs[i]);
                }
            } else {
                logger.info('get db master conf error!');
                logger.info(err.stack);
            }
        });
    }
}

function initDB (dbName) {
    if (connectedDb[dbName]) {
        return;
    }
    var opendb = db.db(dbName);
    connectedDb[dbName] = opendb;
    logger.info('connected to db[' + dbName + '] success!');
}

exports.connectDb = function (callback) {
    if (!db) {
        DB(callback);
        logger.info('connecting to db ....');
    }
};

exports.connectReportDb = function (callback) {
    if (!reportDb) {
        reportDB(callback);
        logger.info('connecting to reportDb ....');
        // platformDB();
        // logger.info("connecting to platform db ....");
    }
};

exports.disconnectDb = function () {
    if (dbClient) {
        dbClient.close();
        logger.info('disconnecting to db ....');
    }
};

exports.disconnectReportDb = function () {
    if (reportDbClient) {
        reportDbClient.close();
        logger.info('disconnecting to reportDb ....');
    }
};

// exports.db = function(dbName){
//    if(dbName){
//        if(typeof dbName == 'string'){
//            return db.db(dbName);
//        }
//    }else{
//        return db;
//    }
// }

exports.reportDb = function (dbName) {
    if (dbName) {
        return reportDb.db(dbName);
    } else {
        return reportDb;
    }
};

exports.db = function (session) {
    if (session) {
        if (typeof session === 'object') {
            if (!connectedDb[session.account.dataDB]) {
                logger.info('dbAnalysisStart:' + JSON.stringify({ aid: session._aid }));
                connectedDb[session.account.dataDB] = dbClient.db(session.account.dataDB);
            }
            logger.info('dbAnalysisEnd:' + JSON.stringify({ aid: session._aid }));
            return connectedDb[session.account.dataDB];
        } else if (typeof session === 'string') {
            if (!connectedDb[session]) {
                connectedDb[session] = dbClient.db(session);
            }
            return connectedDb[session];
        } else {
            return db;
        }
    } else {
        return db;
    }
};

exports.writeFileToDb = function (filePath, fileId, fileName, type, callback) {
    var db = module.exports.db('cc_file');
    var gridStore = new mongodb.GridStore(db, fileId, fileName, 'w', { metadata: { type: type, date: new Date().getTime() }, w: 1, fsync: true });
    gridStore.open(function (err, gridStore) {
        if (!err) {
            gridStore.writeFile(filePath, function (err, doc) {
                if (!err) {
                    gridStore.close(function (err, data) {
                        if (err) callback(err);
                        callback(null, data);
                    });
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }
    });
};

exports.readFileFromDb = function (fileId, callback) {
    var db = module.exports.db('cc_file');
    var gridStore = new mongodb.GridStore(db, fileId, '', 'r');
    gridStore.open(function (err, gridStore) {
        if (!err) {
            gridStore.read(function (err, data) {
                if (!err) {
                    var info = {
                        _id: gridStore.fileId,
                        name: gridStore.filename
                    };
                    callback(err, data, info);
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }
    });
};

exports.removeFileFromDb = function (fileId, callback) {
    var db = module.exports.db('cc_file');
    var gridStore = new mongodb.GridStore(db, fileId, '', 'r');
    gridStore.open(function (err, gridStore) {
        if (!err) {
            gridStore.unlink(function (err, result) {
                if (!err) {
                    callback(null);
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }
    });
};

exports.listDB = function (callback) {
    db.admin().listDatabases({ nameOnly: true }, callback);
};
