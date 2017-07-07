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

import * as fs from 'fs';
import {logger} from '../util/logger';

const colors = require('colors');
/**
 * @param {AppState} app
 */
module.exports = async function viewLogs(app) {
    let logLines = fs.readFileSync(logger.logPath).toString().split('\n');
    let ix = Math.max(logLines.length - 100, 0);
    for (; ix < logLines.length; ix++) {
        let line = logLines[ix];
        if (!line.match(/^{.*}$/)) continue;

        let rec = null;
        try { rec = JSON.parse(line); }
        catch(ex) { process.stdout.write(line + '\n'); continue; }

        line = colors.gray(`[${rec.timestamp.substr(11, 8)}] ${rec.level}`) + `: ${rec.message}\n`;
        if (rec.stack) line += colors.gray(rec.stack) + '\n';
        delete rec.level;
        delete rec.timestamp;
        delete rec.message;
        delete rec.stack;
        if (Object.keys(rec).length > 0) {
            line += colors.gray(JSON.stringify(rec, null, 2).substr(2, -4)) + '\n';
        }
        line.replace(/\n\n+/, '\n');
        process.stdout.write(line);
    }
    process.exit(0);
};
