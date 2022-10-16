# local-iot-api

This is a simple Node JS API that calls [miiocli](https://python-miio.readthedocs.io/en/latest/) to get the cloud devices and then allows you to send any available command.

*future development: add support for [localtuya](https://github.com/rospogrigio/localtuya)*

## How to start the project
- Copy .env.dist to .env
- Amend the necessary .env variables *(See Environment Setup)*
- Run `docker-compose up` or `docker build . -t local-iot-api && docker run -it -p 3000 -v ./integrations.json:/home/app/integrations.json local-iot-api`
- Run `curl http://localhost:3000/miio/cloud -H 'Authorization:secureToken1'` to view a list of all of your devices
- Amend **integrations.json** to include all the devices you want to discover


## Environment Setup
- **MI_CLOUD_USERNAME**=*YourMiCloudUsername* - This is required to get the list of your devices with ip/model & most importantly token. We could use **miiocli** to get the device list, but for the token we need the cloud *(just initially)*
- **MI_CLOUD_PASSWORD**=*YourMiCloudPassword*
- **NODE_ENV**=*production|development* - Can be development or production if you use docker-compose like explained in the *Notes* these are overwritten. Production runs `yarn run prod` - check the **entrypoint.sh** and **package.json** for more info
- **TOKENS**=*secureToken1,secureToken2* - This one is a comma separate values of authorised keys. When you do a curl you need to use one of these in the **Authorization**. This is neither the most secure way to secure an API *(as these tokens are fixed and if someone finds it out => they get control of your devices)* nor the most beautiful, but it works and as long as you keep your tokens save it's secure. You could remove this env variable and the node app will just not require an Authorization header, but **if you remove the TOKENS please make sure your API is not publicly available**
- **APP_CORS**=*\** - If you leave this one as is or you remove it basically it sets **Access-Control-Allow-Origin: \*** if you change it, it's gonna use that. If you don't know what it means, [read more about cors here](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- **TZ**=*Europe/Bucharest* - Use the appropriate, valid one for you. Check [TZ database here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- **HOST_UID**=*1000* - If you use dev mode, you MAY run into user permissions errors, **entrypoint.sh** is here to help, set the **HOST_UID** to the value you get when you run `id -u` on your host machine
- **HOST_GID**=*1000* - Same as above, use `id -g` on your host machine to get the group id for your current user


## Type of calls
### `GET /miio/status` 
Status of all of your devices *(with supported integrations in `integrations.json`)* in JSON format
```
{
    "online": 5,
    "offline": 0,
    "total": 5,
    "devices": [
        {
            "id": "livingroom_air_purifier",
            "name": "Livingroom Air Purifier",
            "online": true,
            "model": "zhimi.airpurifier.mb3",
            "token": "XXX",
            "ip": "XXX",
            "mac": "XXX",
            "did": "XXX",
            "locale": "de"
        }, ...
    ]
}
```
The **id** is automatically generated from the name to be lowercase and with underscores instead of names - now I think you could have issues if you use non alpha numeric names, if so check `./src/lib/miio.js:cloud` and amend the line `id: name.replace(new RegExp(' ', 'g'), '_').replace(new RegExp('-', 'g'), '_').toLowerCase(),`

The above is basically the result of `GET /miio/cloud` but it also does a **PING** on each IP to update the cached result online status, so if the command is pretty slow for your taste, it's your network/some of your devices in **integrations.json** are offline.

### `GET /miio/cloud`
Status of all of your devices *(same values as JSON_ABOVE.devices)* regardless if they are or aren't in `integrations.json`. Do note this is a cached result with `TTL 0` so use `GET /miio/cloud?nocache=yes` should you want an updated list - also note your devices need internet access the 1st time you call either of these / if you use `?nocache=yes`
**IMPORTANT:** These results are fully cached, including the online status. For accurate online status either use **?nocache=yes** or call **GET /miio/status** that also does a PING on each device

### `GET /miio/:deviceId`
This gets the status of your device *(online is overwritten by doing a ping, so this status always reflects the actual state of your device)* and all of the available commands for that device. This is very cool as the available commands are the one from **miiocli** if you update miiocli and it has new commands, the api will have new/updated commands too. It's useful to see what it is actually available for this particular model of device and could also be used in a HA integration to automatically add all capabilities of a device
**eg: GET /miio/livingroom_air_purifier**
```
{
    "result": "ok",
    "device": {
        "id": "livingroom_air_purifier",
        "name": "Livingroom Air Purifier",
        "online": true,
        "model": "zhimi.airpurifier.mb3",
        "token": "XXX",
        "ip": "XXX",
        "mac": "XXX",
        "did": "XXX",
        "locale": "de"
    },
    "usableCommands": [
        ...
        {
            "name": "status",
            "description": "Retrieve properties."
        },...
    ]
}
```
Do note that you do not need to call */miio/cloud* or */miio/devices* before calling a device function, but the API will get it's required information from the cloud/cache before executing the command *(as it needs the device model, ip and token)* which does mean that in case you plan to kill the internet to these devices the production environment will need `/home/app/.cache` mounted to a persistent volume *(like it is in docker-compose.dev.yml)* so that the API will know your devices params. This also need to happen if you do not have reserved ip addresses in your DHCP server and your devices would change IPs.

### `GET /miio/:deviceId/:commandName` and `GET /miio/:deviceId/:commandName/:attribute`
This runs the command. Here are a few examples
**GET /miio/livingroom_air_purifier/status**
```
{
    "command": "status",
    "result": {
        "power": true,
        "fan_level": 1,
        "mode": 3,
        "humidity": 42,
        "temperature": 19,
        "aqi": 10,
        "filter_life_remaining": 73,
        "filter_hours_used": 935,
        "buzzer": false,
        "buzzer_volume": null,
        "led_brightness": 0,
        "led": true,
        "child_lock": false,
        "favorite_level": 4,
        "favorite_rpm": 1250,
        "motor_speed": 773,
        "use_time": 53531700,
        "purify_volume": 1395644,
        "average_aqi": 5,
        "aqi_realtime_update_duration": 5,
        "filter_rfid_tag": "81:72:eb:8a:ab:84:4",
        "filter_rfid_product_id": "0:0:41:30",
        "app_extra": 0
    }
```
**GET /miio/livingroom_air_purifier/set_favorite_rpm/2500**
```
{
    "command": "set_favorite_rpm",
    "attribute": "2500",
    "result": {
        "error": "Error: Invalid favorite motor speed: 2500. Must be between 300 and 2300 and divisible by 10"
    }
}
```
**GET /miio/livingroom_air_purifier/set_favorite_rpm2**
```
{
    "command": "set_favorite_rpm2",
    "result": {
        "error": {
            "message": "Unknown command (set_favorite_rpm2)",
            "usage": "miiocli airpurifiermiot [OPTIONS] COMMAND [ARGS]..."
        }
    }
}
```
As you can see we also get errors in a nice format
**GET /miio/livingroom_air_purifier/set_favorite_rpm/2100**
```
{
    "command": "set_favorite_rpm",
    "attribute": "2100",
    "result": [
        {
            "did": "favorite_rpm",
            "siid": 10,
            "piid": 7,
            "code": 0
        }
    ]
}
```
And it also works. If you use this with an app/ha integration you can check it was succesfull if `result.error` is not defined *or go even bigger an see what it did and the code*.

## Why another wrapper/api/integration?
Tl;dr => Expose an API for MIIO Devices and block IoT devices access to the internet.

I've started working on this as I do not like ANY miio integration for home assistant. The official one works well for Xiaomi Air Purifier 3H, but only allows me to turn on/off my 2 3Cs. It also doesn't work at all with my Humidifier *zhimi.airpurifier.mb3* 

I've looked around and https://github.com/syssi/xiaomi_airpurifier works quite well *(I think there's a spelling mistake in zhimi.airpurifier.mb4 - it's logged as .ma4 - but changing it to mb4 worked well)* but I want my devices to be on a separate VLAN so that they cannot access my actual devices, but since my Deco doesn't allow me to set custom rules *(such as allowing my device that has HA to access all devices)* I pretty much cannot use this integration. 

I've tried a lot of other integrations and they were both crappy *(didn't show all the information/a lot of non translated chinese text)* and neither allowed me to block internet access.

So I have created this API, which is pretty much miiocli in an API format and I am using it on a Raspberry PI that connects to my Guest VLAN where my IoT devices exist. How I configure my setup:
- I allow Guest VLAN to access the internet
- I call `curl http://localhost:3000/miio/cloud?nocache=yes -H 'Authorization:dev:4phPptRUdYte2pBjVfHSbqG78HkSWXh4'`
- I block Guest VLAN access to internet **(make sure to not call that thing again with *?nocache=yes* afterwards)
- The Rpi is also connected via ethernet and I have my routing setup so **wlan0** can not access **eth0** but **eth0** *(and as a consequence the docker bridged it's linked to it)* can access **wlan0**
- I currently use some rest sensors in Home Assistant, but will make an integration soon *(I'll put a link here once is ready)*

## Development plan
- Create a HA integration that uses this API
- Add localtuya support
- Create a multi stage Dockerfile so the resulting image would be smaller
- Make the package public on npm so it can be used without docker
- Make image public on docker hub so people don't have to build it
- Add tests :laughing: and better documentation of endpoints using swagger

## Notes
There is no need to use docker-compose, I prefer it because it allows me to use two aliases `alias dc=docker-compose` and `alias dcdev=docker-compose -f docker-compose.dev.yml` and if you check the **docker-compose.yml** file it overwrites my **NODE_ENV** to make sure it's set to production and **docker-compose.dev.yml** mounts the current directory so I can easily update the project. Do you have to use this? No.. might as well do aliases to the docker command itself, but for me this setup works best with my workflow.

## Final words
This works well for me, I hope it will help others too but keep in mind this was a sunday project so may need some work.

It is appaling how a company like Xiaomi *kind of* allowed actually controling the devices you own in any way you want while TP Link Deco does not... looking forward to a new router setup, I would say Deco is good for parents/non techy people, but it's too bloody expensive for them too.. so.. BAD TP Link!!!