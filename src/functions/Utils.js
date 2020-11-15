const shiftBackRange = (range, timeUnit, timeValue) => {
    const newFrom = new Date(range.from);
    const newTo = new Date(range.to);
    if (timeUnit === "d") {
        newFrom.setDate(newFrom.getDate() - timeValue)
        newTo.setDate(newTo.getDate() - timeValue)
    } else if (timeUnit === "h") {
        newFrom.setHours(newFrom.getHours() - timeValue)
        newTo.setHours(newTo.getHours() - timeValue)
    } else if (timeUnit === "m") {
        newFrom.setMinutes(newFrom.getMinutes() - timeValue)
        newTo.setMinutes(newTo.getMinutes() - timeValue)
    }
    return {
        from: newFrom.toISOString(),
        to: newTo.toISOString(),
    };
}


const binarySearch = (array, comparePredicate) => {
    let lowerBound = 0;
    let upperBound = array.length - 1;
    while (lowerBound <= upperBound) {
        let checkIndex = (upperBound + lowerBound) >> 1;
        let cmp = comparePredicate(array[checkIndex]);
        if (cmp > 0) {
            lowerBound = checkIndex + 1;
        } else if (cmp < 0) {
            upperBound = checkIndex - 1;
        } else {
            return checkIndex;
        }
    }
    return -lowerBound - 1;
}

module.exports = {
    binarySearch,
    shiftBackRange,
}
