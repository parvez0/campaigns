const jwt = require('jsonwebtoken');
const path = require('path');
const readLine = require('readline');
const fs = require('fs');
const { Users, Session, mongoose, Jobs } = require('./mongo');

const workerType = config.WORKER_TYPE;

/*
 * RandomString function will create a random alpha numeric string to be used as JWT Secret
 */
const randomString = (length = 20) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomString = '';
    for(let i=0; i<length; i++){
        randomString += chars[Math.floor(Math.random() * chars.length)];
    }
    logger.info(`JWT secret ================= :`, randomString);
    return randomString;
}

// Setting the JWT Secret to global config if it is not provided
config.JWT.SECRET = config.JWT.SECRET || randomString();

const generateJWT = async (userDetails) => {
    const userId = userDetails._doc._id;
    delete userDetails._doc.password;
    delete userDetails._doc.saltToken;
    delete userDetails._doc._id;
    const sessionId = mongoose.Types.ObjectId();
    const token = jwt.sign({ ...userDetails._doc, sessionId, userId }, config.JWT.SECRET, { expiresIn: config.JWT.EXPIRY_TIME || 86400 });
    const session = new Session({ userId, token, _id: sessionId });
    await session.save();
    return token;
}

const verifyUser = async (usernameOrEmail, password) => {
    try{
        const userDetails = await Users.findOne({ $or : [{ username: usernameOrEmail }, { email: usernameOrEmail } ] });
        if(userDetails.verifyPassword(password)){
            return generateJWT(userDetails);
        }else{
            return Promise.reject(new Error(`Password doesn't match`));
        }
    }  catch (e) {
        logger.error(`Failed to login - ${usernameOrEmail} :`, e);
        return Promise.reject(new Error(`Failed to verify password, encountered an error`));
    }
};

const signup = async ({ username, email, password }) => {
    try{
        const userDetails = await Users.findOne({ $or : [{ username }, { email } ] });
        if(userDetails){
            return Promise.reject(new customError('Username or email already exists', 409));
        }
        const user = new Users();
        user.username = username;
        user.email = email;
        user.status = 'active';
        user.setPassword(password);
        await user.save();
        return generateJWT(user);
    }catch (e) {
        logger.error(`Failed to sign up - ${email} :`, e);
        return Promise.reject(new customError('Failed to sign up, encountered an error.', 422));
    }
}

const logout = async (sessionId) => {
    try{
        const sessionDetails = await Session.findOne({ _id: sessionId });
        if(!sessionDetails){
            logger.warn(`Illegal access by user ${email} session details not found`);
            return Promise.resolve();
        }
        sessionDetails.active = false;
        sessionDetails.updatedTime = new Date().toISOString();
        await sessionDetails.save();
        delete localCache[sessionDetails._doc._id];
    }catch (e) {
        logger.error(`Failed to logout user ${user} -`, e);
        return Promise.reject(new customError('Failed to logout, please try again.', 500));
    }
}

const getJobArgs = (fileObject, id, userId) => {
    let args = [];
    switch (workerType) {
        case 'docker':
            args = ['/app/workers/fileUpload.js', `/app/assets/${fileObject.filename}`, id, userId];
            break;
        default:
            args = [`${path.join(__dirname, '../workers/fileUpload.js')}`, fileObject.path, id, userId];
    }
    return args;
}

const createFileUploadJobProfile = async (fileObject, userId, user) => {
    try{
        const id = mongoose.Types.ObjectId();
        const jobProfile = new Jobs({
            _id: id,
            accountId: userId,
            jobName: `${fileObject.filename}_audience_upload`,
            status: `pending`,
            jobArgs: getJobArgs(fileObject, id, userId),
            jobType: `fileupload`
        });
        await jobProfile.save();
        logger.info(`Job profile created for file ${fileObject.filename}`);
    }catch (e) {
        logger.error(`Failed to create jobProfile for user ${user} - and file ${fileObject.filename} -`, e);
        return Promise.reject(new Error('Failed to create jobProfile'));
    }
}

const verifyUploadedFile = async (filePath) => {
    try{
        return new Promise((resolve, reject) => {
            const fd = readLine.createInterface({ input: fs.createReadStream(path.resolve(filePath)) });
            const actualRows = ['name', 'email', 'number', 'tags'];
            let fileValid = true;
            fd.on('line', line => {
                const row = line.split(',');
                if(actualRows.length > row.length){
                    fileValid = false;
                    fd.close();
                    fd.removeAllListeners();
                    return;
                }
                for(let i=0; i < actualRows.length; i++){
                    if(actualRows[i] !== row[i].trim()){
                        fileValid = false;
                        fd.close();
                        fd.removeAllListeners()
                        return;
                    }
                }
                fd.close();
                fd.removeAllListeners()
                return;
            }).on('close', () => {
                if(fileValid){
                    return resolve();
                }else{
                    return reject(new customError(`Invalid header format, please verify that csv file is in this format ${actualRows.join(',')}`, 400));
                }
            });
        })
    }catch (e) {
        logger.error(`Failed to verify file ${filePath} -`, e);
        return Promise.reject(new customError('Failed to create jobProfile', 422));
    }
}

module.exports = {
    verifyUser,
    signup,
    logout,
    createFileUploadJobProfile,
    verifyUploadedFile
}
