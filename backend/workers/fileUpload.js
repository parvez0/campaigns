global.logger = require('../logger');
global.config = require('../config');
const readLine = require('readline');
const path = require('path');
const { Audience, Jobs, mongoose } = require('../models/mongo');

const fs = require('fs');

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
        fd.on('line', async (line) => {
            try{
                if(currentLine >= lastLine){
                    logger.debug(`Pushing line ${line}`);
                    /**
                    * File format that needs to be uploaded should be of type csv
                    * @headers : name, email, number, [tags]
                    */
                    const row = line.split(',');
                    const doc = new Audience({
                        accountId: uid,
                        jobId: jobId,
                        rowId: `${fileName}_${currentLine}`,
                        name: row[0],
                        email: row[1],
                        number: row[2],
                        tags: row.slice(3)
                    });
                    await doc.save();
                }
                currentLine++;
            }catch (e) {
                logger.error(`Failed to push line ${line} :`, e);
            }
        }).on('close', async () => {
            jobDetails.status = 'completed';
            await jobDetails.save();
            logger.info(`File ${fileName} uploaded successfully, exiting the process gracefully`);
            process.exit();
        });
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
