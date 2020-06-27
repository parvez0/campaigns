const CronJob = require('cron').CronJob;
const spawn = require('child_process').spawn;
const { Jobs } = require('./mongo');

const workerType = config.WORKER_TYPE || 'childProcess';

const isRunning = async (processName, workerId) => {
    try{
        switch (workerType) {
            case 'docker':
                break;
            default:
                try {
                    return process.kill(workerId, 0);
                }catch (e) {
                    logger.debug(`Process ${processName}_${workerId} is not running - ${e.code}`);
                    return false;
                }
        }
    }catch (e) {
        logger.error(`Failed to check the status of worker ${processName}_${workerId} -`, e);
        return false;
    }
}

/**
 * Run this function every minute to clear the inactive sessions from the in memory cache
 * The sessions which are inactive for more than 3 minutes will be deleted
 */
const clearInMemorySessionCache = () => {
    logger.debug(`Started clear session memory worker`);
    const { IN_MEMORY_CACHE_EXPIRY } = config;
    let expiryTime = IN_MEMORY_CACHE_EXPIRY || 3;
    /**
     * Convert the expiry time to milliseconds
     */
    expiryTime = expiryTime * 60 * 1000;
    const cacheKeys = Object.keys(localCache);
    cacheKeys.forEach(key => {
        try{
            const lastActive = new Date(localCache[key].updatedTime);
            const currentDate = new Date();
            if(currentDate - lastActive > expiryTime){
                logger.debug(`Deleting the cache with key - ${key} - lastActiveTime -`, lastActive.toISOString());
                delete localCache[key];
            }
        }catch (e) {
            logger.error(`Failed to delete session with key ${key} -`, e);
        }
    });
}
/**
 * @param job
 * @returns {Promise<void>}
 * Functions create worker as child process or docker containers based on configuration settings
 * By default it will create a child process
 */
const createWorker = async (job, retried = 0) => {
    try{
        switch (workerType){
            case 'docker':
                break;
            default:
                logger.debug(`Creating a child process for job ${job._doc.jobName}`);
                const proc = spawn('node', job._doc.jobArgs);
                proc.stdout.pipe(process.stdout);
                proc.stderr.pipe(process.stderr);
                job.status = 'running';
                job.workerId = proc.pid;
                job.retried = retried;
                await job.save();
        }
    }catch (e) {
        logger.error(`Failed to create worker for job ${job._doc.jobName}_${job._doc._id} -`, e);
    }
}

/**
 * Every minute this function will look for new jobs to execute
 */
const executeJobs = async () => {
    try{
        logger.debug(`Checking for pending jobs`);
        const jobs = await Jobs.find({ status: 'pending' });
        logger.debug(`Found ${jobs.length} jobs to execute`);
        for(let i=0; i<jobs.length; i++){
            await createWorker(jobs[i]);
        }
    }catch (e) {
        logger.error(`Failed to create workers - `, e);
    }
}
/**
 * Every minute this function will verify all the running jobs if any failure it will restart that job
 */
const verifyAllTheRunningJobs = async () => {
    try{
        const runningJobs = await Jobs.find({"$or": [{ status: 'running'}, { status: 'failed' }]});
        logger.debug(`Verifying running status of ${runningJobs.length} jobs`);
        for(let i=0; i<runningJobs.length; i++){
            const job = runningJobs[i];
            try{
                if(!await isRunning(job._doc.jobName, job._doc.workerId) && job._doc.retried < 3){
                    logger.debug(`Re-Starting job ${job._doc.jobName}_${job._doc._id}`);
                    await createWorker(job, job._doc.retried + 1);
                }else if(job._doc.retried >= 3){
                    job.status = 'dead';
                    await job.save();
                }
            }catch (e) {
                logger.error(`Failed to re-create worker for job ${job._doc.jobName}_${job._doc._id} -`, e);
            }
        }
    }catch (e) {
        logger.error(`Failed to perform health check on running jobs -`, e);
    }
}

const onCompleteCronExecution = (data) => {
    logger.info('Finished execution - ', data);
}

/**
 * System cron which will run every minute from the moment this project starts
 */
const systemJobs = [ clearInMemorySessionCache, executeJobs, verifyAllTheRunningJobs ];
const cronList = [];
systemJobs.forEach(jobFunction => {
    const job = new CronJob('* * * * *', jobFunction, onCompleteCronExecution, true);
    job.start();
    cronList.push(job);
});

logger.info(`Started ${cronList.length} system cron`);
