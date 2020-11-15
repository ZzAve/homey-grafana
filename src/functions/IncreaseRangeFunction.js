const {QuerySyntaxError} = require("../QuerySyntaxError");
const Debug = require('debug')
const debug = Debug("homey-grafana:increaseRangeFunction");

const aliasRegex = new RegExp(/^increaseRange\((.*)\)/)

/**
 * IncreaseRange function aggregates data for each data point over relative to the first measurement for
 * the requested range
 * Effectively, for each data points following value is returned:
 *  ==>  value @time  - first value in time range
 *
 * Usecase: see and compare relative increase of ever increasing meters (say, see meter increase over 7 days)
 *
 * example:
 *  increaseRange("meter_power") will try and resolve all metrics containing 'meter_power' in them,
 *  each datapoint returned shows the difference between the value at that time with respect to the same value at
 *  the beginning of the requested range (selected on the top-right in grafana)
 *
 *
 */
class IncreaseRange {
    constructor(query, originalTarget, range, regexMatches) {
        this._query = query;

        this._originalTarget = originalTarget;
        this._subQuery = regexMatches[1]
        this._range = range
    }

    async apply(subQueryResolver) {
        debug(`Calling subQueryResolver for increaseRange function for '${this._subQuery}'. range: ${JSON.stringify(this._range)})`)
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)

        // increase from 1st non-null entry
        debug(`Applying increaseRange for results of subQuery resolver. targets: ${result.map(it => it.target)} `)
        return this.applyIncreaseFunctionByFirstEntry(result)
    }

    applyIncreaseFunctionByFirstEntry(result) {
        return result.map(entry => {
                // get base value:
                const referenceDatapoint = entry.datapoints.find(it => it[0] != null);
                return {
                    target: entry.target,
                    datapoints: entry.datapoints
                        .map(it => it[0] === null ? null : [it[0] - referenceDatapoint[0], it[1]])
                        .filter(it => it != null)
                };
            }
        )
    }

    static hasMatchingSyntax = query => query.startsWith("increaseRange(")

    static of(query, originalTarget, range) {
        let matches = query.match(aliasRegex);
        if (!matches) {
            throw new QuerySyntaxError('Function statement should adhere to the following signature: ' +
                'increaseRange(expression: Expression)')
        }

        return new IncreaseRange(query, originalTarget, range, matches)
    }
}

module.exports = IncreaseRange;
