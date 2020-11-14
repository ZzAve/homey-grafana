const {QuerySyntaxError} = require("../QuerySyntaxError");

const aliasRegex = new RegExp(/^alias\((.*),(\s+)?"(.*)"(\s+)?\)/)

/**
 * Alias function allows you to return an alias for the displayName of the requested target
 *
 * example:
 *  alias("loadavg","Memory usage") will try and resolve all metrics containing 'loadavg' in them,
 *  replacing the displayName (called 'target' in the api) with "Memory usage")
 */
class AliasFunction {
    constructor(query, originalTarget, range, regexMatches) {
        this._query = query;
        this._originalTarget = originalTarget;
        this._range = range

        this._subQuery = regexMatches[1]
        this._alias = regexMatches[3]
    }

    async apply(subQueryResolver) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)

        //Replace title
        for (let entry of result){
            entry.target = this._alias
        }

        return result
    }

    static hasMatchingSyntax = query => query.startsWith("alias(")

    static of( query, originalTarget, range){
        let matches = query.match(aliasRegex);
        if (!matches){
            throw new QuerySyntaxError('Alias statement should adhere to the following signature: alias(expression: Expression, alias: string)')
        }

        return new AliasFunction(query, originalTarget, range, matches)
    }

}

module.exports = AliasFunction;
