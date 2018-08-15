// Copyright (c) 2018 src-one

// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

'use strict';

const debug = require('debug')('node-ads');
const helper = require('./helper');

const resultParser = {
    getDeviceInfoResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        // emitAdsError.call(this, adsError);
        var error = helper.getError(adsError);
        var result;

        if (!error) {
            result = {
                majorVersion: data.readUInt8(4),
                minorVersion: data.readUInt8(5),
                versionBuild: data.readUInt16LE(6),
                deviceName: data.toString('utf8', 8, helper.findStringEnd(data, 8)),
            };
        }

        callback.call(this.adsClient, error, result);
    },

    getReadResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        var result;
        // emitAdsError.call(this, adsError);
        var error = helper.getError(adsError);

        if (!error) {
            var byteLength = data.readUInt32LE(4);

            result = Buffer.alloc(byteLength);
            data.copy(result, 0, 8, 8 + byteLength);
        }

        callback.call(this, error, result);
    },

    getWriteReadResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        var result;
        // emitAdsError.call(this, adsError);
        var error = helper.getError(adsError);

        if (!error) {
            var byteLength = data.readUInt32LE(4);
            result = Buffer.alloc(byteLength);
            data.copy(result, 0, 8, 8 + byteLength);
        }

        callback.call(this, error, result);
    },

    getWriteResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        var error = helper.getError(adsError);
        // emitAdsError.call(this, adsError)

        callback.call(this, error);
    },

    getReadStateResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        // emitAdsError.call(this, adsError);
        var error = helper.getError(adsError);
        var result;

        if (!error) {
            result = {
                adsState: data.readUInt16LE(4),
                deviceState: data.readUInt16LE(6),
            };
        }

        callback.call(this.adsClient, error, result);
    },

    getAddDeviceNotificationResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        var notificationHandle;
        // emitAdsError.call(this, adsError);
        var error = helper.getError(adsError);

        if (!error) {
            notificationHandle = data.readUInt32LE(4);
            this.notificationsToRelease.push(notificationHandle);
        }

        callback.call(this, error, notificationHandle);
    },

    getDeleteDeviceNotificationResult: function (data, callback) {
        var adsError = data.readUInt32LE(0);
        // emitAdsError.call(this, adsError);
        var error = helper.getError(adsError);

        callback.call(this, error);
    },

    getNotificationResult: function (data) {
        var length = data.readUInt32LE(0);
        var stamps = data.readUInt32LE(4);
        var offset = 8;
        var timestamp = 0;
        var samples = 0;
        var notiHandle = 0;
        var size = 0;

        for (var i = 0; i < stamps; i++) {
            timestamp = data.readUInt32LE(offset); // TODO 8 bytes and convert
            offset += 8;
            samples = data.readUInt32LE(offset);
            offset += 4;
            for (var j = 0; j < samples; j++) {
                notiHandle = data.readUInt32LE(offset);
                offset += 4;
                size = data.readUInt32LE(offset);
                offset += 4;

                var buf = Buffer.alloc(size);
                data.copy(buf, 0, offset);
                offset += size;

                if (this.options.verbose > 0) {
                    debug('Get notiHandle ' + notiHandle);
                }

                var handle = this.notifications[notiHandle];

                // It can happen that there is a notification before I
                // even have the notification handle.
                // In that case I just skip this notification.
                if (handle !== undefined) {
                    helper.integrateResultInHandle(handle, buf);
                    this.adsClient.emit('notification', handle);
                } else {
                    if (this.options.verbose > 0) {
                        debug('skipping notification ' + notiHandle);
                    }
                }
            }
        }
    }
};
module.exports = resultParser;