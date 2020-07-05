global.logger = require('../logger');
global.config = require('../config');
const readLine = require('readline');
const path = require('path');
const memwatch = require('node-memwatch');
const heapdump = require('heapdump');

const { Audience, Jobs } = require('../models/mongo');

memwatch.on('leak', (info) => {
    logger.warn('Memory leak detected: ', info);
    const filePath = process.env.HEAP_DUMP_FILE_PATH || `/app/assets/heapdump_${new Date().getMilliseconds()}.log`;
    heapdump.writeSnapshot(filePath, (err, filename) => {
        if (err) logger.error(err);
        else logger.warn('Wrote snapshot: ' + filename);
    })
});

const fs = require('fs');

const pushBatch = (batch, currentLine) => {
    return new Promise(resolve => {
        Audience.insertMany(batch, (err) => {
           if(err){
               logger.error(`Failed to upload batch : ${currentLine - batch.length} - ${currentLine}`);
           }
           return resolve();
        });
    });
}

const startWorker = async (fileName, jobId, uid) => {
    const document = await Audience.find({ jobId: jobId }).sort({ rowId : -1 }).limit(1);
    let jobDetails = await Jobs.findOne({ _id: jobId });
    if(!jobDetails){
        logger.error(`JobDetails for jobId ${jobId} and file ${fileName} doesn't exits`);
        process.exit(1);
    }
    try{
        if(!fs.existsSync(path.resolve(fileName))){
            throw new Error(`No such file ${fileName} doesn't exits`);
        }
        jobDetails.status = 'running';
        jobDetails = await jobDetails.save();
        /**
         * Checking for any last failed job for this file
         */
        let lastLine = 1;
        let currentLine = 0;
        if(document && document.length > 0){
            const rowId = document[0]._doc.rowId.split('_');
            lastLine = parseInt(rowId[rowId.length - 1]) + 1;
            logger.info(`Continuing the upload from lineNumber : ${lastLine}`);
        }
        /**
         * A stream file descriptor for reading a file line by line
         */
        const fd = readLine.createInterface({ input: fs.createReadStream(path.resolve(fileName)) });
        let batch = [];
        /**
         * Reading synchronous lines from the descriptor
         */
        for await (let line of fd){
            try{
                if(currentLine >= lastLine){
                    logger.debug(`Pushing line ${line}`);
                    /**
                    * File format that needs to be uploaded should be of type csv
                    * @headers : name, email, number, [tags]
                    */
                    const row = line.split(',');
                    let tags = row.slice(3).join(',');
                    tags = tags && tags.replace(/\\|\\n|\"/ig, '').split(',');
                    batch.push({
                        accountId: uid,
                        jobId: jobId,
                        rowId: `${fileName}_${currentLine}`,
                        name: row[0],
                        email: row[1],
                        number: row[2],
                        tags: tags
                    });
                }
                currentLine += 1;
                logger.debug(`Current line :`, currentLine)
                if(batch.length >= 100){
                    logger.info(`Processing records : ${currentLine - batch.length} - ${currentLine}`);
                    await pushBatch(batch, currentLine);
                    batch = [];
                }
            }catch (e) {
                currentLine += 1;
                logger.error(`Failed to push line ${line} :`, e);
            }
        }
        /**
         * This will process any leftOver records
         */
        if(batch.length){
            logger.info(`Processing records : ${currentLine - batch.length} - ${currentLine}`);
            await pushBatch(batch, currentLine);
        }
        /**
         * Changing the status of the job to completed after successful db insert
         */
        jobDetails.status = 'completed';
        await jobDetails.save();
        logger.info(`File ${fileName} uploaded successfully, exiting the process gracefully`);
        process.exit();
    }catch (e) {
        /**
         * Comment will contains the error message in case of failure
         */
        logger.error(`Failed to process data for file ${fileName} -`, e);
        jobDetails.status = 'failed';
        jobDetails.comment = e.message;
        await jobDetails.save();
        process.exit(1);
    }
};

/**
 * Command line argument for starting the process - node script <<fileName to be uploaded>> <<uid of the user who schedule this process>>
 */
(async ()=>{
    const args = process.argv.slice(2);
    if(args.length !== 3){
        logger.error(`Please provide exactly 3 parameters filename, jobId and uid, stopping the worker`);
        process.exit(1);
    }
    logger.info(`Starting the file upload worker for - ${args[0]}`);
    await startWorker(args[0], args[1], args[2]);
})();
