'use strict';
/**
 * Created by rogerk on 7/3/17.
 */

import * as child from 'child_process';
import {logger} from '../util/logger';

function logOutputProc(level) {
    let currentLine = '';
    level = level === true ? 'debug' : level;
    if (level === 'none') return () => {};
    return (data) => {//eof
        if (data === null) {
            if (currentLine) data = '\n';
            else return;
        }
        data = data.toString().split('\n');
        data[0] = currentLine + data[0];
        for (let ix = 0; ix < (data.length - 1); ix++) {
            if (data[ix].replace(/[+=_|#\.\-]+/g, '').length > 0) {
                logger[level](data[ix]);
            }
        }
        currentLine = data[data.length - 1];
    }
}

/**
 * @param {string} command - console command line
 * @param {object=} options - cwd: string, env: object, direct: string
 * @returns {Promise}
 */
export function exec(command, options) {
    options = options || {};
    let args = command.split(/\s+/);
    let exe = args[0];
    args = args.splice(1);

    let stdout = Buffer.alloc(0);
    let opts = {};
    if (options.cwd) { opts.cwd = options.cwd; }
    if (options.env) { opts.env = options.env; }
    options.stdout = options.stdout || (options.direct ? logOutputProc(options.direct) : ()=>{});
    options.stderr = options.stderr || logOutputProc(options.direct || 'error');

    return new Promise(function (resolve, reject) {
        logger.verbose(command);
        let cmd = child.spawn(exe, args, opts);

        cmd.stdout.on('data', function (data) {
            options.stdout(data.toString());
            stdout = Buffer.concat([stdout, data]);
        });
        cmd.stderr.on('data', function (data) {
            options.stderr(data.toString());
        });

        cmd.on('exit', function (code) {
            options.stdout(null);
            options.stderr(null);

            if (code !== 0) {
                let err = new Error(`Failed to execute cmd (${code}): ${command}.`);
                err.stdout = stdout.toString();
                err.exitCode = code;
                logger.verbose(err);
                return reject(err);
            }

            stdout = stdout.toString('utf-8', 0, stdout.length -
                (stdout[stdout.length-1] === ('\n'.charCodeAt(0)) ? 1 : 0));

            return resolve(stdout);
        });
    });
}
