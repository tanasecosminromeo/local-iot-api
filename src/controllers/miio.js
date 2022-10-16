const { miioLib } = require('../lib/miio');

const miio = {
    status: async (req, res, next) => {   
        let devices = await miioLib.status(req.query.nocache !== "yes"),
            online = devices.filter(device => device.online === true).length,
            offline = devices.filter(device => device.online === false).length;

        res.json({
            online: online,
            offline: offline,
            total: devices.length,
            devices: devices,
        });
    },
    cloud: async (req, res, next) => {
        res.json(await miioLib.cloud(req.query.nocache !== "yes"));
    },
    device: async (req, res, next) => {
        let device = await miioLib.device(req.params.deviceId);

        if (device === null) {
            res.json({
                result: 'error',
                message: 'Device not found'
            });

            return;
        }

        res.json({
            result: 'ok',
            device: device,
            usableCommands: await miioLib.usableCommands(device.model)
        });
    },
    command: async (req, res, next) => {
        let device = await miioLib.device(req.params.deviceId);

        if (device === null) {
            res.json({
                result: 'error',
                message: 'Device not found'
            });

            return;
        }

        let result = await miioLib.command(
                device,  
                req.params.command, 
                req.params.attribute ? [req.params.attribute] : []
            );

        res.json({
            command: req.params.command,
            attribute: req.params.attribute,
            result: result
        });
    }

}

module.exports = { miio };