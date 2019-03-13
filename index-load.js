#!/usr/bin/env node
const moment = require('moment-timezone');
const TIME_ZONE = 'Africa/Douala'
const program = require('commander');
const simulate = require('./src/simulator');
const { loadPreviousDate, loadPreviousPeriod } = require('./src/load-previous-candles');
let fromDate;
let toDate;
debugger
program
    .option('-f, --from-date <date> ', 'from date', /^\d\d\d\d-\d\d-\d\d$/)
    .option('-t, --to-date [date] ', 'to date optional', /^\d\d\d\d-\d\d-\d\d$/)
    .action(() => {
        debugger
        const cmd = program
        if (typeof cmd.fromDate === 'string') {
            fromDate = moment(new Date(cmd.fromDate))
            toDate = moment(new Date(cmd.toDate))
            if (typeof cmd.toDate !== 'string') {
                toDate = fromDate.clone().endOf('day')
            }
        } else {
            console.log("bad arguments")
            process.exit(1)
        }
    })
    .parse(process.argv);

loadPreviousPeriod(+fromDate.toDate(), +toDate.toDate())