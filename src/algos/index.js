const _ = require('lodash');
const moment = require('moment-timezone');
const TIME_ZONE = 'Africa/Douala'
const { publish, subscribe } = require('../redis');

// const algo = require('..');
const { getSymbolsChanges, getChangeFrom, changePercent, timeframeStartAt, DURATION, DEFAULT_PERIODS } = require('../binance-utils');
// const prices = require('../../progress/prices');
console.log.throttle = _.throttle(console.log, 1e3 * 60)
// let timeRef = 'day';
let strategyName

let in_;
let out;
let stop;
let last = null;
let first = null;
let second = null;
let log = []
let algoStarted;
let screener = {};
const TARGET_GAIN = 1.2
let first_change = 0;
let sellReason;
const tme_message_ids = {}
let startTime
let originTime
const SELL_REASON = {
    STOP_LOSS: 'stop_loss',
    SWITCH_TO_FIRST: 'switch_to_first'
}
const TOP_GAIN = 5
const FIRST_SECOND_DELTA = 2

const orderScreener = (screener) => _.orderBy(screener, perf => perf ? perf.change : 0, 'desc')
const getFirst = (screener) => _.first(orderScreener(screener))


init()

function run(screener) {
    first = getFirst(screener)
    if (first) {
        logFirst()
        if (!last) {
            buy()
        } else {
            Object.assign(last, screener[last.symbol])
            calculateGain()
            if (last)
                if (run.switchOrRealBuy({ last, first, second, _switch: sell, SWITCH_REASON: SELL_REASON })) {
                    publish(`m24:simulate`, {
                        strategy: strategyName,
                        symbol: last.symbol,
                        open: last.close,
                        target: 200,
                        unique: true,
                        time: last.closeTime,
                        inTime: last.startTime,
                        inChange: last.change
                    });
                }


        }
    }
}

function init() {
    last = null;
    stop = 2
    resetInOut()
    startTime = null
    algoStarted = false
}

function resetInOut() {
    in_ = 15
    out = in_ - stop
}

function getStartTime() {
    if (!startTime) {
        if (originTime) {
            startTime = originTime
        } else {
            let now = Date.now() //- DURATION.HOUR_6;
            startTime = now - now % DURATION.HOUR_24
        }
        console.log('startTime', new Date(startTime))
        // startTime =  timeframeStartAt(DURATION.HOUR_1)()

        const text = `#newframe started at ${new Date(startTime)}`
        publish(`m24:algo:tracking`, {
            max: true,
            strategyName,
            text
        });
        console.log(text)
    }
    return startTime
}


function buy() {
    last = buy.initLast({ first, second })
    if (last) {
        log.push(last);
        last.openPrice = last.close;
        const text = `#${log.length}buy #buy #buy_${last.symbol} ${last.symbol} at ${last.close} [${last.change.toFixed(2)}%]`
        publish(`m24:algo:tracking`, {
            max: true,
            strategyName,
            text
        });
        console.log(text)
    }

}

function sell(sellReason) {
    last.closePercent = last.change
    calculateGain()

    logSell(sellReason)
    in_ += .3
    last = null;
    // if (sellReason === SELL_REASON.STOP_LOSS) {
    //     init()
    // }
}

function logSell(sellReason) {

    const text = `#${log.length}sell #sell #sell_${last.symbol} #${last.symbol} at ${last.close}
sell reason #${sellReason || '#sell_reason_unknow'}   
gain ${last.gain.toFixed(2)}%  #${last.gain > 0 ? 'win' : 'lost'}
Max gain ${last.maxGain.toFixed(2)}% 
[${last.change.toFixed(2)}%]`;

    publish(`m24:algo:tracking`, {
        max: true,
        strategyName,
        text
    });
    console.log(text)
}

function calculateGain() {
    last.prevGain = last.gain || 0
    last.gain = changePercent(last.openPrice, last.close)
    last.maxGain = _.max([last.gain, last.maxGain])
    let fd = 0
    if (last.prevGain.toFixed(fd) != last.gain.toFixed(fd)) {
        const text = `#${log.length}gain 
${last.symbol}  ${last.gain.toFixed(2)}% 
Max gain ${last.maxGain.toFixed(2)}%
time ${moment(last.closeTime).tz(TIME_ZONE).format('DD MMM HH:mm')}
------------
first ${first.symbol} ${first.change.toFixed(2)}%
second ${second.symbol} ${second.change.toFixed(2)}%
diff ${(first.change - second.change).toFixed(2)}%
         
         `
        const id = 'trk' + log.length
        publish(`m24:algo:tracking`, {
            id,
            max: true,
            message_id: tme_message_ids[id],
            strategyName,
            text
        });
        console.log(text)
    }
}

function tryRestart() {
    if ((Date.now() - startTime > DURATION.HOUR_6 && (sellReason = "#la_session_a_trop_durée"))) {
        sell(sellReason)
        init()
        const text = `restart   last gain ${last.gain}  `
        publish(`m24:algo:tracking`, {
            max: true,
            strategyName,
            text
        });
        console.log(text)
    }
}

function collectProfit() {
    if ((last.gain > TARGET_GAIN && (sellReason = "#target_atteint"))) {
        sell(sellReason)
    }
}

function logFirst() {
    if (first) {
        if (first.change.toFixed(1) != first_change.toFixed(1)) {
            let text = `first ${first.symbol} ${first.change.toFixed(2)}%
second ${second.symbol} ${second.change.toFixed(2)}%
diff ${(first.change - second.change).toFixed(2)}%`

            let id = strategyName + 'first'
            publish(`m24:algo:tracking`, {
                id,
                max: true,
                message_id: tme_message_ids[id],
                strategyName,
                text
            });
            console.log(text)
            first_change = first.change
        }
    }
}

// console.log('listen to ALL_SYMBOLS_CANDLES')
// subscribe('ALL_SYMBOLS_CANDLES', allSymbolsCandles => {
//     if (Object.keys(prices).length > 10) {
//         console.log.throttle(_.uniqueId("i'm alive since " + new Date(startTime).toTimeString()))
//         const allGoodSymbolsCandles = _.reduce(allSymbolsCandles, (allGoodSymbolsCandles, candles, symbol) => {
//             if (changePercent(prices[symbol], prices[symbol] + SATOSHI) < MAX_SPREAD) {
//                 allGoodSymbolsCandles[symbol] = candles
//             }
//             return allGoodSymbolsCandles
//         }, {})
//         run(allGoodSymbolsCandles)
//     } else {
//         console.log('symbols count', Object.keys(prices).length)
//     }
// });


function logLoading(count, symbols) {
    if (logLoading.count !== count) {
        logLoading.count = count
        let id = strategyName + 'start'
        let text = `loading ${(count / symbols.length * 100).toFixed(2)}%`
        publish(`m24:algo:tracking`, {
            id,
            max: true,
            message_id: tme_message_ids[id],
            strategyName,
            text
        });
        console.log(text)
    }
}

module.exports = {
    setAlgo(name) {
        try {
            strategyName = name
            const options = { H24: global.H24, log, changePercent }
            const { initLast, switchOrRealBuy } = require('./' + name)
            buy.initLast = initLast.bind(options)
            run.switchOrRealBuy = switchOrRealBuy.bind(options)

        } catch (e) {
            console.error(e)
            process.exit(1)
        }
    },
    priceChanged({ symbols, allSymbolsCandles, fromTime, nowTime }) {
        if (!strategyName) throw 'call setAlgo'
        // console.log('got new price', symbol)
        originTime = fromTime
        DEFAULT_PERIODS.ALGO = getStartTime
        screener = getSymbolsChanges({ allSymbolsCandles, period: getStartTime, nowTime, timeframeName: 'algo' })
        const orderedScreener = orderScreener(screener)
        first = getFirst(screener)
        second = _.nth(orderedScreener, 1)

        let count = _.values(screener).filter(v => v).length
        logLoading(count, symbols)

        if (!(first && second && first.change > 0 && second.change > 0)) return
        // init()
        // algoStarted=true
        if (!algoStarted) {
            algoStarted = count > symbols.length - 5
            algoStarted && console.log('algoStarted ')

        } else {
            run(screener)
        }

    }

}
subscribe('tme_message_id', ({ id, message_id }) => {
    id && (tme_message_ids[id] = message_id)
})