const mongoose = require('mongoose');

const crypto = require('crypto');
const Schema =  mongoose.Schema;
const Model = mongoose.model;

const mongodbConnectionUri = `${config.MONGODB.URI}/${config.MONGODB.DATABASE}?${config.MONGODB.ARGUMENTS}`;
logger.info(`Generated mongodb uri : ${mongodbConnectionUri}`);
/**
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

/**
 * Schema for sessions collection where session info of the users and there auth token will be stored
 */
const sessionSchema = new Schema({
   userId: { type: String, required: true },
   token: { type: String, required: true },
   active: { type: Boolean, default: true },
   createdDate: { type: Date, default: Date.now() },
   updatedDate: { type: Date, default: Date.now() }
});

sessionSchema.index({ _id: 1, active: 1 });

/**
 * Schema for users collection where users login information will be stored
 */
const usersSchema = new Schema({
   username: { type: String, required: true, index: { unique: true } },
   password: { type: String },
   saltToken: { type: String },
   email: { type: String, index: { unique: true } },
   status: { type: String },
   createdDate: { type: Date, default: Date.now() },
   updatedDate: { type: Date, default: Date.now() }
});

usersSchema.methods.setPassword = function (password){
    /**
     * For creating a password we require a random string which will be appended with the original password
     * and a hash will be created.
     */
    this.saltToken = crypto.randomBytes(20).toString('hex');
    this.password = crypto.pbkdf2Sync(password, this.saltToken, 1024, 64, 'sha256').toString('hex');
}

usersSchema.methods.verifyPassword = function (password){
    /**
     * Password will be stored as a hash in the db, to verify the password provided by user first we need to create the hash and
     * then compare it with the original password's hash
     */
    const passwordHash = crypto.pbkdf2Sync(password, this.saltToken, 1024, 64, 'sha256').toString('hex');
    return passwordHash === this.password;
}

usersSchema.index({ username: 1, status: 1 });

/**
 * Schema for jobs collection where jobs information will be stored
 */
const jobsSchema = new Schema({
   status: { type: String, required: true },
   jobName: { type: String },
   jobArgs: { type: Array, required: true },
   jobType: { type: String, required: true },
   comment: { type: String },
   retried: { type: Number },
   workerId: { type: String },
   accountId: { type: String, required: true },
   createdDate: { type: Date, default: Date.now() },
   updatedDate: { type: Date }
});

jobsSchema.index({ accountId: 1 });
jobsSchema.index({ status: 1 });
jobsSchema.index({ accountId: 1, status: 1 });

/**
 * Schema for audience which will be use for sending the campaigns
 */
const audienceSchema = new Schema({
    accountId: { type: String, required: true },
    jobId: { type: String, required: true },
    rowId: { type: String, required: true },
    number: { type: String },
    email: { type: String },
    name: { type: String },
    tags: { type: Schema.Types.Array },
    createdDate: { type: Date, default: Date.now() },
    updatedDate: { type: Date, default: Date.now() }
});

audienceSchema.index({ accountId: 1 });
audienceSchema.index({ jobId: 1 });
audienceSchema.index({ accountId: 1, tags: 1 });
audienceSchema.index({ accountId: 1, rowId: -1 });

/**
 * Collection models objects
 */
const Users = Model('users', usersSchema);
const Session = Model('sessions', sessionSchema);
const Jobs = Model('jobs', jobsSchema);
const Audience = Model('audience', audienceSchema);

module.exports = {
    mongoose,
    Users,
    Session,
    Jobs,
    Audience
}
