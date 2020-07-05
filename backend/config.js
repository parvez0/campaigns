const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

let filePath = process.env.CONFIG_FILE_PATH || path.join(__dirname, `/config.yml`);
let configFile = null;

try{
    if(process.env.CONFIG){
        configFile = JSON.parse(process.env.CONFIG);
    }else{
        configFile = fs.readFileSync(path.resolve(filePath), 'utf-8');
        configFile = yaml.parse(configFile);
    }
}catch (e) {
   logger.error(`Failed to read config file at - ${filePath}, exiting the process -`, e);
   process.exit(1);
}

configFile.WORKER_TYPE = configFile.WORKER_TYPE || 'childProcess';
configFile.DOCKER.WORKER_IMAGE = configFile.DOCKER.WORKER_IMAGE || 'grokkertech/campaigns:v1.7.5';

logger.info(`Creating ${configFile.WORKER_TYPE} workers, for executing the jobs`);
logger.info(`Using the following image ${configFile.DOCKER.WORKER_IMAGE} for creating workers`);

module.exports = configFile;
