let switchReason
const TOP_GAIN = 5
const FIRST_SECOND_DELTA = 2

module.exports = {
    initLast({ first, second }) {
        let last = first;
        let change = (first.change - second.change) % 5
        last.close = +(last.close * (1 - change / 100)).toFixed(8)
        last.change -= change
        return last
    },
    switchOrRealBuy({ last, first, second, _switch, SWITCH_REASON }) {

        if (last.symbol !== first.symbol && (switchReason = SWITCH_REASON.SWITCH_TO_FIRST)) {
            _switch(switchReason)
        } else if (last.gain < -1 && (switchReason = SWITCH_REASON.STOP_LOSS)) {
            _switch(switchReason)
        } else {
            if (last.gain > TOP_GAIN && first.change - second.change > FIRST_SECOND_DELTA) {
                return true
            }
        }
    }
}