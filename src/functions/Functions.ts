import {aliasSubFunctionFactory} from "./AliasSubFunction";
import {aliasFunctionFactory} from "./AliasFunction";
import {timeShiftFunctionFactory} from "./TimeShiftFunction";
import {increaseFunctionFactory} from "./IncreaseFunction";
import {sumFunctionFactory} from "./SumFunction";

export interface QueryableFunction {
    apply(subQueryResolver: any): any
}

export interface QueryableFunctionFactory {
    of(query: string, originalTarget: any, range: any): QueryableFunction

    hasMatchingSyntax(query: string): boolean,
}

export const APPLICABLE_FUNCTION_FACTORIES: QueryableFunctionFactory[] = [
    aliasSubFunctionFactory,
    aliasFunctionFactory,
    timeShiftFunctionFactory,
    increaseFunctionFactory,
    increaseFunctionFactory,
    sumFunctionFactory
]

