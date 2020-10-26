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
        let filter = getMetricFilter(query);
        return allMetrics.filter(filter);
    } catch (e) {
        return []
    }
};

const DEFAULT_RESOLUTION = "last6Hours";

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
const resolveSingleTarget = async (query, target, resolution) => {
    const applicableFunction = AVAILABLE_FUNCTIONS.find(it => it.hasMatchingSyntax(query));
    if (!!applicableFunction) {
        const instance = applicableFunction.of(query, target, resolution);
        return await instance.apply(resolveSingleTarget.bind(this))
    } else {
        return await metricStatement(query, target, resolution)
    }
}

const metricStatement = async (query, target, resolution) => {
    const metrics = await searchMetrics(query, {strict: true});
    return await getMetricsForTarget(metrics, resolution)
};


const queryMetrics = async (body) => {
    let queryTargets = body.targets;
    console.log(`Querying for targets ${JSON.stringify(queryTargets)}`);

    const resolution = convertRangeToResolution(body.range);
    debug("Resolution picked: ", resolution);

    const series = await Promise.all(queryTargets.map(async target => {
        const query = target.target
        return await resolveSingleTarget(query, target, resolution);
    }));

    return series.flat()
};

module.exports = {
    getHomey,
    searchMetrics,
    queryMetrics
};
