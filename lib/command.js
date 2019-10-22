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



const helper = require('./helper');
const { ID } = require('./value');

const command = {
    read: function(commandOptions, callback) {
        var buf = Buffer.alloc(12);

        buf.writeUInt32LE(commandOptions.indexGroup, 0);
        buf.writeUInt32LE(commandOptions.indexOffset, 4);
        buf.writeUInt32LE(commandOptions.byteLength, 8);

        var request = {
            commandId: ID.READ,
            data: buf,
            callback: callback,
            name: commandOptions.name
        };

        command.run.call(this, request);
    },

    write: function(commandOptions, callback) {
        var buf = Buffer.alloc(12 + commandOptions.byteLength);

        buf.writeUInt32LE(commandOptions.indexGroup, 0);
        buf.writeUInt32LE(commandOptions.indexOffset, 4);
        buf.writeUInt32LE(commandOptions.byteLength, 8);

        commandOptions.bytes.copy(buf, 12);

        var request = {
            commandId: ID.WRITE,
            data: buf,
            callback: callback,
            name: commandOptions.name
        };

        command.run.call(this, request);
    },

    addNotification: function(commandOptions, callback) {
        var buf = Buffer.alloc(40);

        buf.writeUInt32LE(commandOptions.indexGroup, 0);
        buf.writeUInt32LE(commandOptions.indexOffset, 4);
        buf.writeUInt32LE(commandOptions.byteLength, 8);
        buf.writeUInt32LE(commandOptions.transmissionMode, 12);
        buf.writeUInt32LE(commandOptions.maxDelay, 16);
        buf.writeUInt32LE(commandOptions.cycleTime * 10000, 20);
        buf.writeUInt32LE(0, 24);
        buf.writeUInt32LE(0, 28);
        buf.writeUInt32LE(0, 32);
        buf.writeUInt32LE(0, 36);

        var request = {
            commandId: ID.ADD_NOTIFICATION,
            data: buf,
            callback: callback,
            name: commandOptions.name
        };

        command.run.call(this, request);
    },

    writeRead: function(commandOptions, callback) {
        var buf = Buffer.alloc(16 + commandOptions.writeBuffer.length);

        buf.writeUInt32LE(commandOptions.indexGroup, 0);
        buf.writeUInt32LE(commandOptions.indexOffset, 4);
        buf.writeUInt32LE(commandOptions.readLength, 8);
        buf.writeUInt32LE(commandOptions.writeBuffer.length, 12);

        commandOptions.writeBuffer.copy(buf, 16);

        var request = {
            commandId: ID.READ_WRITE,
            data: buf,
            callback: callback,
            name: commandOptions.name
        };

        command.run.call(this, request);
    },

    deleteDeviceNotification: function(notificationHandle, callback) {
        var buf = Buffer.alloc(4);

        buf.writeUInt32LE(notificationHandle, 0);

        var request = {
            commandId: ID.DEL_NOTIFICATION,
            data: buf,
            callback: callback
        };

        command.run.call(this, request);
    },

    run: function(options) {
        var tcpHeaderSize = 6;
        var headerSize = 32;
        var offset = 0;

        if (!options.callback) {
            throw new Error('A command needs a callback function!');
        }

        var header = Buffer.alloc(headerSize + tcpHeaderSize);

        // 2 bytes resserver (=0)
        header.writeUInt16LE(0, offset);
        offset += 2;

        // 4 bytes length
        header.writeUInt32LE(headerSize + options.data.length, offset);
        offset += 4;

        // 6 bytes: amsNetIdTarget
        var amsNetIdTarget = this.options.amsNetIdTarget.split('.');

        for (var i = 0; i < amsNetIdTarget.length; i++) {
            if (i >= 6) {
                throw new Error('Incorrect amsNetIdTarget length!');
            }

            amsNetIdTarget[i] = parseInt(amsNetIdTarget[i], 10);
            header.writeUInt8(amsNetIdTarget[i], offset);
            offset++;
        }

        // 2 bytes: amsPortTarget
        header.writeUInt16LE(this.options.amsPortTarget, offset);
        offset += 2;

        // 6 bytes amsNetIdSource
        var amsNetIdSource = this.options.amsNetIdSource.split('.');

        for (i = 0; i < amsNetIdSource.length; i++) {
            if (i >= 6) {
                throw new Error('Incorrect amsNetIdSource length!');
            }

            amsNetIdSource[i] = parseInt(amsNetIdSource[i], 10);
            header.writeUInt8(amsNetIdSource[i], offset);
            offset++;
        }

        // 2 bytes: amsPortTarget
        header.writeUInt16LE(this.options.amsPortSource, offset);
        offset += 2;

        // 2 bytes: Command ID
        header.writeUInt16LE(options.commandId, offset);
        offset += 2;

        // 2 bytes: state flags (ads request tcp)
        header.writeUInt16LE(4, offset);
        offset += 2;

        // 4 bytes: length of the data
        header.writeUInt32LE(options.data.length, offset);
        offset += 4;

        // 4 bytes: error code
        header.writeUInt32LE(0, offset);
        offset += 4;

        // 4 bytes: invoke id
        header.writeUInt32LE(++this.invokeId, offset);
        offset += 4;

        var buf = Buffer.alloc(tcpHeaderSize + headerSize + options.data.length);

        header.copy(buf, 0, 0);
        options.data.copy(buf, tcpHeaderSize + headerSize, 0);

        this.pending[this.invokeId] = {
            callback: options.callback,
            timeout: setTimeout(
                function() {
                    delete this.pending[this.invokeId];

                    options.callback('timeout');
                }.bind(this),
                500
            )
        };

        helper.logPackage.call(
            this,
            'sending',
            buf,
            options.commandId,
            this.invokeId,
            options.name
        );

        this.tcpClient.write(buf);
    }
};
module.exports = command;
