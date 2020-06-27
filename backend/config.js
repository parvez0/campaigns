const yaml = require('yaml');
const fs = require('fs');


let filePath = process.env.CONFIG_FILE_PATH || `${__dirname}/config.yml`;
let configFile = null;

try{
    configFile = fs.readFileSync(filePath, 'utf-8');
    configFile = yaml.parse(configFile);
}catch (e) {
   logger.error(`Failed to read config file at - ${filePath}, exiting the process`);
   process.exit(1);
}

module.exports = configFile;
