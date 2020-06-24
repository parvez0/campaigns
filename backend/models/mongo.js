const mongoose = require('mongoose');
const logger = require('@grokker/logger');
const crypto = require('crypto');
const Schema =  mongoose.Schema;
const Model = mongoose.model;

const mongodbConnectionUri = `${config.MONGODB.URI}/${config.MONGODB.DATABASE}?${config.MONGODB.ARGUMENTS}`;
logger.info(`Generated mongodb uri : ${mongodbConnectionUri}`);
/*
 * Checking if mongodb is running otherwise don't start the project
 */
(async () => {
    try{
        await mongoose.connect(mongodbConnectionUri, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });
        logger.info(`Mongodb connection established`);
    }catch (e) {
        logger.error(`Failed to established a connection with mongodb, exiting the process : `, e);
        process.exit(1);
    }
})();

const usersSchema = new Schema({
   username: { type: String, required: true, index: { unique: true } },
   password: { type: String },
   saltToken: { type: String },
   email: { type: String, index: { unique: true } },
   status: { type: String },
   createdDate: { type: Date, default: Date.now() }
});

usersSchema.methods.setPassword = function (password){
    /*
     * For creating a password we require a random string which will be appended with the original password
     * and a hash will be created.
     */
    this.saltToken = crypto.randomBytes(20).toString('hex');
    this.password = crypto.pbkdf2Sync(password, this.saltToken, 1024, 64, 'sha256').toString('hex');
}

usersSchema.methods.verifyPassword = function (password){
    /*
     * Password will be stored as a hash in the db, to verify the password provided by user first we need to create the hash and
     * then compare it with the original password's hash
     */
    const passwordHash = crypto.pbkdf2Sync(password, this.saltToken, 1024, 64, 'sha256').toString('hex');
    return passwordHash === this.password;
}

usersSchema.index({ username: 1, status: 1 });

const Users = Model('users', usersSchema);

module.exports = {
    Users,
}
