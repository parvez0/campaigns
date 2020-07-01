const DockerNode = require('dockerode');
const fs = require('fs');
const path = require('path');
const dockerConfig = config.DOCKER;
const workerImage = dockerConfig.WORKER_IMAGE;
const workerNetwork = dockerConfig.WORKER_NETWORK || '';
const assetsPath = dockerConfig.ASSETS_HOST_PATH || path.join(__dirname, '../assets');

const options = {
    Promise: require('bluebird'),
    host: dockerConfig.HOST || '127.0.0.1',
    port: dockerConfig.PORT || 2375,
    version: dockerConfig.API_VERSION || 'v1.40' // required when Docker >= v1.13, https://docs.docker.com/engine/api/version-history/
};

/**
 * Requires tls certificate for authentication with docker, if authentication is enable on docker api
 */
if(dockerConfig.TLS_VERIFY){
    logger.info(`Using docker with authentication, please make sure that you have provided ca, cert and key files absolute path in configFile`);
    options.ca = fs.readFileSync(path.resolve(dockerConfig.CA));
    options.cert = fs.readFileSync(path.resolve(dockerConfig.CERT));
    options.key = fs.readFileSync(path.resolve(dockerConfig.KEY));
}

const dockerClient = new DockerNode(options);

/**
 * @param workerId {String}
 * @param jobArgs {Array<String>}
 * @returns {Promise<never>}
 * Creates a docker service with maximum retries 2 on failure with 60 Seconds of gap on every restart
 */
const createContainer = async (workerId, jobArgs) => {
    try{
        const EnvironmentVariables = [];
        const keys = Object.keys(process.env);
        keys.forEach(key => {
           EnvironmentVariables.push(`${key}=${process.env[key]}`);
        });
        EnvironmentVariables.push(`CONFIG=${JSON.stringify(config)}`);
        EnvironmentVariables.push(`LOGGER_WORKER=${workerId}`);
        const networks = await dockerClient.listNetworks();
        let networkSettings = null;
        for(let i=0; i < networks.length; i++){
            if(networks[i].Name === workerNetwork){
                networkSettings = networks[i];
            }
        }
        if(!networkSettings){
            logger.error(`Worker network ${workerNetwork} not found, cannot create worker`);
            return;
        }
        const worker = await dockerClient.createService({
            "Name": workerId,
            "TaskTemplate": {
                "ContainerSpec": {
                    "Image": workerImage,
                    "Command": ["node", ...jobArgs],
                    "ENV": EnvironmentVariables,
                    "Mounts": [
                        {
                            "Source": assetsPath,
                            "Target": "/app/assets",
                            "Type": "bind"
                        }
                    ]
                },
                "RestartPolicy": {
                    "Condition": "on-failure",
                    "Delay": 60000000000, //Nano seconds 1 Sec = 10^9
                    "MaxAttempts": 2
                },
                "Networks": [
                    {
                        "Target": workerNetwork
                    }
                ],
            }
        });
        logger.info(`Worker created ${workerId} -`, worker);
        if(config.DOCKER.FETCH_LOGS_FROM_WORKER){
            worker.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
                if(err){
                    logger.error(`Failed to fetch the service logs for worker - ${workerId} -`, err);
                }
                stream.pipe(process.stdout);
            });
        }
    }catch (e) {
        logger.error(`Failed to create the container for ${workerId} :`, e);
        return Promise.reject('Failed to create container');
    }
};

const fetchTasks = async (workerId) => {
    try{
        const taskList = await dockerClient.listTasks({filters: JSON.stringify({"service":[workerId]}) });
        return taskList;
    }catch (e) {
        e = e.statusCode === 404 ? e.message : e;
        logger.error(`Failed to fetch worker status for ${workerId} -`, e);
        return Promise.resolve();
    }
}

const deleteWorker = async (workerId) => {
    try {
        const worker = await dockerClient.getService(workerId);
        await worker.remove();
    }catch (e) {
        e = e.statusCode === 404 ? e.message : e;
        logger.error(`Failed to delete worker for ${workerId} -`, e);
        return Promise.resolve(`Failed to delete worker`);
    }
}


// createContainer('nodeFileuploadworkerId', ['/app/workers/fileUpload.js', '/app/assets/audiencesheetsheet1_15932709979.csv', '5ef75e0662b9d5a3b4eb68db', '5ef318bd11d3e134150a16e7'])
module.exports = {
    createContainer,
    fetchTasks,
    deleteWorker
}
