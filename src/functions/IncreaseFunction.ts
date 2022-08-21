import type {QueryableFunction, QueryableFunctionFactory} from "./Functions";

import {binarySearch, shiftBackRange} from "./Utils";

import {QuerySyntaxError} from "../QuerySyntaxError";

import Debug from "debug";

const debug = Debug("homey-grafana:increaseFunction");

const aliasRegex = new RegExp(/^increase\((.*),(\s+)?([0-9]+)([mhd])(\s+)?\)/)

/**
 * Increase function aggregates data for each data point over a requested timeFame
 * Effectively, for each data points following value is returned:
 *  ==>  value @time  - value @time - aggregate time
 *
 * Usecase: see relative increase of ever increasing meters (say, see energy meter increase for last 7 days)
 *
 * example:
 *  increase("loadavg", 1h) will try and resolve all metrics containing 'loadavg' in them,
 *  each datapoint returned shows the difference between the value at that time with respect to the same value 1 hour
 *  earlier
 *
 *
 */

class IncreaseFunctionFactory implements QueryableFunctionFactory {
    hasMatchingSyntax: ((query: any) => boolean) = (query: any) => query.startsWith("increase(")

    of(query: any, originalTarget: any, range: any) {
        let matches = query.match(aliasRegex);
        if (!matches) {
            throw new QuerySyntaxError('Function statement should adhere to the following signature: ' +
                'increase(expression: Expression, timeIndication: TimeUnit) (examples 1m, 9h, 3d)')
        }

        return new IncreaseFunction(query, originalTarget, range, matches)
    }
}

export const increaseFunctionFactory = new IncreaseFunctionFactory()

class IncreaseFunction implements QueryableFunction {
    private _query: any;
    private readonly _originalTarget: any;
    private readonly _range: any;
    private readonly _subQuery: any;
    private readonly _timeValue: any;
    private readonly _timeUnit: any;

    constructor(query: any, originalTarget: any, range: any, regexMatches: any) {
        this._query = query;

        this._originalTarget = originalTarget;

        this._subQuery = regexMatches[1]

        this._timeValue = regexMatches[3]
        this._timeUnit = regexMatches[4]

        const shiftedRange = shiftBackRange(range, this._timeUnit, this._timeValue);
        this._range = {
            from: shiftedRange.from,
            to: range.to
        }
    }

    async apply(subQueryResolver: any) {
        debug(`Calling subQueryResolver for increase function for '${this._subQuery}'. range: ${JSON.stringify(this._range)})`)

        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)


        debug(`Applying increase for results of subQuery resolver. interval: ${this._timeValue}${this._timeUnit} targets: ${result.map((it: any) => it.target)} `)
        return this.applyIncreaseFunctionToEntries(result);
    }

    applyIncreaseFunctionToEntries(result: any) {
        const shift = this._getTimeShiftInMsec()

        //get get aggregate for each
        return result.map((entry:any) => ({
                target: entry.target,
                datapoints: entry.datapoints.map((it: any) => {
                        const referenceDatapoint = this.getReferenceDatapoint(it, shift, entry)

                        return !!referenceDatapoint ? [
                            it[0] - referenceDatapoint[0],
                            it[1]
                        ] : null
                    }
                ).filter((it: any) => it != null)
            })
        )
    }

    getReferenceDatapoint(datapoint: any, timeShift: any, entry: any) {
        if (datapoint[0] != null) {
            const referenceTime = this.getReferenceTime(datapoint, timeShift, entry);
            if (!!referenceTime) {
                const referenceDatapointIndex = binarySearch(entry.datapoints, (dp: any) => referenceTime - dp[1]);
                const referenceDatapoint = entry.datapoints[referenceDatapointIndex]

                if (!!referenceDatapoint && referenceDatapoint[0] != null) {
                    return referenceDatapoint
                }
            }
        }

        return null

    }

    getReferenceTime(datapoint: any, timeShift: any, resultsEntry: any) {
        const referenceTime = datapoint[1] - timeShift;
        const isReferenceTimeInRange = referenceTime >= resultsEntry.datapoints[0][1];

        return isReferenceTimeInRange ? referenceTime : null
    }

    _getTimeShiftInMsec() {
        let scale = 1;
        if (this._timeUnit === "d") {
            scale = 1000 * 60 * 60 * 24
        } else if (this._timeUnit === "h") {
            scale = 1000 * 60 * 60
        } else if (this._timeUnit === "m") {
            scale = 1000 * 60
        }
        return scale * this._timeValue
    }
}

