const {convertRangeToResolution} = require("./RangeConverter");

const {AthomApi} = require('homey');
const Debug = require('debug')
const NodeCache = require("node-cache");
const {AVAILABLE_FUNCTIONS} = require("./functions/Functions");

const debug = Debug("homey-grafana:homey-service");
const metricNameCache = new NodeCache({stdTTL: 180});

async function fetchHomey() {
    console.log("Initializing homey")
    // Initialize API.
    await AthomApi._initApi();

    // Get active Homey.
    return await AthomApi.getActiveHomey();
}

let _homey = undefined;

async function getHomey() {
    if (_homey === undefined) {
        _homey = fetchHomey()
    }

    return await _homey
}

const getEnrichedMetrics = (metric) => ({
    originalTarget: composeReadableMetricName(metric),
    deviceName: metric.uriObj.name,
    id: metric.id,
    uri: metric.uri
});

async function fetchAllMetrics() {
    console.log("Fetching all metrics");
    const homey = await getHomey();
    const metrics = await homey.insights.getLogs();
    const enrichedMetrics = metrics
        .filter(it => it.type !== "boolean")
        .map(getEnrichedMetrics);

    console.log("All metrics: #", enrichedMetrics.length)
    debug(enrichedMetrics.map(it => it.originalTarget))
    debug("---")
    return enrichedMetrics
}

const KEY = "METRICS_NAME_CACHE_KEY"

async function getAllMetrics() {
    let result = metricNameCache.get(KEY)
    if (result === undefined) {
        result = {metrics: await fetchAllMetrics()};
        metricNameCache.set(KEY, result)
    }

    // const allMetrics = ["upper_25", "upper_50", "upper_75", "upper_90", "upper_95"];
    return result.metrics;
}


async function getLogEntries(metric) {
    const homey = await getHomey();
    return await homey.insights.getLogEntries({
        uri: metric.uri,
        id: metric.id,
        resolution: metric.resolution
    })
}

const composeReadableMetricName = (metric) => `${metric.uriObj.name}~${metric.id}~${metric.uri}`;

const getMetricFilter = (query) => {
    try {
        const flags = ""
        const pattern = query.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
        return metric => metric.originalTarget.match(new RegExp(pattern, flags)) !== null
    } catch (e) {
        return false
    }
};

const searchMetrics = async (query, opts) => {
    debug(`SearchMetrics for query: ${JSON.stringify(query)}, opts: ${JSON.stringify(opts || {})}`);
    const allMetrics = await getAllMetrics();
    if (!query || 0 === query.length) {
        return allMetrics
    }

    try {
        const filter = getMetricFilter(query);
        return allMetrics.filter(filter);
    } catch (e) {
        return []
    }
};


const getMetricsForTarget = async (targetMetrics, resolution) => {
    debug("target: ", JSON.stringify(targetMetrics));
    const metrics = Promise.all(targetMetrics.map(async metric => {
        console.log("Fetching metric for ", JSON.stringify(metric));
        try {
            const logEntries = await getLogEntries(
                {
                    uri: metric.uri,
                    id: metric.id,
                    resolution: resolution
                }
            );
            const dataPoints = logEntries.values.map(dp => ([dp.v, new Date(dp.t).getTime()]));
            return {
                target: `${metric.deviceName}~${metric.id}`,
                datapoints: dataPoints,
                step: logEntries.step
            }
        } catch (e) {
            console.warn(`Issue resolving log entries for metric: ${JSON.stringify(metric)} resolution: ${resolution}`, e)
            return {
                target: `${metric.deviceName}~${metric.id}`,
                datapoints: [],
                step: 0
            }
        }
    }));

    return await metrics
};

/**
 *   {
 *     "target":"aliasSub(measure_temperature, \"(Thermometer\\s+)(.*?)~.*\", \"$2\")",
 *     "refId":"A",
 *     "hide":false,
 *     "type":"timeserie"
 *   }
 *
 * @param query - 'target' value, expression, or subExpression
 * @param target - object of full target, raw request from client
 * @param resolution - time window to resolve for
 * @returns {Promise<*>}
 */
const resolveSingleTarget = async (query, target, range) => {
    const applicableFunction = AVAILABLE_FUNCTIONS.find(it => it.hasMatchingSyntax(query));
    if (!!applicableFunction) {
        const instance = applicableFunction.of(query, target, range);
        return await instance.apply(resolveSingleTarget.bind(this))
    } else {
        return await metricStatement(query, target, range)
    }
}

const metricStatement = async (query, target, range) => {
    const metrics = await searchMetrics(query, {strict: true});

    const resolution = convertRangeToResolution(range);
    debug("Resolution picked: ", resolution);

    const metricsResult = await getMetricsForTarget(metrics, resolution);


    const rangeFrom = new Date(range.from).getTime();
    const rangeTo = new Date(range.to).getTime();
    return metricsResult.map(entry => ({
            target: entry.target,
            datapoints: entry.datapoints.filter(v => v[1] >= rangeFrom - entry.step && v[1] <= rangeTo + entry.step),
            step: entry.step

        })
    )
};


const queryMetrics = async (body) => {
    let queryTargets = body.targets;
    console.log(`Querying for targets ${JSON.stringify(queryTargets)}`);

    const series = await Promise.all(queryTargets.map(async target => {
        const query = target.target
        return await resolveSingleTarget(query, target, body.range);
    }));

    return series.flat()
};

module.exports = {
    getHomey,
    searchMetrics,
    queryMetrics
};
