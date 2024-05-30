// Set up logging
import consoleLogLevel from 'console-log-level';
const LOGLEVEL = process.env.loglevel || 'info';
console.log('Log level = ' + LOGLEVEL);

function logPrefix(level: string = 'info'): string {
    return new Date().toISOString();
}

// @ts-ignore
var log = consoleLogLevel({ 
    // @ts-ignore
    level: LOGLEVEL,
    prefix: logPrefix,
    stderr: true
});

// @ts-ignore
log.log = (message?: any, ...optionalParams: any[]) => { _console.log(logPrefix() + message, ...optionalParams)}


// preserve old console object
var _console = console;

var new_console = {
    log: (message?: any, ...optionalParams: any[]) => { _console.log(logPrefix() + ' ' + message, ...optionalParams)},
    trace: (message?: any, ...optionalParams: any[]) => { log.trace(message, ...optionalParams) },
    debug: (message?: any, ...optionalParams: any[]) => { log.debug(message, ...optionalParams) },
    warn: (message?: any, ...optionalParams: any[]) => { log.warn(message, ...optionalParams) },
    info: (message?: any, ...optionalParams: any[]) => { 
        log.info(message, ...optionalParams) 
    },
    err: (message?: any, ...optionalParams: any[]) => { log.error(message, ...optionalParams) },
    error: (message?: any, ...optionalParams: any[]) => { _console.error(message, ...optionalParams) },
    fatal: (message?: any, ...optionalParams: any[]) => { log.fatal(message, ...optionalParams) },
}

// @ts-ignore
global.console = new_console;

export default {};