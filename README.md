twincat-ads [![NPM Version](https://img.shields.io/npm/v/twincat-ads.svg)](https://www.npmjs.com/package/twincat-ads) ![node](https://img.shields.io/node/v/twincat-ads.svg)
======

> This is a client implementation of the [Twincat](http://www.beckhoff.com/english.asp?twincat/default.htm) ADS protocol from [Beckhoff](http://http//www.beckhoff.com/).

### Changelog

initial version

### Connect to the Host

```javascript
var ads = require('node-ads');

var options = {
    // The IP or hostname of the target machine
    host: "10.0.0.2",

    // The NetId of the target machine
    amsNetIdTarget: "5.1.204.160.1.1",
    
    // The NetId of the source machine.
    // You can choose anything in the form of x.x.x.x.x.x,
    // but on the target machine this must be added as a route.
    amsNetIdSource: "192.168.137.50.1.1",

    // OPTIONAL: (These are set by default)
    // The tcp destination port
    port: 48898

    // The ams source port
    amsPortSource: 32905

    // The ams target port
    amsPortTarget: 801
}

var client = ads.connect(options, function() {
    this.readDeviceInfo(function(error, result) {
        if (error) {
            console.log(error);
        }

        console.log(result);
        this.end();
    });
});

client.on('error', function(error) {
    console.log(error);
});
```


### How to define Handles

```javascript
var handle = {
    // The symname is the name of the Symbol which is defined in 
    // the PLC
    symName: '.TESTINT',

    // An ads type object or an array of type objects.
    // You can also specify a number or an array of numbers,
    // the result will then be a buffer object.
    // If not defined, the default will be BOOL.
    byteLength: ads.INT,

    // The propery name where the value should be written.
    // This can be an array with the same length as the array 
    // length of byteLength.
    // If not defined, the default will be 'value'.
    propname: 'value',

    // The value is only necessary to write data.
    value: 5,

    // OPTIONAL:
    // (These are set by default)  
    transmissionMode: ads.NOTIFY.ONCHANGE // or ads.NOTIFY.CYLCIC
    
    // Latest time (in ms) after which the event has finished
    maxDelay: 0,

    // Time (in ms) after which the PLC server checks whether 
    // the variable has changed
    cycleTime: 10,
};
```


### Read single symbol

```javascript
var handle = {
    symName: '.TESTINT',
    byteLength: ads.INT,
};

var client = ads.connect(options, function() {
    this.read(handle, function(error, handle) {
        if (error) {
            console.log(error);
        };

        console.log(handle.value);

        this.end();
    })
});
```


### Write single symbol

```javascript
var handle = {
    symName: '.TESTINT',
    byteLength: ads.INT,
    value: 5
};

var client = ads.connect(options, function() {
    this.write(handle, function(error) {
        if (error) {
            console.log(error);
        }

        this.read(handle, function(error, handle) {
            if (error) {
                 console.error(error);
            }

            console.log(handle.value);

            this.end();
        });
    });
});
```


### Read multiple symbols

```javascript
var client = ads.connect(options, function() {
    this.multiRead(
        [{
            symName: '.TESTBOOL',
            byteLength: ads.BOOL,
        }, {
            symName: '.TESTINT',
            byteLength: ads.INT,
        }],
        function (handles) {
            if (handles.error) {
                console.error(handles.error);
            }

            console.log(handles);

            this.end();
        }
    );
});
```


### Write multiple symbols

```javascript
var client = ads.connect(options, function() {
    this.multiWrite(
        [{
            symName: '.TESTBOOL',
            byteLength: ads.BOOL,,
            value: true
        }, {
            symName: '.TESTINT',
            byteLength: ads.INT,,
            value: 5
        }],
        function (handles) {
            if (handles.error) {
                console.error(handles.error);
            }

            console.log(handles);

            this.end();
        }
    );
});
```


### Get handles

```javascript
var client = ads.connect(options, function() {
    this.getHandles(
        [{
            symName: '.TESTBOOL',
        }, {
            symName: '.TESTINT',
        }],
        function (error, handles) {
            if (error) {
                console.error(error);
            } else if (handles.error) {
                console.error(handles.error);
            } else {
                console.log(handles);
            }

            this.end();
        }
    );
})
```


### Get notifications

```javascript
var handle = {
    symName: '.CounterTest',       
    byteLength: ads.WORD,  
};

var client = ads.connect(options, function() {
    this.notify(handle);
});

client.on('notification', function(handle){
    console.log(handle.value);
});

process.on('exit', function () {
    console.log('exit');
});

process.on('SIGINT', function() {
    client.end(function() {
        process.exit();
    });
});
```


### Get symbol list

```javascript
var client = ads.connect(options, function() {
    this.getSymbols(function(error, symbols) {
        if (error) {
            console.error(error);
        }
        console.log(symbols);

        this.end();
    });
});
```


### Read device state

```javascript
var client = ads.connect(options, function() {
    this.readState(function(error, result) {
        if (error) {
            console.error(error);
        }

        var text = '?';

        switch (result.adsState) {
            case ads.ADSSTATE.INVALID:
                text = 'INVALID';
                break;
            case ads.ADSSTATE.IDLE:
                text = 'IDLE';
                break;
            case ads.ADSSTATE.RESET:
                text = 'RESET';
                break;
            case ads.ADSSTATE.INIT:
                text = 'INIT';
                break;
            case ads.ADSSTATE.START:
                text = 'START';
                break;
            case ads.ADSSTATE.RUN:
                text = 'RUN';
                break;
            case ads.ADSSTATE.STOP:
                text = 'STOP';
                break;
            case ads.ADSSTATE.SAVECFG:
                text = 'SAVECFG';
                break;
            case ads.ADSSTATE.LOADCFG:
                text = 'LOADCFG';
                break;
            case ads.ADSSTATE.POWERFAILURE:
                text = 'POWERFAILURE';
                break;
            case ads.ADSSTATE.POWERGOOD:
                text = 'POWERGOOD';
                break;
            case ads.ADSSTATE.ERROR:
                text = 'ERROR';
                break;
            case ads.ADSSTATE.SHUTDOWN:
                text = 'SHUTDOWN';
                break;
            case ads.ADSSTATE.SUSPEND:
                text = 'SUSPEND';
                break;
            case ads.ADSSTATE.RESUME:
                text = 'RESUME';
                break;
            case ads.ADSSTATE.CONFIG:
                text = 'CONFIG';
                break;
            case ads.ADSSTATE.RECONFIG:
                text = 'RECONFIG';
                break;
            case ads.ADSSTATE.STOPPING:
                text = 'STOPPING';
                break;
        }
        console.log('The state is ' + text);

        this.end();
    });
});
```


### Event-Driven detection for changes of the Symbol-Table

If the symbol table changes, like a new PLC program is written into the controller, the handles must be loaded once again.
  
The example below illustrates how changes of the Symbol-Table can be detected.

```javascript
var start = false;

var client = ads.connect(options, function() {
    start = true;
    this.notify(handle);
});

var handle = {
    indexGroup: ads.ADSIGRP.SYM_VERSION,
    indexOffset: 0,
    byteLength: ads.BYTE,
};

client.on('notification', function(handle) {
    if (start) {
      console.log('symbol table version ' + handle.value);
    } else {
      console.log('symbol table changed ' + handle.value);
    }
    
    start = false;
});

process.on('SIGINT', function() {
    client.end(function() {
        process.exit();
    });
});

client.on('error', function(error) {
    console.log(error);
});
```

> Twincat and ADS (Automation Device Specification) is brought by Beckhoff&copy;   
> I'm not affiliated from Beckhoff&copy;!

> Credits:   
> - The initial idea to implement the TCP/IP API came from Inando - Copyright (c) 2012 Inando