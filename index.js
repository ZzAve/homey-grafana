const {AthomApi} = require('homey');
const Debug = require('debug')
const NodeCache = require("node-cache");

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


async function getDevices() {
    const homey = await getHomey();

    // Example: list all devices.
    let devices = {};
    try {
        devices = await homey.devices.getDevices();
    } catch (e) {
        console.log(e);
    }
    return Object.values(devices).map((value) => value.name)

    // Example: trigger a flow.
    // const flow = await homey.flow.getFlow({ id : FLOW_ID });
    // await homey.flow.testFlow({ flow, tokens : [] });
}

let _metrics = undefined;

const getEnrichedMetrics = (metric) => {
    return ({
        originalTarget: composeReadableMetricName(metric),
        deviceName: metric.uriObj.name,
        id: metric.id,
        uri: metric.uri
    });
};

async function fetchAllMetrics() {
    console.log("Getting all metrics");
    const homey = await getHomey();
    let metrics = await homey.insights.getLogs();
    let enrichedMetrics = metrics
        .filter(it => it.type !== "boolean")
        .map(getEnrichedMetrics);

    debug("All metrics:")
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

const DEFAULT_RESOLUTION = "last6Hours";

async function getLogEntries(metric) {
    const homey = await getHomey();
    const logEntries = await homey.insights.getLogEntries({
        uri: metric.uri,
        id: metric.id,
        resolution: metric.resolution
    });
    // console.log(logEntries);
    return logEntries
}

const composeReadableMetricName = (metric) => `${metric.uriObj.name}~${metric.id}~${metric.uri}`;
const decomposeReadableMetricName = (readableMetric) => {
    let metricParts = readableMetric.target.split("~");
    return ({
        originalTarget: readableMetric,
        deviceName: metricParts[0],
        id: metricParts[1],
        uri: metricParts[2]
    });
};

const getMetricFilter = (query) => {
    try {
        const flags = ""
        const pattern = query.target.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
        console.log("flags: ", flags)
        console.log("pattern: ", pattern)
        return metric => metric.originalTarget.match(new RegExp(pattern, flags)) !== null
    } catch (e) {
        return false
    }
};

const searchMetrics = async (query, opts) => {
    console.log(`SearchMetrics for query: ${JSON.stringify(query)}, opts: ${JSON.stringify(opts || {})}`);
    const allMetrics = await getAllMetrics();
    if (!query || !query.target || 0 === query.target.length) {
        return allMetrics
    }

    try {
        let filter = getMetricFilter(query);
        return allMetrics.filter(filter);
    } catch (e) {
        return []
    }
};
const convertRangeToResolution = (range) => {
    debug("range: ", JSON.stringify(range))

    // const rangeToResolutionMap = (
    //     "lastHour" | "lastHourLowRes" | "last6Hours" | "last6HoursLowRes" | "last24Hours" | "last3Days" |
    //     "last7Days" | "last14Days" | "last31Days" | "last3Months" | "last6Months" | "last2Years" |
    //     "today" | "thisWeek" | "thisMonth" | "thisYear" | "yesterday" | "lastWeek" | "lastMonth" | "lastYear"
    // )

    const from = new Date(range.from)
    // const to = new Date(range.to)
    const now = new Date()

    const RESOLUTION_BUFFER = 1.1
    // difference in hours
    const diffInHours = (now - from) / (1000.0 * 60 * 60)
    debug("diffInHours ", diffInHours)
    if (diffInHours <= 1 * RESOLUTION_BUFFER) return "lastHour";
    if (diffInHours <= 6 * RESOLUTION_BUFFER) return "last6Hours"
    if (diffInHours <= 24 * RESOLUTION_BUFFER) return "last24Hours"
    if (diffInHours <= 72 * RESOLUTION_BUFFER) return "last3Days"

    const diffInDays = diffInHours / 24.0
    if (diffInDays <= 7 * RESOLUTION_BUFFER) return "last7Days"
    if (diffInDays <= 14 * RESOLUTION_BUFFER) return "last14Days"
    if (diffInDays <= 31 * RESOLUTION_BUFFER) return "last31Days"


    const diffInMonths = diffInDays / (365.25 / 12.0)
    if (diffInMonths <= 3 * RESOLUTION_BUFFER) return "last3Months"
    if (diffInMonths <= 6 * RESOLUTION_BUFFER) return "last6Months"
    if (diffInMonths <= 24 * RESOLUTION_BUFFER) return "last2Years"

    console.error("Weird resolution requested: ", JSON.stringify(range))
    return DEFAULT_RESOLUTION
}
const getMetricsForTarget = async (target, resolution) => {
    debug("target: ", JSON.stringify(target));
    const metrics = Promise.all(target.metrics.map(async metric => {
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
                datapoints: dataPoints
            }
        } catch (e) {
            console.warn(`Issue resolving log entries for metric: ${JSON.stringify(metric)} resolution: ${resolution}`, e)
            return {
                target: `${metric.deviceName}~${metric.id}`,
                datapoints: []
            }
        }
    }));

    // console.log(JSON.stringify(await metrics));
    return (await metrics)
};

const fetchMetrics = async (targets, range) => {
    const resolution = convertRangeToResolution(range);
    debug("Resolution picked: ", resolution);
    return Promise.all(targets.map(async target => {
        return await getMetricsForTarget(target, resolution)
    }));
};

const enrichTargetsWithMetrics = (queryTargets) => {
    // console.log(queryTargets);
    return Promise.all(queryTargets.map(async target => {
        const metrics = await searchMetrics(target, {strict: true});
        // console.log("metrics: ", JSON.stringify(metrics));
        return {
            ...target,
            metrics
        };
    }));
};

const queryMetrics = async (body) => {
    let queryTargets = body.targets;
    // console.log(body);
    console.log(`Querying for targets ${JSON.stringify(queryTargets)}`);
    const queryMetrics = await enrichTargetsWithMetrics(queryTargets);
    // console.log(`Querying for metrics ${JSON.stringify(queryMetrics)}`);
    // const targets = queryTargets.map(decomposeReadableMetricName);
    const series = await fetchMetrics(queryMetrics, body.range);
    // console.log(series);

    return series.flat()
};

module.exports = {
    getHomey,
    getDevices,
    searchMetrics,
    queryMetrics
};
