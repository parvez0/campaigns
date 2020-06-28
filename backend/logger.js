const LEVELS = { 'ERROR': 1, 'WARN': 2, 'INFO': 3, 'DEBUG' : 4 };
const ENV_LOG_LEVEL = process.env.LOGGER_LOG_LEVEL && LEVELS[process.env.LOGGER_LOG_LEVEL] ? process.env.LOGGER_LOG_LEVEL : 'INFO';
const LOG_LEVEL = LEVELS[ENV_LOG_LEVEL];
const LOGGER_WORKER = process.env.LOGGER_WORKER || process.pid;

console.log('[ LOGGER ] Active Log Level : ', ENV_LOG_LEVEL);

// Getting the caller function's file name
const _getCallerFile = () => {
    const originalFunc = Error.prepareStackTrace;
    let callerfile = null;
    try {
        const err = new Error();
        let currentfile = null;
        Error.prepareStackTrace = function (err, stack) { return stack; };
        currentfile = err.stack.shift().getFileName();
        while (err.stack.length) {
            callerfile = err.stack.shift().getFileName();

            if(currentfile !== callerfile) break;
        }
    } catch (e) {}
    Error.prepareStackTrace = originalFunc;
    if(callerfile){
        const callerfilePath = callerfile.split('/');
        const pathLength = callerfilePath.length;
        callerfile = pathLength > 2 ? `${callerfilePath[pathLength - 2]}/${callerfilePath[pathLength - 1]}`: callerfilePath[pathLength - 1];
    }
    return callerfile;
};

const info = (...args) => {
    const formattedArgs = [];
    args.forEach(arg => {
        formattedArgs.push(typeof arg === 'string' ? arg : JSON.stringify(arg));
    });
    if(LOG_LEVEL - 3 >= 0){
        console.info(new Date().toISOString(), '\x1b[32m', ` INFO  `, '\x1b[0m', `[ ${LOGGER_WORKER} ]`, `--- [   ${_getCallerFile()}   ] : `, ...formattedArgs);
    }
};

const error = (...args) => {
    let formattedArgs = [];
    try {
        for(let i=0; i<args.length; i++){
            const arg = args[i];
            if(!arg){
                continue;
            }
            if(arg.message && arg.response && arg.response.data){
                formattedArgs.push(arg.message);
                formattedArgs.push(JSON.stringify(arg.response.data));
            }else if(arg.message && arg.stack){
                formattedArgs.push(arg.stack);
            } else{
                formattedArgs.push(arg);
            }
        }
    }catch (e) {
        formattedArgs = args;
    }
    if(LOG_LEVEL - 1 >= 0) {
        console.info(new Date().toISOString(), '\x1b[31m', ` ERROR `, `[ ${LOGGER_WORKER} ]`, '\x1b[0m', `--- [   ${_getCallerFile()}   ] : `, ...formattedArgs);
    }
};

const warn = (...args) => {
    let formattedArgs = [];
    args.forEach(arg => {
        formattedArgs.push(typeof arg === 'string' ? arg : JSON.stringify(arg));
    });
    if(LOG_LEVEL - 2 >= 0){
        console.info(new Date().toISOString(), '\x1b[33m', ` WARN  `, `[ ${LOGGER_WORKER} ]`,'\x1b[0m',`--- [   ${_getCallerFile()}   ] : `, ...formattedArgs);
    }
};

const debug = (...args) => {
    if(LOG_LEVEL - 4 >= 0){
        console.info(new Date().toISOString(), '\x1b[34m', ` DEBUG `, '\x1b[0m', `[ ${LOGGER_WORKER} ]` ,`--- [   ${_getCallerFile()}   ] : `, ...args);
    }
};

module.exports = {
    info,
    error,
    warn,
    debug
};
