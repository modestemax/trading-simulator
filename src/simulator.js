// @flow
//const QUOTE_ASSET="BTC";
// const QUOTE_ASSET_REGEX = /usd|pax/i;
const QUOTE_ASSET_REGEX = /btc$/i;
// const QUOTE_ASSET_REGEX = /bnb$/i;
// const QUOTE_ASSET="USDT";
const Promise = require('bluebird');
const _ = require('lodash');
const fs = require('fs');

const moment = require('moment-timezone');
const TIME_ZONE = 'Africa/Douala'
const { getRedis, redisGet, publish } = require('./redis');
const redis = getRedis()
const ONE_MIN = 1e3 * 60
const ONE_DAY = ONE_MIN * 60 * 24
global.tradesLog = []
const allSymbolsCandles = {};
const { publishPerf, loadCandles, listenToPriceChange, changePercent } = require('./binance-utils')
// const loadPrevious = require('./load_previous_data')
require('./viewProgess')
const formatMoment = (time) => moment(time).tz(TIME_ZONE).format('DD MMM HH:mm')

module.exports = async (algo, fromTime, toTime) => {
    try {
        const { priceChanged, setAlgo } = require(`./algos`);
        setAlgo(algo)
        console.log('simulating', algo, formatMoment(fromTime), ' - ', formatMoment(toTime))
        await startSimulation(fromTime, toTime, priceChanged)
    } catch (e) {
        console.error(e)
        process.exit(1)
    }


    async function startSimulation(startTime, closeTime, priceChanged) {
        const symbols = await redisGet('symbols')
        await simulate(symbols, startTime, closeTime, priceChanged)
        process.exit(0)
    }

    async function simulate(symbols, startTime, closeTime, priceChanged) {
        for (let date = startTime; date < closeTime; date += ONE_MIN) {
            console.log('tick', moment(date).tz(TIME_ZONE).format('HH:mm'))
            await Promise.mapSeries(symbols, async function loadLocal(symbol) {
                let data = await redis.hmgetAsync(symbol, +date)
                if (data && (_.isArray(data) ? data[0] : true)) {
                    try {
                        let candle = JSON.parse(data)
                        allSymbolsCandles[symbol] = allSymbolsCandles[symbol] || {}
                        allSymbolsCandles[symbol][+date] = candle
                        // console.log('tick', symbol, moment(date).tz(TIME_ZONE).format('HH:mm'))
                        publish('price', { symbol, fromTime: startTime, ...candle })
                    } catch (e) {
                        console.log(e)
                    }
                } else {
                    // await loadPrevious([symbol], date)
                    // await loadLocal(symbol)
                    // loadPrevious([symbol], date).then(() => loadLocal(symbol)).catch(_.noop)
                    let index = symbols.indexOf(symbol)
                    ~index && symbols.splice(index, 1)
                }
            });
            priceChanged({
                symbols,
                fromTime: startTime, nowTime: date,
                allSymbolsCandles
            })
        }

        saveLogs()
        console.log('END')
    }

    function saveLogs() {
        let firstTrade = _.first(tradesLog)
        if (firstTrade) {
            let logs = _.map(tradesLog, t => ({
                // strategy: t.strategy,
                symbol: t.symbol,
                startTime: moment(t.time).tz(TIME_ZONE).format('DD MMM HH:mm'),
                closeTime: moment(t.closeTime).tz(TIME_ZONE).format('DD MMM HH:mm'),
                inChange: t.inChange.toFixed(2),
                // inTime: moment(t.inTime).tz(TIME_ZONE).format('DD MMM HH:mm'),
                open: "'" + (+t.open).toFixed(8),
                close: "'" + (+t.close).toFixed(8),
                high: "'" + (+t.high).toFixed(8),
                low: "'" + (+t.low).toFixed(8),
                // minToHigh: (+t.minToHigh).toFixed(8),
                max_lost: t.max_lost.toFixed(2),
                change: t.change.toFixed(2),
                highChange: t.highChange.toFixed(2),
                lowChange: t.lowChange.toFixed(2),
                minToHighChange: (t.minToHighChange ).toFixed(2),
            }));
            logs = [_.mapValues(_.first(logs), (v, k) => k)].concat(logs)
            let txt = _.map(logs, log => _.values(log).join('\t')).join('\n')
            let logFileName = `${process.env.HOME}/tmp/m24-logs/${firstTrade.strategy}_${moment(firstTrade.inTime).format('DD_MMM')}.tsv`
            fs.writeFileSync(logFileName, txt)
            console.log('log saved in ', logFileName)
        }else{
            console.log('No Pair Match')
        }

    }
}