interface ConnectionSettings {
    host: string;
    amsNetIdTarget: string;
    amsNetIdSource: string;
    port?: number;
    amsPortSource?: number;
    amsPortTarget?: number;
    verbose?: boolean;
}

interface Callback {
    (error: Error, result: Handle|Handle[]|undefined): void;
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
    totalByteLength?: number,
    transmissionMode?: number,
    maxDelay?: number,
    cycleTime?: number,
    value?: any;
}

interface Handle {
    symName: string;
    byteLength: number;
    propname?: string;
    indexGroup?: number,
    indexOffset?: number,
    value?: any;
    error?: any;
}

interface TwincatAds {
    connect: (ConnectionSettings, Callback) => {};
    end: (Callback) => {};
    readDeviceInfo: (Callback) => {};
    read: (Handle, Callback) => {};
    write: (Handle, Callback) => {};
    notify: (Callback) => {};
    writeRead: (Handle, Callback) => {};
    getSymbols: (Callback) => {};
    getHandle: (Handle, Callback) => {};
    getHandles: ([Handle], Callback) => {};
    multiRead: ([Handle], Callback) => {};
    multiWrite: ([Handle], Callback) => {};

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
