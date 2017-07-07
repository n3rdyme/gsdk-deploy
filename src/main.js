'use strict';
/******************************************************************************
 * MIT License
 * Copyright (c) 2017 https://github.com/vroomlabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Created by rogerk on 7/2/17.
 ******************************************************************************/

process.env.DEBIAN_FRONTEND = 'noninteractive';
const logger = require('./util/logger').logger;
const colors = require('colors');

logger.silly('starting arguments', {argv: process.argv});

require('babel-polyfill');
const main =require('./gsdk-deploy');

/* eslint-disable no-process-exit */
let startTime = Date.now();

main(process.argv.slice(2))
    .then(() => {
        logger.debug('Operation completed in: ' + (((Date.now()-startTime)/1000)|0) + ' seconds.');
        logger.log('verbose', 'Exit = 0', {}, () => { process.exit(0); });
    })
    .catch((ex) => {
        logger.log('error', 'Fatal exception: ' + ex.message + '\n',
            ex,
            function() {
            process.stdout.write(colors.bold.dim.yellow('\nFATAL:   ' + ex.message + '\n'));
            process.exit(1);
        });
    });
