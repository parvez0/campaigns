const jwt = require('jsonwebtoken');

/*
 * A small in memory cache for storing the active tokens for session based authentication
 * { sessionId: { updatedTime: Date.now(), createdTime: Date } }
 * Deleting the keys which are inactive for more that 10 minutes
 */
const cache = {};

// Middle for authenticating the server based on valid jwt token
module.exports = (req, res, next) => {
    try{
        const cookie = req.cookies.XID;
        if(!req.headers.authorization || !cookie){
            return res.publish(false, 'Failed', { message: 'Unauthorized !!' }, 401);
        }
        // const details = jwt.verify()
        next();
    }catch (e) {

    }
};
