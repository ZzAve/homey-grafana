const {AthomApi} = require('athom-cli');

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
    console.log(metrics)
    let enrichedMetrics = metrics.map(getEnrichedMetrics);
    return enrichedMetrics
}

async function getAllMetrics() {
    if (_metrics === undefined) {
        _metrics = fetchAllMetrics();
    }

    // const allMetrics = ["upper_25", "upper_50", "upper_75", "upper_90", "upper_95"];
    return await _metrics;
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

const composeReadableMetricName = (metric) => `${metric.uriObj.name}|${metric.id}|${metric.uri}`;
const decomposeReadableMetricName = (readableMetric) => {
    let metricParts = readableMetric.target.split("|");
    return ({
        originalTarget: readableMetric,
        deviceName: metricParts[0],
        id: metricParts[1],
        uri: metricParts[2]
    });
};

const getMetricFilter = (query) => {
    let filter;
    if (query.target.startsWith("/")) {
        //handle as regex
        filter = metric => metric.originalTarget.match(query.target) !== null
    } else {
        //handle as string
        filter = metric => metric.originalTarget.includes(query.target);
    }
    return filter;
};

const searchMetrics = async (query, opts) => {
    console.log(`in searchMetrics for query : ${JSON.stringify(query)}, ${JSON.stringify(opts)}`);
    const allMetrics = await getAllMetrics();
    if (!query || !query.target || 0 === query.target.length) {
        return allMetrics
    }

    let filter = getMetricFilter(query);
    return allMetrics.filter(filter);
};
const convertRangeToResolution = (range) => {
    console.log("range: ", JSON.stringify(range))

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
    console.log("diffInHours ", diffInHours)
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
const getMetricsForTarget = async (target, range) => {
    const resolution = convertRangeToResolution(range);
    console.log("Resolution picked: ", resolution);

    // console.log("target: " , JSON.stringify(target));
    const metrics = Promise.all(target.metrics.map(async metric => {
        console.log("Fetching metric for ", JSON.stringify(metric));
        const logEntries = await getLogEntries(
            {
                uri: metric.uri,
                id: metric.id,
                resolution: resolution
            }
        );
        const dataPoints = logEntries.values.map(dp => ([dp.v, new Date(dp.t).getTime()]));
        return {
            target: `${metric.deviceName}|${metric.id}`,
            datapoints: dataPoints
        }
    }));

    // console.log(JSON.stringify(await metrics));
    return (await metrics)
};

const fetchMetrics = async (targets, range) => {
    return Promise.all(targets.map(async target => {
        return await getMetricsForTarget(target, range)
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
