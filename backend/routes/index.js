const express = require('express');
const router = express.Router();
const path = require('path');

const multer = require('multer');
const auth = require('../middlewares/auth');
const { verifyUser, signup, logout, createFileUploadJobProfile } = require('../models/index');

const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '/../assets'));
    },
    filename: (req, file, cb) => {
        const originalFile = file.originalname && file.originalname.toLowerCase().replace(/ |\_|\-/ig, '') || `${req.userId}.csv`;
        const fileName = originalFile.split('.')[0];
        const extension = originalFile.split('.')[1];
        cb(null, fileName + '_' + Date.now() + '.' + extension);
    }
});

const uploadHandler = multer({ storage: multerStorage });

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
});

router.post('/file-upload', auth, uploadHandler.single('audienceFile'), async (req, res) => {
    try{
        await createFileUploadJobProfile(req.file, req.userId, req.user);
        res.publish(true, 'Success', { message: `File uploaded successfully, worker will be assigned shortly for pushing data to the database` }, 201);
    }catch (e) {
        res.publish(false, 'Failed', { message: `File uploaded successfully, but there was a problem while creating a worker please try again` }, 422);
    }
});

module.exports = router;
