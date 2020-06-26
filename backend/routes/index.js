const express = require('express');
const router = express.Router();
const logger = require('@grokker/logger');
const auth = require('../middlewares/auth');
const { verifyUser, signup, logout } = require('../models/index');

router.post('/login', async (req, res) => {
    try{
        if(!req.body.usernameOrEmail || !req.body.password){
            return res.publish(false, 'Malformed body', { message: `Required parameter username or password was not provided` }, 400);
        }
        const usernameOrEmail = req.body.usernameOrEmail;
        const password = req.body.password;
        const token = await verifyUser(usernameOrEmail, password);
        return res.publish(true, 'Success', { token: `Bearer ${token}` }, 201, { name: 'XID', value: token });
    }catch (e) {
        return res.publish(false, 'Failed', { message: 'Unauthorized !!'}, 401);
    }
});

router.post('/signup', async (req, res) => {
    try{
        const requestBody = req.body;
        if(!requestBody.username || !requestBody.email || !requestBody.password){
            return res.publish(false, 'Malformed body', { message: `Required parameter username, email or password was not provided` }, 400);
        }
        const token = await signup({ username: requestBody.username, email: requestBody.email, password: requestBody.password });
        return res.publish(true, 'Success', { token: `Bearer ${token}` });
    }catch (e) {
        return res.publish(false, 'Failed', { message: e.message }, e.statusCode());
    }
});

router.post('/logout', auth, async (req, res) => {
   try{
       await logout(req.sessionId);
       res.clearCookie('XID');
       return res.publish(true, 'Success', { message: 'You have logged out successfully' });
   } catch (e) {
       logger.error(`Failed to logout user ${req.user} -`, e);
       return res.publish(false, 'Failed', { message: 'Failed to logout' }, 500);
   }
});

router.get('/verify-auth', auth, async (req, res) => {
    return res.publish(true, 'Success', { message: 'auth working' });
})

module.exports = router;
