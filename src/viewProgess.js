const { publish, subscribe } = require('./redis');
const _ = require('lodash');
const moment = require('moment-timezone');
const TIME_ZONE = 'Africa/Douala'
const trades = {};
const tradesByIds = {};
const ONE_MIN = 1e3 * 60
const TARGET = 2
const LOSS = -5
const change = (open, close) => (close - open) / open;
const changePercent = (open, close) => change(open, close) * 100;
const tme_message_ids = {}

subscribe('tme_message_id', ({ id, message_id }) => {
        id && (tme_message_ids[id] = message_id)
    }
)

process.nextTick(() => {

    function getId(strategy, symbol, unique) {
        let id = unique ? strategy : strategy + symbol
        tradesByIds[id] = tradesByIds[id] || []
        if (unique && tradesByIds[id].length) {
            let currentTrade = _.last(tradesByIds[id])
            if (currentTrade.symbol !== symbol) {

                delete trades[currentTrade.symbol][id]
            }
        }
        let trade = trades[symbol][id]

        if (trade && (trade.win || trade.lost)) {
            delete tme_message_ids[id]
            delete trades[symbol][id]
        }
        return id;
    }

    subscribe('m24:simulate', ({ symbol, strategy, open, stop, limit, target, unique, time, inTime, inChange }) => {
        trades[symbol] = trades[symbol] || {}
        let id = getId(strategy, symbol, unique)
        if (!trades[symbol][id]) {
            let text = `pair found ${strategy} ${symbol} ${open ? open : ''} 
        ${stop ? `stop ${stop.toFixed(8)}` : ''} 
        ${limit ? `limit ${limit.toFixed(8)}` : ''}`

            publish(`m24:algo:simulate`, { id, text });
            console.log(text)
            let trade = trades[symbol][id] = {
                id, open, stop, limit, symbol, strategy, time: time || Date.now(),
                target: target || TARGET, inChange, inTime,
                minToHigh:open
            }
            tradesByIds[id].push(trade)
            global.tradesLog.push(trade)
        }
    })

    function stop_limit_buy(trade, close, symbol) {
        if (trade.stop) {
            if (Math.abs(changePercent(trade.stop, close)) < .3) {
                trade.stop = null
            }
        } else if (trade.limit) {
            if (Math.abs(changePercent(trade.limit, close)) < .3) {
                trade.limit = null
                trade.open = close
                trade.time = Date.now()
            }
        }

        if (trade.close !== close) {
            let { strategy, open, stop, limit, id } = trade
            let text = `pair found ${strategy} ${symbol} ${open ? open : ''} 
${`close ${close}`} 
${stop ? `stop  ${stop.toFixed(8)}` : ''} 
${limit ? `limit  ${limit.toFixed(8)}` : ''}`

            tme_message_ids[id] && publish(`m24:algo:simulate`, {
                id, text, message_id: tme_message_ids[id],
            });
            console.log(text)
            trade.close = close

        }
        return
    }

    subscribe('price', ({ symbol, close, closeTime, fromTime }) => {
        _.values(trades[symbol]).forEach((trade) => {
            if (!trade.open) {
                return stop_limit_buy(trade, close, symbol);
            }
            trade.open = trade.open || close
            trade.close = close
            trade.closeTime = closeTime || Date.now()
            trade.oldHigh = trade.high
            trade.high = _.max([trade.high, close])
            trade.low = _.min([trade.low, close])

            trade.minToHigh = trade.high > trade.oldHigh ? trade.low : trade.minToHigh
            trade.max_lost = _.max([trade.high - trade.close, trade.max_lost])
            trade.oldChange = isNaN(trade.change) ? -Infinity : trade.change
            trade.change = changePercent(trade.open, trade.close)
            let highChange = trade.highChange = changePercent(trade.open, trade.high)
            let lowChange = trade.lowChange = changePercent(trade.open, trade.low)
            let minToHighChange = trade.minToHighChange = changePercent(trade.open, trade.minToHigh)

            let fd = 0
            if (trade.change.toFixed(fd) !== trade.oldChange.toFixed(fd)) {

                const lost = trade.lost = lowChange <= LOSS
                const win = trade.win = highChange >= trade.target
                trade.timeEnd = trade.timeEnd || (win && Date.now()) || void 0
                // trade.minToHigh = trade.minToHigh || (win && trade.low) || void 0
                let winDuration = win && moment.duration(moment(trade.timeEnd).diff(moment(trade.time))).humanize()
                let state2 = win ? `win` : highChange > 2 ? '' : 'lost'
                let state = win ? `${state2} [${winDuration}] [${minToHighChange.toFixed(2)}%]` : state2

                let date = moment(fromTime || undefined).tz(TIME_ZONE)
                // let quarter = Math.trunc(date.hour() / 6) + 1
                let quarter = Math.trunc(date.format('H') / 6) + 1
                let day = `${date.format('DDMMM')}`
                let dayCode = `${day}_${quarter}`
                let text = `
#${day} #${dayCode}
#${trade.strategy} #${trade.strategy}_${trade.symbol}
change ${trade.change.toFixed(2)}%
max ${highChange.toFixed(2)}%
min ${lowChange.toFixed(2)}%
duration  ${moment(trade.time).from(date)} [${moment(trade.time).tz(TIME_ZONE).format('H\\h:mm')}]
state #${state} #${state2}_${dayCode}
open ${trade.open}
close ${trade.close}
${win || lost ? '#closed' : ''}
`
                tme_message_ids[trade.id] && publish(`m24:algo:simulate`, {
                    id: trade.id,
                    message_id: tme_message_ids[trade.id],
                    text
                });
                console.log('\n', text)
            }

        })
    })


})