import type {QueryableFunction, QueryableFunctionFactory} from "./Functions";

import {QuerySyntaxError} from "../QuerySyntaxError";


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

class AliasSubFunctionFactory implements QueryableFunctionFactory {
    hasMatchingSyntax: ((query: any) => boolean) = (query: any) => query.startsWith("aliasSub(")

    of(query: string, originalTarget: any, range: any) {
        let matches = query.match(aliasSubRegex);
        if (!matches) {
            throw new QuerySyntaxError('AliasSub statement should adhere to the following signature: alias(expression: Expression, regex: string, alias: string)')
        }

        return new AliasSubFunction(query, originalTarget, range, matches)
    }
}

export const aliasSubFunctionFactory = new AliasSubFunctionFactory();

class AliasSubFunction implements QueryableFunction {
    private _query: any;
    private _originalTarget: any;
    private _range: any;
    private _subQuery: any;
    private _alias: any;
    private _regexMatch: RegExp;

    constructor(query: any, originalTarget: any, range: any, regexMatches: any) {
        this._query = query;
        this._originalTarget = originalTarget;
        this._range = range

        this._subQuery = regexMatches[1]
        this._regexMatch = new RegExp(regexMatches[3])
        this._alias = regexMatches[6]
    }

    async apply(subQueryResolver: any) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)

        //Replace title
        for (let entry of result) {
            const aliasedTitle = entry.target.replace(this._regexMatch, this._alias);
            entry.target = aliasedTitle
        }

        return result
    }
}
