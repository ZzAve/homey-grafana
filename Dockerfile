FROM node:15-alpine as builder

# Create app directory
WORKDIR /usr/src/app

## Install build toolchain, install node deps and compile native add-ons
RUN apk add --no-cache --virtual .gyp python make g++

# Install app dependencies
COPY package*.json ./
RUN npm ci --only-production && apk del .gyp

##################
FROM node:15-alpine

# Create app directory
WORKDIR /usr/src/app

## Copy built node modules and binaries without including the toolchain
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Bundle app source
COPY . .

EXPOSE 8080

ENV DEBUG_COLORS=true
ENV NODE_ENV=production

#RUN mkdir -p /home/node/.athom-cli && chown -R node:node /home/node/.athom-cli
#USER node

ENTRYPOINT ["/bin/sh", "entrypoint.sh"]
CMD [ "node", "app.js" ]
