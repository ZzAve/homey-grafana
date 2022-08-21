import {convertRangeToResolution} from "./RangeConverter";
import {APPLICABLE_FUNCTION_FACTORIES, QueryableFunction, QueryableFunctionFactory} from "./functions/Functions";

import Debug from "debug";

import * as NodeCache from "node-cache";

import {AthomApi} from "homey";
import type { Homey, InsightsLog, LogEntries} from "homey";


const debug = Debug("homey-grafana:homey-service");
const metricNameCache: NodeCache = new NodeCache({stdTTL: 180});

const fetchHomey: () => Promise<Homey> = async () => {
    console.log("Initializing homey")
    // Initialize API.
    await AthomApi._initApi();

    // Get active Homey.
    return (await AthomApi.getActiveHomey()) as Homey;
};

let _homey: Homey | undefined = undefined;

export const getHomey = async () => {
    if (_homey === undefined) {
        _homey = await fetchHomey()
    }

    return _homey
};

const getEnrichedMetrics = (metric: any) => ({
    originalTarget: composeReadableMetricName(metric),
    deviceName: metric.uriObj.name,
    id: metric.id,
    uri: metric.uri
});

const fetchAllMetrics = async () => {
    console.log("Fetching all metrics");
    const homey = await getHomey();
    const metrics: InsightsLog[] = await homey.insights.getLogs();
    const enrichedMetrics = metrics
        .filter(it => it.type !== "boolean")
        .map(getEnrichedMetrics);

    console.log("All metrics: #", enrichedMetrics.length)
    debug(enrichedMetrics.map(it => it.originalTarget))
    debug("---")
    return enrichedMetrics
};

const KEY = "METRICS_NAME_CACHE_KEY"

const getAllMetrics = async () => {
    let result = metricNameCache.get<{metrics:any}>(KEY)
    if (result === undefined) {
        result = {metrics: await fetchAllMetrics()};
        metricNameCache.set(KEY, result)
    }

    // const allMetrics = ["upper_25", "upper_50", "upper_75", "upper_90", "upper_95"];
    return result.metrics;
};


const getLogEntries: (metric: any) => Promise<LogEntries> = async (metric: any) => {
    const homey = await getHomey();
    return await homey.insights.getLogEntries({
        uri: metric.uri,
        id: metric.id,
        resolution: metric.resolution
    })
};

const composeReadableMetricName = (metric: any) => `${metric.uriObj.name}~${metric.id}~${metric.uri}`;

const getMetricFilter = (query: any) => {
    try {
        const flags = ""
        const pattern = query.replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
        return (metric: any) => metric.originalTarget.match(new RegExp(pattern, flags)) !== null
    } catch (e) {
        return false
    }
};

export const searchMetrics = async (query: any, opts?: any) => {
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


const getMetricsForTarget = async (targetMetrics: any, resolution: any) => {
    debug("target: ", JSON.stringify(targetMetrics));
    const metrics = Promise.all(targetMetrics.map(async (metric: any) => {
        console.log("Fetching metric for ", JSON.stringify(metric));
        try {
            const logEntries = await getLogEntries(
                {
                    uri: metric.uri,
                    id: metric.id,
                    resolution: resolution
                }
            );
            const dataPoints = logEntries.values.map((dp: any) => ([dp.v, new Date(dp.t).getTime()]));
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
 * @param range - time window to resolve for
 * @returns {Promise<*>}
 */
const resolveSingleTarget: (query: any, target: any, range: any) => Promise<any> = async (query: any, target: any, range: any) => {
    const applicableFunction = APPLICABLE_FUNCTION_FACTORIES.find((it: QueryableFunctionFactory) => it.hasMatchingSyntax(query));
    if (!!applicableFunction) {
        const instance = applicableFunction.of(query, target, range);
        return await instance.apply(resolveSingleTarget.bind(this))
    } else {
        return await metricStatement(query, target, range)
    }
}

const metricStatement = async (query: any, target: any, range: any) => {
    const metrics = await searchMetrics(query, {strict: true});

    const resolution = convertRangeToResolution(range);
    const metricsResult = await getMetricsForTarget(metrics, resolution);


    const rangeFrom = new Date(range.from).getTime();
    const rangeTo = new Date(range.to).getTime();
    return metricsResult.map(entry => ({
            target: entry.target,
            datapoints: entry.datapoints.filter((v:any) => v[1] >= rangeFrom - entry.step && v[1] <= rangeTo + entry.step),
            step: entry.step

        })
    )
};

export const queryMetrics = async (body: any) => {
    let queryTargets = body.targets;
    console.log(`Querying for targets ${JSON.stringify(queryTargets)}`);

    const series = await Promise.all(queryTargets.map(async (target: any) => {
        const query = target.target
        return await resolveSingleTarget(query, target, body.range);
    }));

    return series.flat()
};
