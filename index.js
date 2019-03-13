#!/usr/bin/env node
 const program = require('commander');

program
    .version('0.1.0')
    .command('simu <algo>', 'simulate algo')
    .command('load', 'load prev date')
    .parse(process.argv);

