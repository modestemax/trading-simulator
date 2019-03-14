const _ = require('lodash')
 const TOP_GAIN = 3
const START_CHANGE = 20
const FIRST_SECOND_DELTA = 3
const high = {}

module.exports = {
    initLast({ first, second, }) {
        const { changePercent, H24, log } = this

        if (H24 && changePercent(first.close, H24 [first.symbol].highPrice) > 5) return
        if (first.change < START_CHANGE) return

        return first
    },
    switchOrRealBuy({ last, first, second, _switch, SWITCH_REASON }) {
        const { changePercent, H24, log } = this
        high[last.symbol] = _.max([high[last.symbol], last.change])
        high[first.symbol] = _.max([high[first.symbol], first.change])
        high[second.symbol] = _.max([high[second.symbol], second.change])

        if (last.symbol !== first.symbol && last.symbol !== second.symbol) {
            _switch(SWITCH_REASON.SWITCH_TO_FIRST)
        } else if (last.symbol === second.symbol) {
            if (first.change - second.change > FIRST_SECOND_DELTA)
                _switch(SWITCH_REASON.STOP_LOSS)
        } else if (last.gain < -1) {
            _switch(SWITCH_REASON.STOP_LOSS)
        } else {
            if (high[last.symbol] === last.change) return true

            if (last.gain > TOP_GAIN) {
                return true
            }
        }
    }
}