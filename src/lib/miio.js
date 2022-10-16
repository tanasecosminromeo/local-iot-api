const FsCache = require( "file-system-cache" ).default;
const cache = FsCache({ basePath: "./.cache", ns: "miio-lib" });
const { execSync } = require("child_process")
const ping = require('ping');
const fs = require('fs');

const miioLib = {
    status: async (useCacheIfAvailable = true) => {
        let devices = await miioLib.devices(useCacheIfAvailable);

        for (let i = 0; i < devices.length; i++) {
            let pingResult = await ping.promise.probe(devices[i].ip, { timeout: 5 });

            devices[i].online = pingResult.alive; //We overwrite the online status from cache with the ping result
        }

        return devices;
    },
    command: async (device, command, params = []) => {
        const integration = await miioLib.getIntegrationFromModel(device.model);

        if (integration === null) {
            return {
                error: `No integration found for this device model (${device.model}) please update integration.json`
            }
        }
        let result = null;

        try {
            const raw = await execSync(`miiocli -ojson ${integration} --ip ${device.ip} --model ${device.model} --token ${device.token} ${command} ${params.length > 0 ? params.join(' ') : ''}`).toString();

            try {
                result = JSON.parse(raw);
            } catch (e) {
                result = {
                    error: raw.trim()
                };
            }
        } catch (e) {
            let errorsRaw = e.message.split("\n"),
                errors = { message: null, usage: null };

            errorsRaw.forEach((error) => {
                if (error.indexOf("Usage: ") === 0) {
                    errors.usage = error.replace("Usage: ", "");
                    return;
                }

                if (error.indexOf('Error: ') === 0) {
                    errors.message = error.replace("Error: ", "");
                    return;
                }
            });

            if (errors.message === null || errors.usage === null) {
                errors.raw = e.message;
            }

            if (errors.message === null){
                errors.message = "Unknown error";
            }

            result = {
                error: errors
            }
        }

        return result;
    },
    getIntegrationFromModel: (model) => {
        const integrationsAndModels = JSON.parse(fs.readFileSync('integrations.json', 'utf8')),
            integrations = Object.keys(integrationsAndModels),
            models = Object.values(integrationsAndModels);

        for (let i = 0; i < models.length; i++) {
            if (models[i].indexOf(model) !== -1) {
                return integrations[i];
            }
        }

        return null;
    },
    usableCommands: async (model) => {
        let integration = miioLib.getIntegrationFromModel(model);

        if (integration === null) {
            return null;
        }

        const raw = await execSync(`miiocli ${integration}`).toString().split("Commands:")[1].trim().split("\n");

        let result = [];
        for (let command of raw) {
            command = command.trim();

            let splitAt = command.indexOf(" "),
                commandName = command.substr(0, splitAt),
                commandDescription = command.substr(splitAt + 1).trim();

            result.push({
                name: commandName,
                description: commandDescription
            });
        }

        return result;
    },
    device: async (deviceId) => {
        return (await miioLib.devices()).find(device => device.id === deviceId);
    },
    devices: async (useCacheIfAvailable = true) => { // Get a filtered list of devices
        const integrations = Object.values(JSON.parse(fs.readFileSync('integrations.json', 'utf8')));
        let knownDeviceModels = [];
        for (integration of integrations) {
            knownDeviceModels = knownDeviceModels.concat(integration);
        }

        return (await miioLib.cloud(useCacheIfAvailable)).filter(device => {
            for (let knownDeviceModel of knownDeviceModels) {
                if (device.model === knownDeviceModel) {
                    return true;
                }
            }

            return false;
        });
    },
    cloud: async (useCacheIfAvailable = true) => {
        let result = await cache.get("miio.cloud", null);

        if (result !== null && useCacheIfAvailable) {
            return result;
        }

        let raw = await cache.get("miio.cloud.raw", null);
        if (raw === null || !useCacheIfAvailable) {
            require('dotenv').config();
            const username = process.env.MI_CLOUD_USERNAME;
            const password = process.env.MI_CLOUD_PASSWORD;

            raw = await execSync(`miiocli cloud --username ${username} --password ${password}`).toString();
            cache.set("miio.cloud.raw", raw);
        }

        raw = raw.split("\n");

        result = [];
        let tempObj = {};
        for (let i = 0; i < raw.length; i++) {
            let line = raw[i];
            if (line.startsWith("== ")) {
                if (Object.keys(tempObj).length > 0) {
                    result.push(tempObj);
                }

                let name = line.replace("== ", "").replace(" ==", "").split(" (")[0].trim(),
                    online = line.indexOf("Device online") > -1;

                tempObj = {
                    id: name.replace(new RegExp(' ', 'g'), '_').replace(new RegExp('-', 'g'), '_').toLowerCase(),
                    name: name,
                    online: online,
                };
            } else if (line.startsWith("\tModel: ")) {
                tempObj.model = line.replace("\tModel: ", "").trim();
            } else if (line.startsWith("\tToken: ")) {
                tempObj.token = line.replace("\tToken: ", "").trim();
            } else if (line.startsWith("\tIP: ")) {
                tempObj.ip = line.replace("\tIP: ", "").split('(mac: ')[0].trim();
                tempObj.mac = line.replace("\tIP: ", "").split('(mac: ')[1].replace(')', '').trim();
            } else if (line.startsWith("\tDID: ")) {
                tempObj.did = line.replace("\tDID: ", "").trim();
            } else if (line.startsWith("\tLocale: ")) {
                tempObj.locale = line.replace("\tLocale: ", "").trim();
            }
        };

        if (Object.keys(tempObj).length > 0) {
            result.push(tempObj);
        }

        cache.set("miio.cloud", result);

        return result;
    }
}

module.exports = { miioLib };