var path = require('path');
var config = require(path.join(__dirname, '../config.json'));

var helper = {
    getQiniuBucketName: function (str) {
        if (!str) return '';
        if (str.indexOf('7moor.com') < -1) return '';
        const buckets = Object.keys(config.bucketMap).filter(function (bucketKey) {
            return str.indexOf(config.bucketMap[bucketKey]) > -1;
        });
        return buckets[0];
    }
};

module.exports = helper;
