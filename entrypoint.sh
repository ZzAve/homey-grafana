#!/bin/sh

#chown -R node:node /home/node/.athom-cli
#ls -la ~
mkdir -p ~/.athom-cli/
touch ~/.athom-cli/settings.json
exec "$@"