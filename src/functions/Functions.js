const AliasFunction = require("./AliasFunction");
const AliasSubFunction = require("./AliasSubFunction");
const TimeShiftFunction = require("./TimeShiftFunction");
const IncreaseFunction = require("./IncreaseFunction");
const IncreaseRangeFunction = require("./IncreaseRangeFunction");


const AVAILABLE_FUNCTIONS = [
    AliasFunction,
    AliasSubFunction,
    IncreaseFunction,
    IncreaseRangeFunction,
    TimeShiftFunction,
]

module.exports = {
    AVAILABLE_FUNCTIONS
}