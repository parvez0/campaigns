const jwt = require('jsonwebtoken');
const logger = require('@grokker/logger');
const { Users, Session, mongoose } = require('./mongo');

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
    const token = jwt.sign({ ...userDetails._doc, sessionId }, config.JWT.SECRET, { expiresIn: config.JWT.EXPIRY_TIME || 86400 });
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

module.exports = {
    verifyUser,
    signup,
    logout
}
