#!/bin/sh

usermod -u 2001 node
groupmod -g 2001 node

if [[ ! -z "$TZ" ]]; then
    echo "Setting timezone to ${TZ}"
    ln -fs /usr/share/zoneinfo/$TZ /etc/localtime
fi;

if [[ ! -z "$HOST_UID" && ! -z "$HOST_GID" ]]; then
    echo "Changing UID and GID to ${HOST_UID}:${HOST_GID}"
    usermod -u $HOST_UID app
    groupmod -g $HOST_GID app
    chown -R $HOST_UID:$HOST_GID /home/app
fi;

if [[ ! -d "node_modules" ]] ; then
    echo "Node modules not detected. Will run yarn"
    su -c 'yarn' app
fi;

if [[ "$NODE_ENV" == "development" ]]; then
    echo "Running in development mode - file changes will be watched"
    su -c 'yarn run dev' app
else
    echo "Running in production mode"
    su -c 'yarn run prod' app
fi;