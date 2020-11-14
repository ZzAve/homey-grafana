const {convertRangeToResolution} = require( "../RangeConverter");

const {QuerySyntaxError} = require("../QuerySyntaxError");

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
class TimeShiftFunction {
    constructor(query, originalTarget, resolution, range, regexMatches) {
        this._query = query;
        // this._resolution = resolution

        this._subQuery = regexMatches[1]
        this._shiftValue = regexMatches[3]
        this._shiftUnit = regexMatches[4]


        const newRange = this._shiftBackRange(range);
        this._resolution = convertRangeToResolution(newRange)

        this._originalTarget = originalTarget;


    }

    _shiftBackRange(range) {
        const newFrom = new Date(range.from);
        const newTo = new Date(range.to);
        if (this._shiftUnit === "d") {
            newFrom.setDate(newFrom.getDate() - this._shiftValue)
            newTo.setDate(newTo.getDate() - this._shiftValue)
        } else if (this._shiftUnit === "h") {
            newFrom.setHours(newFrom.getHours() - this._shiftValue)
            newTo.setHours(newTo.getHours() - this._shiftValue)
        } else if (this._shiftUnit === "m") {
            newFrom.setMinutes(newFrom.getMinutes() - this._shiftValue)
            newTo.setMinutes(newTo.getMinutes() - this._shiftValue)
        }
        return {
            from: newFrom.toISOString(),
            to: newTo.toISOString(),
        };
    }


    async apply(subQueryResolver) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._resolution)

        console.log(result[0].datapoints[1])
        //get shift in ms
        const forwardShift = this._getForwardShift()
        result.map(entry => {
            entry.datapoints.map(datapoint => {
                //change time
                datapoint[1] += forwardShift
            })
        })
        console.log(result[0].datapoints[1])
        return result
    }

    static hasMatchingSyntax = query => query.startsWith("timeShift(")

    static of(query, originalTarget, resolution, range) {
        let matches = query.match(aliasRegex);
        if (!matches) {
            throw new QuerySyntaxError('Function statement should adhere to the following signature: ' +
                'timeShift(expression: Expression, timeIndication: TimeUnit) (examples 1m, 9h, 3d)')
        }

        return new TimeShiftFunction(query, originalTarget, resolution, range, matches)
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

module.exports = TimeShiftFunction;
