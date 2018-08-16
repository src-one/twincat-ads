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
const net = require('net');
const events = require('events');
const Buffer = require('safe-buffer').Buffer;

const helper = require('./helper');
const command = require('./command');
const resultParser = require('./resultParser');

const {
    ID,
    ADSIGRP,
} = require('./value');

Buffer.INSPECT_MAX_BYTES = 200;

exports.connect = function (options, callback) {
    const adsClient = getAdsObject(options);
    adsClient.connect(callback);

    return adsClient;
};

const getAdsObject = function (options) {
    var ads = {};
    ads.options = helper.parseOptions(options);
    ads.invokeId = 0;
    ads.pending = {};
    ads.symHandlesToRelease = [];
    ads.notificationsToRelease = [];
    ads.notifications = {};
    ads.dataStream = null;
    ads.tcpHeaderSize = 6;
    ads.amsHeaderSize = 32;

    var emitter = new events.EventEmitter();
    ads.adsClient = Object.create(emitter);

    ads.adsClient.connect = function (callback) {
        return connect.call(ads, callback);
    };

    ads.adsClient.end = function (callback) {
        return end.call(ads, callback);
    };

    ads.adsClient.readDeviceInfo = function (callback) {
        return readDeviceInfo.call(ads, callback);
    };

    ads.adsClient.read = function (handle, callback) {
        return read.call(ads, handle, callback);
    };

    ads.adsClient.write = function (handle, callback) {
        return write.call(ads, handle, callback);
    };

    ads.adsClient.readState = function (callback) {
        return readState.call(ads, callback);
    };

    ads.adsClient.notify = function (handle, callback) {
        return notify.call(ads, handle, callback);
    };

    ads.adsClient.writeRead = function (handle, callback) {
        return command.writeRead.call(ads, handle, callback);
    };

    ads.adsClient.getSymbols = function (callback) {
        return getSymbols.call(ads, callback);
    };

    ads.adsClient.multiRead = function (handles, callback) {
        return multiRead.call(ads, handles, callback);
    };

    ads.adsClient.multiWrite = function (handles, callback) {
        return multiWrite.call(ads, handles, callback)
    }

    ads.adsClient.getHandles = function (handles, callback) {
        return getHandles.call(ads, handles, callback);
    };

    Object.defineProperty(ads.adsClient, 'options', {
        get options() {
            return ads.options;
        },
        set options(value) {
            ads.options = value;
        }
    });

    return ads.adsClient;
};

const connect = function (callback) {
    const ads = this;

    ads.tcpClient = net.connect(
        ads.options.port,
        ads.options.host,
        function () {
            callback.apply(ads.adsClient)
        }
    );

    // ads.tcpClient.setKeepAlive(true);
    ads.tcpClient.setNoDelay(true);

    ads.tcpClient.on('data', function (data) {
        if (ads.dataStream === null) {
            ads.dataStream = data;
        } else {
            ads.dataStream = Buffer.concat([ads.dataStream, data]);
        }
        checkResponseStream.call(ads);
    });

    ads.tcpClient.on('timeout', function (data) {
        ads.adsClient.emit('timeout', data)
        ads.tcpClient.end()
    })

    ads.dataCallback = function (data) {
        ads.adsClient.emit('error', data);
        ads.tcpClient.end();
    };

    ads.tcpClient.on('error', ads.dataCallback);
};

const end = function (callback) {
    const ads = this;

    ads.tcpClient.removeListener('data', ads.dataCallback);

    releaseSymHandles.call(ads, function () {
        releaseNotificationHandles.call(ads, function () {
            if (ads.tcpClient) {
                // ads.tcpClient.end()
                ads.tcpClient.destroy();
            }

            if (callback !== undefined) {
                callback.call(ads);
            }
        });
    });
}

const processDataByte = function (inByte) {
    const ads = this;

    ads._buffer = ads._buffer || [];
    ads._buffer.push(inByte);

    var headerSize = ads.tcpHeaderSize + ads.amsHeaderSize;

    if (ads._buffer.length > headerSize) {
        var length = ads._buffer.readUInt32LE(26);

        if (ads._buffer.length >= headerSize + length) {
            ads.dataStream = Buffer.from(ads._buffer);

            debug('ads:', ads.dataStream);

            ads._buffer = [];
            analyseResponse.call(ads);
        }
    }
};

const checkResponseStream = function () {
    const ads = this;

    if (!ads.dataStream) {
        return;
    }

    var headerSize = ads.tcpHeaderSize + ads.amsHeaderSize;

    if (ads.dataStream.length > headerSize) {
        var length = ads.dataStream.readUInt32LE(26);

        if (ads.dataStream.length >= headerSize + length) {
            analyseResponse.call(ads);
        }
    }
};

const analyseResponse = function () {
    const ads = this;

    var commandId = ads.dataStream.readUInt16LE(22);
    var length = ads.dataStream.readUInt32LE(26);
    var errorId = ads.dataStream.readUInt32LE(30);
    var invokeId = ads.dataStream.readUInt32LE(34);

    helper.logPackage.call(ads, 'receiving', ads.dataStream, commandId, invokeId);

    helper.emitAdsError.call(ads, errorId);

    var totHeadSize = ads.tcpHeaderSize + ads.amsHeaderSize;
    var data = Buffer.alloc(length);

    ads.dataStream.copy(data, 0, totHeadSize, totHeadSize + length);

    if (ads.dataStream.length > totHeadSize + length) {
        var nextdata = Buffer.alloc(ads.dataStream.length - totHeadSize - length);

        ads.dataStream.copy(nextdata, 0, totHeadSize + length);
        ads.dataStream = nextdata;
    } else {
        ads.dataStream = null;
    }

    if (commandId === ID.NOTIFICATION) {
        // Special case: Notifications are initialised from the server socket
        resultParser.getNotificationResult.call(this, data);
    } else if (ads.pending[invokeId]) {
        var callback = ads.pending[invokeId].callback;

        clearTimeout(ads.pending[invokeId].timeout);
        delete ads.pending[invokeId];

        if (!callback) {
            debug(ads.dataStream, invokeId, commandId);
            throw new Error('Received a response, but the request can\'t be found');
        }

        switch (commandId) {
            case ID.READ_DEVICE_INFO:
                resultParser.getDeviceInfoResult.call(this, data, callback);
                break;
            case ID.READ:
                resultParser.getReadResult.call(this, data, callback);
                break;
            case ID.WRITE:
                resultParser.getWriteResult.call(this, data, callback);
                break;
            case ID.READ_STATE:
                resultParser.getReadStateResult.call(this, data, callback);
                break;
            case ID.WRITE_CONTROL:
                // writeControl.call(this, data, callback);
                break;
            case ID.ADD_NOTIFICATION:
                resultParser.getAddDeviceNotificationResult.call(this, data, callback);
                break;
            case ID.DEL_NOTIFICATION:
                resultParser.getDeleteDeviceNotificationResult.call(this, data, callback);
                break;
            case ID.READ_WRITE:
                resultParser.getWriteReadResult.call(this, data, callback);
                break;
            default:
                throw new Error('Unknown command');
        }
    }

    checkResponseStream.call(ads);
}

// ///////////////////// ADS FUNCTIONS ///////////////////////

const readDeviceInfo = function (callback) {
    var buf = Buffer.alloc(0);

    var options = {
        commandId: ID.READ_DEVICE_INFO,
        data: buf,
        callback: callback,
    };

    command.run.call(this, options);
};

const readState = function (callback) {
    var buf = Buffer.alloc(0);

    var options = {
        commandId: ID.READ_STATE,
        data: buf,
        callback: callback,
    };

    command.run.call(this, options);
};

const multiRead = function (handles, callback) {
    const ads = this;
    var readLength = 0;

    getHandles.call(ads, handles, function (error, handles) {
        if (!error) {
            var buf = Buffer.alloc(handles.length * 12);

            handles.forEach(function (handle, index) {
                buf.writeUInt32LE(handle.indexGroup || ADSIGRP.RW_SYMVAL_BYHANDLE, index * 12 + 0);
                buf.writeUInt32LE(handle.symHandle, index * 12 + 4);
                buf.writeUInt32LE(handle.totalByteLength, index * 12 + 8);

                readLength += handle.totalByteLength + 4;
            });
        }

        var request = {
            indexGroup: ADSIGRP.SUMUP_READ,
            indexOffset: handles.length,
            writeBuffer: buf,
            readLength: readLength,
            symName: 'multiRead',
        };

        command.writeRead.call(ads, request, function (error, result) {
            if (error) {
                return callback.call(ads, error);
            }

            if (result && result.length > 0) {
                var resultpos = 0;
                var handlespos = handles.length * 4;

                handles.forEach(function (handle) {
                    if (!handle.error) {
                        var adsError = result.readUInt32LE(resultpos);
                        resultpos += 4;

                        if (adsError != 0) {
                            handle.error = adsError;
                        }

                        if (handle.totalByteLength > 0) {
                            var integrate = Buffer.alloc(handle.totalByteLength);

                            result.copy(integrate, 0, handlespos, handlespos + handle.totalByteLength);
                            helper.integrateResultInHandle(handle, integrate);
                        }

                        handlespos += handle.totalByteLength;
                    }
                });
            }

            callback.call(ads.adsClient, error, handles);
        });
    });
};

const multiWrite = function (handles, callback) {
    const ads = this;

    getHandles.call(ads, handles, function (error, handles) {
        if (error) {
            return callback.call(ads.adsClient, error);
        }

        var writelen = 0;

        handles.forEach(function (handle) {
            if (!handle.error) {
                writelen += 12 + handle.totalByteLength;
            }
        });

        if (handles.length === 0) {
            return callback.call(ads.adsClient, null, handles);
        }

        var buf = Buffer.alloc(writelen);
        var position = 12 * handles.length;

        handles.forEach(function (handle, index) {
            if (!handle.error) {
                buf.writeUInt32LE(handle.indexGroup || ADSIGRP.RW_SYMVAL_BYHANDLE, index * 12 + 0);
                buf.writeUInt32LE(handle.symHandle, index * 12 + 4);
                buf.writeUInt32LE(handle.totalByteLength, index * 12 + 8);

                helper.getBytesFromHandle(handle);

                handle.bytes.copy(buf, position, 0, handle.bytes.length);

                position += handle.totalByteLength;
            }
        });

        var request = {
            indexGroup: ADSIGRP.SUMUP_WRITE,
            indexOffset: handles.length,
            writeBuffer: buf,
            readLength: handles.length * 4,
            symName: 'multiWrite',
        };

        command.writeRead.call(ads, request, function (error, result) {
            if (error) {
                return callback.call(ads.adsClient, error);
            }

            if (result && result.length > 0) {
                var resultpos = 0;

                handles.forEach(function (handle) {
                    if (!handle.error) {
                        var adsError = result.readUInt32LE(resultpos);
                        resultpos += 4;

                        if (adsError != 0) {
                            handle.error = adsError;
                        }
                    }
                });
            }

            callback.call(ads.adsClient, null, handles);
        });
    });
};

const read = function (handle, callback) {
    const ads = this;

    getHandle.call(ads, handle, function (error, handle) {
        if (error) {
            return callback.call(ads.adsClient, error);
        }

        var commandOptions = {
            indexGroup: handle.indexGroup || ADSIGRP.RW_SYMVAL_BYHANDLE,
            indexOffset: handle.symHandle,
            byteLength: handle.totalByteLength,
            symName: handle.symName,
        };

        if (typeof handle.arrayid !== 'undefined') {
            commandOptions += handle.totalByteLength * handle.arrayid;
        }

        command.read.call(ads, commandOptions, function (error, result) {
            if (result) {
                helper.integrateResultInHandle(handle, result);
            }

            callback.call(ads.adsClient, error, handle);
        })
    });
};

const write = function (handle, callback) {
    const ads = this;

    getHandle.call(ads, handle, function (error, handle) {
        if (error) {
            return callback.call(ads.adsClient, error);
        }

        helper.getBytesFromHandle(handle);

        var commandOptions = {
            indexGroup: handle.indexGroup || ADSIGRP.RW_SYMVAL_BYHANDLE,
            indexOffset: handle.symHandle,
            byteLength: handle.totalByteLength,
            bytes: handle.bytes,
            symName: handle.symName,
        };

        if (typeof handle.arrayid !== 'undefined') {
            commandOptions += handle.totalByteLength * handle.arrayid;
        }

        command.write.call(ads, commandOptions, function (error, result) {
            callback.call(ads.adsClient, error, result);
        });
    });
};

const notify = function (handle, callback) {
    const ads = this;

    getHandle.call(ads, handle, function (error, handle) {
        if (error) {
            if (callback) {
                callback.call(ads.adsClient, error);
            }
            return;
        }

        var commandOptions = {
            indexGroup: handle.indexGroup || ADSIGRP.RW_SYMVAL_BYHANDLE,
            indexOffset: handle.symHandle,
            byteLength: handle.totalByteLength,
            transmissionMode: handle.transmissionMode,
            maxDelay: handle.maxDelay,
            cycleTime: handle.cycleTime,
            symName: handle.symName,
        };

        command.addNotification.call(ads, commandOptions, function (error, notiHandle) {
            if (ads.options.verbose > 0) {
                debug('Add notiHandle ' + notiHandle);
            }

            this.notifications[notiHandle] = handle;

            if (typeof callback !== 'undefined') {
                callback.call(ads.adsClient, error);
            }
        });
    });
};

const getSymbols = function (callback) {
    const ads = this;

    var cmdLength = {
        indexGroup: ADSIGRP.SYM_UPLOADINFO2,
        indexOffset: 0x00000000,
        byteLength: 0x30,
    };

    var cmdSymbols = {
        indexGroup: ADSIGRP.SYM_UPLOAD,
        indexOffset: 0x00000000,
    };

    command.read.call(ads, cmdLength, function (error, result) {
        if (error) {
            return callback.call(ads.adsClient, error);
        }

        var data = result.readInt32LE(4);
        cmdSymbols.byteLength = data;

        command.read.call(ads, cmdSymbols, function (error, result) {
            var symbols = [];
            var pos = 0;

            if (!error) {
                while (pos < result.length) {
                    var symbol = {};
                    var readLength = result.readUInt32LE(pos);

                    symbol.indexGroup = result.readUInt32LE(pos + 4);
                    symbol.indexOffset = result.readUInt32LE(pos + 8);
                    // symbol.size = result.readUInt32LE(pos + 12);
                    // symbol.type = result.readUInt32LE(pos + 16); //ADST_ ...
                    // symbol.something = result.readUInt32LE(pos + 20);
                    var nameLength = result.readUInt16LE(pos + 24) + 1;
                    var typeLength = result.readUInt16LE(pos + 26) + 1;
                    var commentLength = result.readUInt16LE(pos + 28) + 1;

                    pos = pos + 30;

                    var nameBuf = Buffer.alloc(nameLength);
                    result.copy(nameBuf, 0, pos, pos + nameLength);
                    symbol.name = nameBuf.toString('utf8', 0, helper.findStringEnd(nameBuf, 0));
                    pos = pos + nameLength;

                    var typeBuf = Buffer.alloc(typeLength);
                    result.copy(typeBuf, 0, pos, pos + typeLength);
                    symbol.type = typeBuf.toString('utf8', 0, helper.findStringEnd(typeBuf, 0));
                    pos = pos + typeLength;

                    var commentBuf = Buffer.alloc(commentLength);
                    result.copy(commentBuf, 0, pos, pos + commentLength);
                    symbol.comment = commentBuf.toString('utf8', 0, helper.findStringEnd(commentBuf, 0));
                    pos = pos + commentLength;

                    if (symbol.type.indexOf('ARRAY') > -1) {
                        var re = /ARRAY[\s]+\[([\-\d]+)\.\.([\-\d]+)\][\s]+of[\s]+(.*)/i;
                        var m;

                        if ((m = re.exec(symbol.type)) !== null) {
                            if (m.index === re.lastIndex) {
                                re.lastIndex++;
                            }

                            m[1] = parseInt(m[1]);
                            m[2] = parseInt(m[2]);

                            for (var i = m[1]; i <= m[2]; i++) {
                                var newSymbol = JSON.parse(JSON.stringify(symbol));
                                newSymbol.arrayid = i + 0;
                                newSymbol.type = m[3] + '';
                                newSymbol.name += '[' + i + ']';
                                symbols.push(newSymbol);
                            }
                        }
                    } else {
                        symbols.push(symbol);
                    }
                }
            }

            callback.call(ads.adsClient, error, symbols);
        });
    });
};

const getHandles = function (handles, callback) {
    const ads = this;

    var data = handles.reduce(function (result, handle) {
        return result + handle.symName;
    }, '');

    var buf = Buffer.alloc(handles.length * 16 + data.length);

    handles.forEach(function (handle, index) {
        handle = helper.parseHandle(handle);

        buf.writeUInt32LE(ADSIGRP.GET_SYMHANDLE_BYNAME, index * 16 + 0);
        buf.writeUInt32LE(0x00000000, index * 16 + 4);
        buf.writeUInt32LE(4, index * 16 + 8);
        buf.writeUInt32LE(handle.symName.length, index * 16 + 12);
    });

    buf.write(data, (handles.length) * 16 + 0);

    var request = {
        indexGroup: ADSIGRP.SUMUP_READWRITE,
        indexOffset: handles.length,
        writeBuffer: buf,
        readLength: handles.length * 12,
        symName: 'getHandles'
    };

    command.writeRead.call(ads, request, function (error, result) {
        if (error) {
            return callback.call(ads, error);
        }

        if (result.length > 0) {
            var resultpos = 0;
            var handlespos = handles.length * 8;

            handles.forEach(function (handle) {
                if (handle.symName !== undefined) {
                    var adsError = result.readUInt32LE(resultpos);
                    resultpos += 4;

                    handle.error = helper.getError(adsError);

                    var symhandlebyte = result.readUInt32LE(resultpos);
                    resultpos += 4;

                    if (symhandlebyte == 4) {
                        handle.symHandle = result.readUInt32LE(handlespos);
                    }

                    handlespos += symhandlebyte;

                    var symHandleToRelease = Buffer.alloc(4);

                    symHandleToRelease.writeUInt32LE(handle.symHandle, 0);
                    ads.symHandlesToRelease.push(symHandleToRelease);
                }
            });
        }

        callback.call(ads, null, handles);
    });
};

const getHandle = function (handle, callback) {
    const ads = this;

    handle = helper.parseHandle(handle);

    if (typeof handle.symName === 'undefined') {
        handle.symName = handle.indexOffset;

        return callback.call(ads, null, handle);
    }

    var buf = helper.stringToBuffer(handle.symName);

    if (typeof handle.symHandle !== 'undefined') {
        return callback.call(ads, null, handle);
    }

    var commandOptions = {
        indexGroup: ADSIGRP.GET_SYMHANDLE_BYNAME,
        indexOffset: 0x00000000,
        writeBuffer: buf,
        readLength: 4,
        symName: handle.symName,
    };

    command.writeRead.call(ads, commandOptions, function (error, result) {
        if (error) {
            return callback.call(ads, error);
        }

        if (result.length > 0) {
            ads.symHandlesToRelease.push(result);
            handle.symHandle = result.readUInt32LE(0);

            callback.call(ads, null, handle);
        }
    });
};

const releaseSymHandles = function (callback) {
    const ads = this;

    if (this.symHandlesToRelease.length > 0) {
        var symHandle = this.symHandlesToRelease.shift();

        releaseSymHandle.call(this, symHandle, function () {
            releaseSymHandles.call(ads, callback);
        });
    } else {
        callback.call(this);
    }
};

const releaseSymHandle = function (symHandle, callback) {
    const ads = this;

    var commandOptions = {
        indexGroup: ADSIGRP.RELEASE_SYMHANDLE,
        indexOffset: 0x00000000,
        byteLength: symHandle.length,
        bytes: symHandle
    };

    command.write.call(this, commandOptions, function (err) {
        callback.call(ads, err);
    });
};

const releaseNotificationHandles = function (callback) {
    const ads = this;

    if (this.notificationsToRelease.length > 0) {
        var notificationHandle = this.notificationsToRelease.shift();

        command.deleteDeviceNotification.call(this, notificationHandle, function () {
            releaseNotificationHandles.call(ads, callback);
        })
    } else {
        callback.call(this);
    }
};

// /////////////////// COMMAND RESULT PARSING ////////////////////////////


// //////////////////////////// ADS TYPES /////////////////////////////////

var adsType = {
    length: 1,
    name: '',
};

exports.makeType = function (name) {
    var type = Object.create(adsType);

    type.length = typeLength[name];
    type.name = name;

    return type;
};

function exportType(name) {
    var type = exports.makeType(name);

    Object.defineProperty(exports, name, {
        value: type,
        writable: false,
    });
}

var typeLength = {
    'BOOL': 1,
    'BYTE': 1,
    'WORD': 2,
    'DWORD': 4,
    'SINT': 1,
    'USINT': 1,
    'INT': 2,
    'UINT': 2,
    'DINT': 4,
    'UDINT': 4,
    'LINT': 8,
    'ULINT': 8,
    'REAL': 4,
    'LREAL': 8,
    'TIME': 4,
    'TIME_OF_DAY': 4,
    'TOD': 4, // TIME_OF_DAY alias
    'DATE': 4,
    'DATE_AND_TIME': 4,
    'DT': 4, // DATE_AND_TIME alias
    'STRING': 81,
};

exportType('BOOL');
exportType('BYTE');
exportType('WORD');
exportType('DWORD');
exportType('SINT');
exportType('USINT');
exportType('INT');
exportType('UINT');
exportType('DINT');
exportType('UDINT');
exportType('LINT');
exportType('ULINT');
exportType('REAL');
exportType('LREAL');
// TIME,TIME_OF_DAY,TOD,DATE,DATE_AND_TIME,DT:
// Use handle.useLocalTimezone=false or true to switch it off or on
// default value if useLocalTimezone is not given is on
exportType('TIME');
exportType('TIME_OF_DAY');
exportType('TOD'); // TIME_OF_DAY alias
exportType('DATE');
exportType('DATE_AND_TIME');
exportType('DT'); // DATE_AND_TIME alias
exportType('STRING');

exports.string = function (length) {
    var type = {
        length: 81,
    };

    if (typeof length !== 'undefined') {
        type.length = arguments[0];
    }

    return type;
};