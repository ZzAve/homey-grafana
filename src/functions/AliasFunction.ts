import {QuerySyntaxError} from "../QuerySyntaxError";
import type {QueryableFunction, QueryableFunctionFactory} from "./Functions";


const aliasRegex = new RegExp(/^alias\((.*),(\s+)?"(.*)"(\s+)?\)/)

/**
 * Alias function allows you to return an alias for the displayName of the requested target
 *
 * example:
 *  alias("loadavg","Memory usage") will try and resolve all metrics containing 'loadavg' in them,
 *  replacing the displayName (called 'target' in the api) with "Memory usage")
 */
class AliasFunctionFactory implements QueryableFunctionFactory {
    hasMatchingSyntax: ((query: any) => boolean) = (query: any) => query.startsWith("alias(")

    of(query: string, originalTarget: any, range: any) {
        let matches = query.match(aliasRegex);
        if (!matches) {
            throw new QuerySyntaxError('Alias statement should adhere to the following signature: alias(expression: Expression, alias: string)')
        }

        return new AliasFunction(query, originalTarget, range, matches)
    }
}

export const aliasFunctionFactory = new AliasFunctionFactory();

class AliasFunction implements QueryableFunction {
    private _query: any;
    private readonly _originalTarget: any;
    private readonly _range: any;
    private readonly _subQuery: any;
    private readonly _alias: any;

    constructor(query: any, originalTarget: any, range: any, regexMatches: any) {
        this._query = query;
        this._originalTarget = originalTarget;
        this._range = range

        this._subQuery = regexMatches[1]
        this._alias = regexMatches[3]
    }

    async apply(subQueryResolver: any) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._range)

        //Replace title
        for (let entry of result) {
            entry.target = this._alias
        }

        return result
    }
}
