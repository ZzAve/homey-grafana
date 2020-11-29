const AliasFunction = require("./AliasFunction");
const AliasSubFunction = require("./AliasSubFunction");
const TimeShiftFunction = require("./TimeShiftFunction");
const IncreaseFunction = require("./IncreaseFunction");
const IncreaseRangeFunction = require("./IncreaseRangeFunction");
const SumFunction = require("./SumFunction");


const AVAILABLE_FUNCTIONS = [
    AliasFunction,
    AliasSubFunction,
    IncreaseFunction,
    IncreaseRangeFunction,
    SumFunction,
    TimeShiftFunction,
]

module.exports = {
    AVAILABLE_FUNCTIONS
}