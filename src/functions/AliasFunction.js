const {QuerySyntaxError} = require("../QuerySyntaxError");

const aliasRegex = new RegExp(/^alias\((.*),(\s+)?"(.*)"(\s+)?\)/)

class AliasFunction {
    constructor(query, originalTarget, resolution, regexMatches) {
        this._query = query;
        this._originalTarget = originalTarget;
        this._resolution = resolution

        this._subQuery = regexMatches[1]
        this._alias = regexMatches[3]
    }

    async apply(subQueryResolver) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._resolution)

        //Replace title
        for (let entry of result){
            entry.target = this._alias
        }

        return result
    }

    static hasMatchingSyntax = query => query.startsWith("alias(")

    static of( query, originalTarget, resolution){
        let matches = query.match(aliasRegex);
        if (!matches){
            throw new QuerySyntaxError('Alias statement should adhere to the following signature: alias(expression: Expression, alias: string)')
        }

        return new AliasFunction(query, originalTarget, resolution, matches)
    }

}

module.exports = AliasFunction;
