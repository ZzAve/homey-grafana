const {QuerySyntaxError} = require("../QuerySyntaxError");

const aliasSubRegex = new RegExp(/^aliasSub\((.*),(\s+)?"(.*)"(\s+)?,(\s+)?"(.*)"(\s+)?\)/)

class AliasSubFunction {
    constructor(query, originalTarget, resolution, regexMatches) {
        this._query = query;
        this._originalTarget = originalTarget;
        this._resolution = resolution


        this._subQuery = regexMatches[1]
        this._regexMatch = new RegExp(regexMatches[3])
        this._alias = regexMatches[6]
    }

    async apply(subQueryResolver) {
        const result = await subQueryResolver(
            this._subQuery,
            this._originalTarget,
            this._resolution)

        //Replace title
        for (let entry of result){
            const aliasedTitle = entry.target.replace(this._regexMatch, this._alias);
            entry.target = aliasedTitle
        }

        return result
    }

    static hasMatchingSyntax =query => query.startsWith("aliasSub(")

    static of( query, originalTarget, resolution){
        let matches = query.match(aliasSubRegex);
        if (!matches){
            throw new QuerySyntaxError('AliasSub statement should adhere to the following signature: alias(expression: Expression, regex: string, alias: string)')
        }

        return new AliasSubFunction(query, originalTarget, resolution, matches)
    }

}

module.exports = AliasSubFunction;
