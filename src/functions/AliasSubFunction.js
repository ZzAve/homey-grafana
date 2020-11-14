const {QuerySyntaxError} = require("../QuerySyntaxError");

const aliasSubRegex = new RegExp(/^aliasSub\((.*),(\s+)?"(.*)"(\s+)?,(\s+)?"(.*)"(\s+)?\)/)

/**
 * AliasSub function allows you to return an alias for the displayName of the requested target,
 * by specifying a regexExpression, and allowing for reuse of the original name
 *
 * example:
 *  aliasSub(memusage, ".+?~(.*)-.*", "memory usage $1")
 *  will try and resolve all metrics containing 'memusage' in them, and then try and replace (substibute)
 *  the string based on a the regex string in the 2nd argument with the (reference) string in the 3rd.
 *
 *  Let's say a metric returned is this one: "Apps~net.i-dev.betterlogic-memusage"
 *  The above exmple will replace the displayname with "memory usage net.i-dev.betterlogic"
 */
class AliasSubFunction {
    constructor(query, originalTarget, range, regexMatches) {
        this._query = query;
        this._originalTarget = originalTarget;
        this._range = range


        this._subQuery = regexMatches[1]
        this._regexMatch = new RegExp(regexMatches[3])
        this._alias = regexMatches[6]
    }

    async apply(subQueryResolver) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)

        //Replace title
        for (let entry of result){
            const aliasedTitle = entry.target.replace(this._regexMatch, this._alias);
            entry.target = aliasedTitle
        }

        return result
    }

    static hasMatchingSyntax =query => query.startsWith("aliasSub(")

    static of( query, originalTarget, range){
        let matches = query.match(aliasSubRegex);
        if (!matches){
            throw new QuerySyntaxError('AliasSub statement should adhere to the following signature: alias(expression: Expression, regex: string, alias: string)')
        }

        return new AliasSubFunction(query, originalTarget, range, matches)
    }

}

module.exports = AliasSubFunction;
