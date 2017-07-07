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

import {logger} from '../util/logger';

export class GoogleAsyncTask {
    /**
     * @param {GoogleApi} gauth
     */
    constructor(gauth) {
        this.gauth = gauth;
    }

    async completeTask(operation) {
        if (!operation) return;
        logger.silly('Waiting for operation', {selfLink: operation.selfLink, targetLink: operation.targetLink});

        const self = this;
        if (operation.kind === 'compute#operation') {
            return new Promise((accept, reject) => {
                self._completeOperation(operation, 'compute', (err, op) => {
                    if (err) return reject(err);
                    accept(op);
                })
            });
        }
        else if (operation.selfLink.match(/https:\/\/container.googleapis.com\//)) {
            return new Promise((accept, reject) => {
                self._completeOperation(operation, 'container', (err, op) => {
                    if (err) return reject(err);
                    accept(op);
                })
            });
        }
        else {
            logger.silly('malformed operation', operation);
            throw new Error('Unknown operation type: ' + operation.kind);
        }
    }

    _completeOperation(op, type, callback) {
        const self = this;
        let waitOn = self.gauth.compute.globalOperations;
        let opQuery = { project: this.gauth.project, operation: op.name };
        if (type === 'container') {
            waitOn = self.gauth.container.projects.zones.operations;
            opQuery = { projectId: this.gauth.project, zone: op.zone, operationId: op.name };
        }

        let iteration = 0;
        logger.debug('begin async wait on global', opQuery);

        function waitForComplete(cb) {
            waitOn.get(opQuery, function(err, status) {
                if (err) return cb(err);
                if (status.status === 'RUNNING' || status.status === 'PENDING') {
                    if (iteration > 900) {// 15m
                        return cb(new Error(`Timeout exceeded waiting for async operation ${op.name}.`));
                    }
                    if (++iteration % 30 === 0) {
                        logger.verbose(`Waiting for async operation ${op.name}`);
                    }
                    return setTimeout(() => waitForComplete(cb), 1000);
                }

                opQuery.status = status.status;
                logger.verbose('completed wait on global', opQuery);
                if (status.status === 'DONE') {
                    cb();
                }
                else {
                    cb(new Error('Operation did not complete successfully.'));
                }
            });
        }
        setTimeout(() => waitForComplete(callback), 1000);
    }

}
