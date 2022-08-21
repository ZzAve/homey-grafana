import type {QueryableFunction, QueryableFunctionFactory} from "./Functions";

import {QuerySyntaxError} from "../QuerySyntaxError";

import {shiftBackRange} from "./Utils";


const aliasRegex = new RegExp(/^timeShift\((.*),(\s+)?([0-9]+)([mhd])(\s+)?\)/)

/**
 * TimeShift function allows you to return a metric shifted back in time.
 *
 * Usecase: compare different moments in time in 1 graph
 *
 * example:
 *  timeShift("loadavg", 1h) will try and resolve all metrics containing 'loadavg' in them,
 *  where the actual time you're seeing is actually from 1 hour ago.
 *
 *
 */
class TimeShiftFunctionFactory implements QueryableFunctionFactory {
    hasMatchingSyntax: ((query: any) => boolean) = (query: any) => query.startsWith("timeShift(")

    of(query: string, originalTarget: any, range: any) {
        let matches = query.match(aliasRegex);
        if (!matches) {
            throw new QuerySyntaxError('Function statement should adhere to the following signature: ' +
                'timeShift(expression: Expression, timeIndication: TimeUnit) (examples 1m, 9h, 3d)')
        }

        return new TimeShiftFunction(query, originalTarget, range, matches)
    }
}

export const timeShiftFunctionFactory = new TimeShiftFunctionFactory();

class TimeShiftFunction implements QueryableFunction {
    private _query: any;
    private readonly _originalTarget: any;
    private readonly _range: any;
    private readonly _subQuery: any;
    private readonly _alias: any;
    private readonly _shiftValue: any;
    private readonly _shiftUnit: any;

    constructor(query: any, originalTarget: any, range: any, regexMatches: any) {
        this._query = query;

        this._subQuery = regexMatches[1]
        this._shiftValue = regexMatches[3]
        this._shiftUnit = regexMatches[4]


        this._range = shiftBackRange(range, this._shiftUnit, this._shiftValue);
        this._originalTarget = originalTarget;
    }

    async apply(subQueryResolver: any) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)

        //get shift in ms
        const forwardShift = this._getForwardShift()
        const shiftedResult = result.map((entry: any) => ({
            target: entry.target,
            datapoints: entry.datapoints.map((datapoint: any) => [datapoint[0], datapoint[1] + forwardShift])
        }));
        return shiftedResult
    }


    _getForwardShift() {
        let scale = 1;
        if (this._shiftUnit === "d") {
            scale = 1000 * 60 * 60 * 24
        } else if (this._shiftUnit === "h") {
            scale = 1000 * 60 * 60
        } else if (this._shiftUnit === "m") {
            scale = 1000 * 60
        }
        return scale * this._shiftValue
    }
}
