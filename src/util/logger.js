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
 * Created by rogerk on 7/3/17.
 ******************************************************************************/

const path = require('path');
const winston = require('winston');
const debug = require('debug');
const colors = require('colors');
const getArtifactsFolder = require('./artifacts').getArtifactsFolder;

class DebugLogger extends winston.Transport {
    constructor(options) {
        super(options);
        this.name = 'debugLogger';
        this.level = 'silly';
        this.debugLog = debug('gsdk-deploy');
    }
    log(level, msg, meta, callback) {
        msg = `${level.toUpperCase()} ${msg} ${JSON.stringify(meta||{})}`;
        this.debugLog(msg);
        callback(null, true);
    }
}

const logSettings = {
    levels: {
        error: 0,
        warn: 1,
        help: 2,
        data: 3,
        info: 4,
        debug: 5,
        prompt: 6,
        verbose: 7,
        input: 8,
        silly: 9,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        help: 'cyan',
        data: 'grey',
        info: 'green',
        debug: 'blue',
        prompt: 'grey',
        verbose: 'cyan',
        input: 'grey',
        silly: 'magenta'
    }
};

class LogWriter {
    constructor(options) {
        let consoleLevel = 'debug';
        this.logPath = path.join(getArtifactsFolder() || process.cwd(), 'gsdk-deploy.log');

        process.argv.forEach(param => {
            let m = param.match(/^-log[:=]([\w]{4,7})$/i);
            if (m) consoleLevel = m[1].toLowerCase();
        });

        this._logWriter = new winston.Logger(Object.assign({
            levels: logSettings.levels,
            colors: logSettings.colors,
            transports: [
                new DebugLogger(),
                new winston.transports.Console({
                    handleExceptions: true,
                    level: consoleLevel,
                    json: false,
                    colorize: true
                }),
                new (winston.transports.File)({
                    filename: this.logPath,
                    level: 'verbose'
                })
            ]
        }, options || {}));
        this._logWriter.cli();
    }

    /** @deprecated */
    log() {
        this._logWriter.log.apply(this._logWriter, [].slice.call(arguments));
    }

    /**
     * @param {string} message
     * @param {object=} data
     */
    error(message, data) { return this.log('error', colors.red(message), data); }
    /**
     * @param {string} message
     * @param {object=} data
     */
    warn(message, data) { return this.log('warn', colors.dim.yellow(message), data); }
    /**
     * @param {string} message
     * @param {object=} data
     */
    info(message, data) { return this.log('info', message, data); }
    /**
     * @param {string} message
     * @param {object=} data
     */
    verbose(message, data) { return this.log('verbose', message, data); }
    /**
     * @param {string} message
     * @param {object=} data
     */
    debug(message, data) { return this.log('debug', colors.gray(message), data); }
    /**
     * @param {string} message
     * @param {object=} data
     */
    silly(message, data) { return this.log('silly', message, data); }
}

export const logger = new LogWriter();
