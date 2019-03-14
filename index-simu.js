#!/usr/bin/env node
const moment = require('moment-timezone');
const TIME_ZONE = 'Africa/Douala'
const program = require('commander');
const simulate = require('./src/simulator');
const { loadPreviousDate, loadPreviousPeriod } = require('./src/load-previous-candles');
let fromDate;
let toDate;

program
    .version('0.1.0')
    //  .usage('simu --algo algo --date-from date --date-to date ')
    .option('-f, --from-date <date> ', 'from date', /^\d\d\d\d-\d\d-\d\d$/)
    .option('-t, --to-date [date] ', 'to date optional', /^\d\d\d\d-\d\d-\d\d$/)
    .action(() => {
        // debugger
        const cmd = program
        if (typeof cmd.fromDate === 'string') {
            fromDate = moment(new Date(cmd.fromDate))
            toDate = moment(new Date(cmd.toDate)).endOf('day')
            if (typeof cmd.toDate !== 'string') {
                toDate = fromDate.clone().endOf('day')
            }
        } else {
            console.log("bad arguments")
            process.exit(1)
        }
    })
    .parse(process.argv);

const algo = program.args[0]
simulate(algo, +fromDate.toDate(), +toDate.toDate())