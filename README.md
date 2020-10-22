# homey-grafana

A nodejs bridge to view Homey's insights logs in Grafana, without any additional data storage required

# Quickstart 
The integration with grafana is based on the [Simple JSON plugin](https://grafana.com/grafana/plugins/grafana-simple-json-datasource).
This can be found in the plugin section of your Grafana instance

Start the api that integrates with Homey:
```bash
$ npm ci
$ homey login # to allow the homey dependency to access your homey
$ node app.js
```

Follow the instructions, and you'll be good to go. Per default port 8080 is used and you can start creating your first dasbhoard

An example dashboard can be found in [example_dashboard.json](example_dashboard.json) 

## With docker 
Run homey-grafana, both the API and grafana (with necessary plugins):

Ensure the nodejs app can use the .athom-cli credentials 

```bash
$ cp ~/.athom-cli/settings.json ./settings 
```

```bash 
$ make build
$ make run-all
```

Navigate to `http://localhost:3000` to view grafana and start setting it up

To run without grafana, and use docker command directly:

```bash
$ docker build -t zzave/homey-grafana:latest .
$ docker run --rm -d \
        --name homey-grafana \
        -v ${PWD}/settings:/root/.athom-cli \
        -p8080:8080 \
        zzave/homey-grafana:latest
```

The api is available on port `8080`


# The plugin

[Simple JSON datasource plugin documentation](https://grafana.com/grafana/plugins/grafana-simple-json-datasource/)


