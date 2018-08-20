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

var debug = require('debug')('twincat-ads:helper');

const {
    ID,
    ERRORS,
    NOTIFY,
} = require('./value');

const helper = {
    stringToBuffer: function (someString) {
        var buffer = Buffer.alloc(someString.length + 1);

        buffer.write(someString);
        buffer[someString.length] = 0;

        return buffer;
    },

    parseOptions: function (options) {
        // Defaults
        if (typeof options.port === 'undefined') {
            options.port = 48898;
        }

        if (typeof options.amsPortSource === 'undefined') {
            options.amsPortSource = 32905;
        }

        if (typeof options.amsPortTarget === 'undefined') {
            options.amsPortTarget = 801;
        }

        if (typeof options.host === 'undefined') {
            throw new Error('host not defined!');
        }

        if (typeof options.amsNetIdTarget === 'undefined') {
            throw new Error('amsNetIdTarget not defined!');
        }

        if (typeof options.amsNetIdSource === 'undefined') {
            throw new Error('amsNetIdTarget not defined!');
        }

        if (options.verbose === undefined) {
            options.verbose = 0;
        }

        return options;
    },

    getCommandDescription: function (commandId) {
        var desc = 'Unknown command';

        switch (commandId) {
            case ID.READ_DEVICE_INFO:
                desc = 'Read device info';
                break;
            case ID.READ:
                desc = 'Read';
                break;
            case ID.WRITE:
                desc = 'Write';
                break;
            case ID.READ_STATE:
                desc = 'Read state';
                break;
            case ID.WRITE_CONTROL:
                desc = 'Write control';
                break;
            case ID.ADD_NOTIFICATION:
                desc = 'Add notification';
                break;
            case ID.DEL_NOTIFICATION:
                desc = 'Delete notification';
                break;
            case ID.NOTIFICATION:
                desc = 'Notification';
                break;
            case ID.READ_WRITE:
                desc = 'ReadWrite';
                break;
        }

        return desc;
    },

    getValue: function (dataName, result, offset, useLocalTimezone) {
        var value;
        var timeoffset;

        switch (dataName) {
            case 'BOOL':
                value = Boolean(result.readUInt8(offset))
                break
            case 'BYTE':
            case 'USINT':
            case 'UINT8':
                value = result.readUInt8(offset);
                break;
            case 'SINT':
            case 'INT8':
                value = result.readInt8(offset);
                break;
            case 'UINT':
            case 'WORD':
            case 'UINT16':
                value = result.readUInt16LE(offset);
                break;
            case 'INT':
            case 'INT16':
                value = result.readInt16LE(offset);
                break;
            case 'DWORD':
            case 'UDINT':
            case 'UINT32':
                value = result.readUInt32LE(offset);
                break;
            case 'DINT':
            case 'INT32':
                value = result.readInt32LE(offset);
                break;
            case 'REAL':
                value = result.readFloatLE(offset);
                break;
            case 'LREAL':
                value = result.readDoubleLE(offset);
                break;
            case 'STRING':
                value = result.toString('utf8', offset, helper.findStringEnd(result, offset));
                break;
            case 'TIME':
            case 'TIME_OF_DAY':
            case 'TOD':
                var milliseconds = result.readUInt32LE(offset);
                value = new Date(milliseconds);

                if (useLocalTimezone) {
                    timeoffset = value.getTimezoneOffset();
                    value = new Date(value.setMinutes(value.getMinutes() + timeoffset));
                }
                break;
            case 'DATE':
            case 'DATE_AND_TIME':
            case 'DT':
                var seconds = result.readUInt32LE(offset);
                value = new Date(seconds * 1000);

                if (useLocalTimezone) {
                    timeoffset = value.getTimezoneOffset();
                    value = new Date(value.setMinutes(value.getMinutes() + timeoffset));
                }
                break;
        }

        return value;
    },

    integrateResultInHandle: function (handle, result) {
        var offset = 0;
        var length = 0;
        var convert = {
            isAdsType: false,
        };

        for (var index = 0; index < handle.propname.length; index++) {
            length = helper.getItemByteLength(handle.byteLength[index], convert);

            var value = result.slice(offset, offset + length);

            if (convert.isAdsType) {
                value = helper.getValue(handle.byteLength[index].name, result, offset, (handle.useLocalTimezone !== 'undefined' ? handle.useLocalTimezone : true));
            }

            handle[handle.propname[index]] = value;

            offset += length;
        }
    },

    parseHandle: function (handle) {
        if (!handle) {
            throw new Error('Handle is undefined!');
        }

        if (typeof handle.name === 'undefined' &&
            (typeof handle.indexGroup === 'undefined' || typeof handle.indexOffset === 'undefined')) {
            throw new Error('The handle doesn\'t have a name or an indexGroup and indexOffset property!');
        }

        if (typeof handle.propname !== 'undefined') {
            if (!Array.isArray(handle.propname)) {
                handle.propname = [handle.propname];
            }
        } else {
            handle.propname = ['value'];
        }

        if (typeof handle.byteLength === 'undefined') {
            handle.byteLength = [exports.BOOL];
        }

        if (!Array.isArray(handle.byteLength)) {
            handle.byteLength = [handle.byteLength];
        }

        handle.totalByteLength = 0
        for (var index = 0; index < handle.byteLength.length; index++) {
            if (typeof handle.byteLength[index] === 'number') {
                handle.totalByteLength += handle.byteLength[index];
            }
            if (typeof handle.byteLength[index] === 'object') {
                handle.totalByteLength += handle.byteLength[index].length;
            }
        }

        if (handle.byteLength.length !== handle.propname.length) {
            throw new Error('The array byteLength and propname should have the same length!');
        }

        if (typeof handle.transmissionMode === 'undefined') {
            handle.transmissionMode = NOTIFY.ONCHANGE;
        }

        if (typeof handle.maxDelay === 'undefined') {
            handle.maxDelay = 0;
        }

        if (typeof handle.cycleTime === 'undefined') {
            handle.cycleTime = 10;
        }

        return handle;
    },

    getBytesFromHandle: function (handle) {
        var property = '';
        var buffer = Buffer.alloc(handle.totalByteLength);
        var offset = 0;
        var convert = {
            isAdsType: false
        };
        // var l = 0

        for (var index = 0; index < handle.propname.length; index++) {
            property = handle.propname[index]
            helper.getItemByteLength(handle.byteLength[index], convert);

            if (!convert.isAdsType) {
                handle[property].copy(buffer, offset);
            }

            if ((typeof handle[property] !== 'undefined') && convert.isAdsType) {
                var datetime;
                var timeoffset;

                switch (handle.byteLength[index].name) {
                    case 'BOOL':
                    case 'BYTE':
                    case 'USINT':
                        buffer.writeUInt8(handle[property], offset);
                        break;
                    case 'SINT':
                        buffer.writeInt8(handle[property], offset);
                        break;
                    case 'UINT':
                    case 'WORD':
                        buffer.writeUInt16LE(handle[property], offset);
                        break;
                    case 'INT':
                        buffer.writeInt16LE(handle[property], offset);
                        break;
                    case 'DWORD':
                    case 'UDINT':
                        buffer.writeUInt32LE(handle[property], offset);
                        break;
                    case 'DINT':
                        buffer.writeInt32LE(handle[property], offset);
                        break;
                    case 'REAL':
                        buffer.writeFloatLE(handle[property], offset);
                        break;
                    case 'LREAL':
                        buffer.writeDoubleLE(handle[property], offset);
                        break;
                    case 'STRING':
                        var stringBuffer = Buffer.alloc(handle[property].toString() + '\0', 'utf8');
                        stringBuffer.copy(buffer, offset);
                        break;
                    case 'TIME':
                    case 'TIME_OF_DAY':
                    case 'TOD':
                        datetime = new Date(handle[p]);

                        if (handle.useLocalTimezone) {
                            timeoffset = datetime.getTimezoneOffset();
                            datetime = new Date(datetime.setMinutes(datetime.getMinutes() - timeoffset));
                        }

                        buffer.writeUInt32LE(datetime.getTime());
                        break;
                    case 'DATE':
                    case 'DATE_AND_TIME':
                    case 'DT':
                        datetime = new Date(handle[p]);

                        if (handle.useLocalTimezone) {
                            timeoffset = datetime.getTimezoneOffset();
                            datetime = new Date(datetime.setMinutes(datetime.getMinutes() - timeoffset));
                        }

                        buffer.writeUInt32LE((datetime.getTime() / 1000));
                        break;
                }
            } else if (typeof handle[property] === 'undefined') {
                throw new Error('Property ' + property + ' not available on handle!');
            }
        }

        handle.bytes = buffer;
    },

    getItemByteLength: function (byteLength, convert) {
        var length = 0;

        if (typeof byteLength === 'number') {
            length = byteLength;
        } else {
            length = byteLength.length;
            convert.isAdsType = true;
        }

        return length;
    },

    findStringEnd: function (data, offset) {
        if (!offset) {
            offset = 0;
        }

        var endpos = offset;

        for (var index = offset; index < data.length; index++) {
            if (data[index] === 0x00) {
                endpos = index;
                break;
            }
        }

        return endpos;
    },

    logPackage: function (info, buffer, commandId, invokeId, name) {
        while (info.length < 10) {
            info = info + ' ';
        }

        var msg = info + ' -> commandId: ' + commandId;
        msg += ' (' + helper.getCommandDescription(commandId) + ') ';
        msg += ', invokeId: ' + invokeId;

        if (name !== undefined) {
            msg += ' name: ' + name;
        }

        if (this.options.verbose > 0) {
            debug(msg);
        }

        if (this.options.verbose > 1) {
            debug(buffer.inspect());
            // debug(buffer)
        }
    },

    emitAdsError: function (errorId) {
        var error = helper.getError(errorId);

        if (error) {
            this.adsClient.emit('error', error);
        }
    },

    getError: function (errorId) {
        if (errorId === 0) {
            return;
        }

        return new Error(ERRORS[errorId]);
    },
};

module.exports = helper;