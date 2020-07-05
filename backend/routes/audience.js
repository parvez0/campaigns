const router = require('express').Router();
const auth = require('../middlewares/auth');
const { search } = require('../models/audienceData');

router.get('/list', auth, async (req, res) => {
    try{
        const data = await search(req.userId);
        return res.publish(true, 'Success', data);
    } catch (e) {
        return res.publish(false, 'Failed', { message: e.message }, e.statusCode());
    }
});

module.exports = router;
