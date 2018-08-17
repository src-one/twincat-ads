interface Options {
    host: string;
    amsNetIdTarget: string;
    amsNetIdSource: string;
    port?: number;
    amsPortSource?: number;
    amsPortTarget?: number;
}

interface Value {
    symName: string;
    byteLength: number;
}

interface Callback {
    (error: Error, handle: any): void;
}

interface AdsType {
    name: string;
    length: number;
}

interface Symbol {
    indexGroup: number;
    indexOffset: number;
    name: string;
    type: string;
    comment?: string;
    value?: any;
}

interface Handle {
    symName: string;
    byteLength: number;
    propname?: string;
    indexGroup?: number,
    indexOffset?: number,
    value?: any;
}

interface TwincatAds {
    connect: (Options, Callback) => {};
    end: (Callback) => {};
    readDeviceInfo: (Callback) => {};
    read: (Value, Callback) => {};
    write: (Value, Callback) => {};
    notify: (Callback) => {};
    writeRead: (Value, Callback) => {};
    getSymbols: (Callback) => {};
    getHandle: (Value, Callback) => {};
    getHandles: ([Value], Callback) => {};
    multiRead: ([Value], Callback) => {};
    multiWrite: ([Value], Callback) => {};

    BOOL: number;
    BYTE: number;
    USINT: number;
    UINT8: number;
    SINT: number;
    INT8: number;
    UINT: number;
    WORD: number;
    UINT16: number;
    INT: number;
    INT16: number;
    DWORD: number;
    UDINT: number;
    UINT32: number;
    DINT: number;
    INT32: number;
    REAL: number;
    LREAL: number;
    STRING: number;
    TIME: number;
    TIME_OF_DAY: number;
    TOD: number;
    DATE: number;
    DATE_AND_TIME: number;
    DT: number;
    //LINT: number; // 64 Bit Integer - currently not supported by TwinCAT
    //ULINT: number; // Unsigned 64 Bit Integer - currently not supported by TwinCAT
}

declare module 'twincat-ads' {
    export = ads;
}

declare let ads: TwincatAds; 
