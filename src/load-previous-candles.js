// @flow
//const QUOTE_ASSET="BTC";
// const QUOTE_ASSET_REGEX = /usd|pax/i;
const QUOTE_ASSET_REGEX = /btc$/i;
// const QUOTE_ASSET_REGEX = /bnb$/i;
// const QUOTE_ASSET="USDT";
const _ = require('lodash');

const moment = require('moment-timezone');
const TIME_ZONE = 'Africa/Douala'
const { getRedis, redisSet } = require('./redis');
const redis = getRedis()
const { publishPerf, loadCandles, listenToPriceChange, changePercent } = require('./binance-utils')

const binance = require('./init-binance');
const { SYMBOLS, ALL_SYMBOLS, FROM_DATE, TO_DATE } = process.env;

const ONE_MIN = 1e3 * 60
const ONE_DAY = ONE_MIN * 60 * 24;


module.exports = { loadPreviousDate, loadPreviousPeriod }

async function getSymbols() {
    return new Promise((resolve, reject) => {
        binance.exchangeInfo(async function ex_info(error, data) {

                if (error) {
                    console.log(error);
                    binance.exchangeInfo(ex_info)
                } else {
                    console.log('binance info loaded')

                    // const symbols = ['ETHBTC', 'ADABTC'];
                    const binanceSymbols = data.symbols
                        .filter(s => s.status === "TRADING")
                        .filter(s => QUOTE_ASSET_REGEX.test(s.quoteAsset))
                        .map(s => s.symbol);


                    binance.bookTickers(async (error, tickers) => {
                        if (error) process.nextTick(() => binance.exchangeInfo(ex_info))
                        let symbols = _.filter(binanceSymbols, symbol => {
                            const ticker = _.find(tickers, { symbol })
                            return (ticker && changePercent(ticker.bidPrice, ticker.askPrice) < .6)
                        });

                        await redisSet({ key: 'symbols', data: symbols })
                        resolve(symbols);
                    });
                }
            }
        );
    })
}

async function loadPreviousPeriod(startTime, closeTime, allSymbolsCandles = {}) {
    const symbols = await getSymbols()
    for (let date = startTime; date <= closeTime; date += ONE_DAY) {
        await (loadPreviousDate(symbols, date, allSymbolsCandles))
    }
    console.log('END')
}

async function loadPreviousDate(symbols, date, allSymbolsCandles = {}) {
    console.log('loading old data for ', new Date(date))
    const symbols2 = [];
    for (const symbol of symbols) {
        console.log('loading old data for ', symbol)

        try {
            let interval = '1m', limit = 60 * 24, startTime = +new Date(date)
            //load last one day candle
            allSymbolsCandles[symbol] = await loadCandles(symbol, interval, limit, startTime);
            let mostRecentDate = +_.first(_.keys(allSymbolsCandles[symbol]))
            if (startTime !== mostRecentDate)
                throw {
                    stop: true,
                    message: `most recent date is ${moment(+(mostRecentDate)).tz(TIME_ZONE).format('DD MMM HH:mm')}`
                }
            //build redis record
            let data = _.map(allSymbolsCandles[symbol], candle => {
                return [candle.startTime, JSON.stringify(candle)]
            })
            data = [symbol].concat(_.flatten(data))

            await redis.hmsetAsync(data)
            console.log(symbol, date, 'saved')
            // debugger
        } catch (e) {
            console.log(symbol, e.message || e);
            if (e.stop || e.code === 'MISCONF') throw e
            symbols2.push(symbol);
        }
    }
    symbols2.length && await new Promise((resolve) =>
        setTimeout(() => resolve(loadPreviousDate(symbols2, date, allSymbolsCandles), 30 * 1e3)))
}