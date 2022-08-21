import Debug from "debug";

const debug = Debug("homey-grafana:rangeConverter");

const DEFAULT_RESOLUTION = "last6Hours";

export const convertRangeToResolution = (range: any) => {
    debug("range: ", JSON.stringify(range))

    const resolution = _convertRangeToResolution(range)
    debug("Resolution picked", resolution )

    return resolution
}
const _convertRangeToResolution = (range: any) => {

    // const rangeToResolutionMap = (
    //     "lastHour" | "lastHourLowRes" | "last6Hours" | "last6HoursLowRes" | "last24Hours" | "last3Days" |
    //     "last7Days" | "last14Days" | "last31Days" | "last3Months" | "last6Months" | "last2Years" |
    //     "today" | "thisWeek" | "thisMonth" | "thisYear" | "yesterday" | "lastWeek" | "lastMonth" | "lastYear"
    // )

    const from = new Date(range.from)
    // const to = new Date(range.to)
    const now = new Date()

    const RESOLUTION_BUFFER = 1.1
    // difference in hours
    const diffInHours = (now.getUTCMilliseconds() - from.getUTCMilliseconds()) / (1000.0 * 60 * 60)
    // debug("diffInHours ", diffInHours)
    if (diffInHours <= 1 * RESOLUTION_BUFFER) return "lastHour";
    if (diffInHours <= 6 * RESOLUTION_BUFFER) return "last6Hours"
    if (diffInHours <= 24 * RESOLUTION_BUFFER) return "last24Hours"
    if (diffInHours <= 72 * RESOLUTION_BUFFER) return "last3Days"

    const diffInDays = diffInHours / 24.0
    if (diffInDays <= 7 * RESOLUTION_BUFFER) return "last7Days"
    if (diffInDays <= 14 * RESOLUTION_BUFFER) return "last14Days"
    if (diffInDays <= 31 * RESOLUTION_BUFFER) return "last31Days"


    const diffInMonths = diffInDays / (365.25 / 12.0)
    if (diffInMonths <= 3 * RESOLUTION_BUFFER) return "last3Months"
    if (diffInMonths <= 6 * RESOLUTION_BUFFER) return "last6Months"
    if (diffInMonths <= 24 * RESOLUTION_BUFFER) return "last2Years"

    console.error("Weird resolution requested: ", JSON.stringify(range))
    return DEFAULT_RESOLUTION
}

// module.exports = {
//     DEFAULT_RESOLUTION,
    // convertRangeToResolution
// }

