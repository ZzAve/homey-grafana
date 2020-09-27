# homey-grafana

A nodejs bridge to view Homey's insights logs in Grafana, without any additional data storage required

# Quickstart 
The integration with grafana is based on the [Simple JSON plugin](https://grafana.com/grafana/plugins/grafana-simple-json-datasource).
This can be found in the plugin section of your Grafana instance

Start the api that integrates with Homey:
```bash
$ node app.js
```

The first time the athom-cli dependency requires you to log in:

```bash
✓ Logging in...
To log in with your Athom Account, please visit https://cli.athom.com?port=XXXX&clientId=<someHexadecimalNumbersBasedId>
? Paste the code: 
```

Follow the instructions, and you'll be good to go. Per default port 8080 is used and you can start creating your first dasbhoard

(example dashboard you can import is coming ....) 

## With docker 
Run homey-grafana, both the API and grafana (with necessary plugins):

Ensure the nodejs app can use the .athom-cli credentials 
```bash
$ cp ~/.athom-cli/settings.json . # hack to include athom-cli credentials to docker container
```
```bash
$ make build
$ docker-compose up
```

Navigate to `http://localhost:3000` to view grafana and start setting it up

To run without grafana:

```bash
$ make build
$ make run
```

The api is available on port `8080`


# The plugin

[Simple JSON datasource plugin documentation](https://grafana.com/grafana/plugins/grafana-simple-json-datasource/)


