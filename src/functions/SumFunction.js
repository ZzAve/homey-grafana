const {QuerySyntaxError} = require("../QuerySyntaxError");
const Debug = require('debug')
const debug = Debug("homey-grafana:sumFunction");

const aliasRegex = new RegExp(/^sum\((.*)\)/)

/**
 * Sum function sums the response values from the resolved metric
 * Usecase: see sum of all devices with energy_measure, combine multiple meters for a single stat (energy (power) meters
 * for example
 *
 * example:
 *  sum(Energiemeter.*power.produced) will try and resolve all metrics containing 'Energiemeter.*power.produced' in them.
 *  The value at each timestamp will be added together for all found metrics and returns a single value.
 *
 */
class SumFunction {
    constructor(query, originalTarget, range, regexMatches) {
        this._query = query;

        this._originalTarget = originalTarget;
        this._subQuery = regexMatches[1]
        this._range = range
    }

    async apply(subQueryResolver) {
        debug(`Calling subQueryResolver for sum function for '${this._subQuery}'. range: ${JSON.stringify(this._range)})`)

        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)


        debug(`Applying sum for results of subQuery resolver. targets: ${result.map(it => it.target)} `)
        return this.applySumFunctionToEntries(result);
    }

    applySumFunctionToEntries(result) {

        const initialSum = {
            target: this._query,
            datapoints: []
        };
        return result.reduce((acc, current) => {
            const resolvedDatapoints = this.combineAndSumDatapoints(acc, current);
            return {
                ...acc,
                datapoints: resolvedDatapoints
            }
        }, initialSum)

    }

    // Iterate over datapoints of series to sum and
    // During each iteration do 2 things
    // 1 - Add all datapoints not covered by acc yet
    // 2 - Sum datapoint w/ matching timestamp for acc entry

    // timestamp of acc
    // timestamps:
    //      acc:  1     3     10   12
    //      curr: 1  2  3  4  10   12
    //                 /     /
    //     extra:    2     4
    // When processing datapoint acc w/ timestamp 3 (t3), an array with entry t2 and
    // and the sum of t3-acc and t3-curr .
    combineAndSumDatapoints(accumulatedDatapoints, currentSeries) {
        if (accumulatedDatapoints.datapoints.length === 0) return currentSeries.datapoints

        let currentIndex = 0
        let currentDatapoint = currentSeries.datapoints[currentIndex];
        return accumulatedDatapoints.datapoints.flatMap(datapoint => {
            const resolvedDatapoints = []

            while (!!currentDatapoint && currentDatapoint[1] < datapoint[1]) {
                resolvedDatapoints.push(currentDatapoint)

                currentIndex += 1
                currentDatapoint = currentSeries.datapoints[currentIndex];
            }

            if (!!currentDatapoint && currentDatapoint[1] === datapoint[1]) {
                const agg = (datapoint[0] || 0) + (currentDatapoint[0] || 0)
                resolvedDatapoints.push([agg, datapoint[1]])
                currentIndex += 1
                currentDatapoint = currentSeries.datapoints[currentIndex];
            } else {
                resolvedDatapoints.push([datapoint])
            }

            return resolvedDatapoints
        });
    }

    static hasMatchingSyntax = query => query.startsWith("sum(")

    static of(query, originalTarget, range) {
        let matches = query.match(aliasRegex);
        if (!matches) {
            throw new QuerySyntaxError('Function statement should adhere to the following signature: ' +
                'sum(expression: Expression)')
        }

        return new SumFunction(query, originalTarget, range, matches)
    }
}

module.exports = SumFunction;
