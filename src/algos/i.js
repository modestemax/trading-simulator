let switchReason
const TOP_GAIN = 5
const FIRST_SECOND_DELTA = 2

module.exports = {
    initLast({ first, second, }) {
        const { changePercent, H24 } = initLast
        if (H24 && changePercent(first.close, H24 [first.symbol].highPrice) > 5) return
        last = first;
        let last_last = _.last(log) || { ...second, openChange: second.change }
        if (first.change > last_last.openChange) {
            let diffChange = (first.change - last_last.openChange)
            last.close = +(last.close * (1 - diffChange / 100)).toFixed(8)
            last.change -= diffChange
        }
        last.openChange = last.change
        return last
    },
    switchOrRealBuy({ last, first, second, _switch, SWITCH_REASON }) {

        if (last.symbol !== first.symbol && last.symbol !== second.symbol &&
            first.change - last.change > 3 && (switchReason = SWITCH_REASON.SWITCH_TO_FIRST)) {
            _switch(switchReason)
        } else if (last.gain < -1 && (switchReason = SWITCH_REASON.STOP_LOSS)) {
            _switch(switchReason)
        } else {
            if (last.gain > TOP_GAIN) {
                return true
            }
        }
    }
}