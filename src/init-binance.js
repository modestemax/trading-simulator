// @flow
//const QUOTE_ASSET="BTC";
// const QUOTE_ASSET_REGEX = /usd|pax/i;
// const QUOTE_ASSET="USDT";
const _ = require('lodash');
const Promise= require('bluebird');

const auth = require((process.env.HOME || '~') + '/.api.json').KEYS;
const  Binance= require('node-binance-api')

module.exports =Promise.promisifyAll( Binance().options({
    APIKEY: auth.api_key,
    APISECRET: auth.secret,
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    test: true, // If you want to use sandbox mode where orders are simulated
    verbose: true // If you want to use sandbox mode where orders are simulated
}));
