const AliasFunction = require("./AliasFunction");
const AliasSubFunction = require("./AliasSubFunction");
const TimeShiftFunction = require("./TimeShiftFunction");


const AVAILABLE_FUNCTIONS = [
    AliasFunction,
    AliasSubFunction,
    TimeShiftFunction
]

module.exports = {
    AVAILABLE_FUNCTIONS
}