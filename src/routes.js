const express = require('express')

const router = express.Router()
const { miio } = require('./controllers')

router.get('/miio/status', miio.status);
router.get('/miio/cloud', miio.cloud);
router.get('/miio/:deviceId', miio.device);
router.get('/miio/:deviceId/:command', miio.command);
router.get('/miio/:deviceId/:command/:attribute', miio.command);
router.get('/test', async (req, res, next) => {   
    res.json({
        result: 'ok'
    });
});

module.exports = router
