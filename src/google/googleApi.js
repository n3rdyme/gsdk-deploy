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
import * as os from 'os';
import * as path from 'path';
import * as google from 'googleapis';

import {logger} from '../util/logger';
import * as shell from '../util/shell';

export class GoogleApi {
    /**
     * @param {string} gcloud
     * @param {string} project
     */
    constructor(gcloud, project) {
        this.gcloud = gcloud;
        this.project = project;
        this.compute = google.compute('v1');
        this.container = google.container('v1');
    }

    /**
     * Upgrades the sdk components if desired.
     */
    async upgradeSdk() {
        logger.info('Updating gcloud sdk...');
        try { await shell.exec(`${this.gcloud} --quiet components update`, { direct: 'silly' }); }
        catch (ex) {
            logger.verbose('Failed to update gcloud sdk.', ex);
        }
        logger.info('Updating kubectrl sdk...');
        try { await shell.exec(`${this.gcloud} --quiet components update kubectl`, { direct: 'silly' }); }
        catch (ex) {
            logger.verbose('Failed to update gcloud sdk.', ex);
        }
    }

    /**
     * Demand authenticates with google
     * @param {Arguments} args
     */
    async authenticate(args) {
        if (args.autoUpgrade) {
            await this.upgradeSdk();
        }
        let versions = {};
        let text = await shell.exec(`${this.gcloud} version`);
        logger.silly('gcloud version:\n' + text);
        text.split('\n').map(line => line.match(/^(\w.*)\s+(\d[^\s]*)$/)).filter(l => l)
            .forEach(m => versions[m[1]] = m[2]);

        let gsdkVer = versions['Google Cloud SDK'];
        delete versions['Google Cloud SDK'];
        logger.debug(`Google Cloud SDK Version = ${gsdkVer}`);
        logger.verbose('component versions', versions);

        if (args.authEnv) {
            if (!process.env.hasOwnProperty(args.authEnv)) {
                throw new Error('Authentication environment not found: ' + args.authEnv);
            }
            let tmpdir = path.join(os.homedir(), '.gcloud-key');
            if (!fs.existsSync(tmpdir)) fs.mkdirSync(tmpdir);
            let jsonToken = JSON.parse(Buffer.from(process.env[args.authEnv], 'base64').toString('utf8'));
            args.authFile = path.join(tmpdir, args.authEnv.toLowerCase() + '.json');
            fs.writeFileSync(args.authFile, JSON.stringify(jsonToken));
        }

        if (args.authFile) {
            if (!fs.existsSync(args.authFile)) {
                throw new Error('Unable to locate authentication file: ' + args.authFile);
            }
            await shell.exec(`${this.gcloud} auth activate-service-account --key-file ${args.authFile}`, { direct: 'debug' });
            process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(args.authFile);
        }
    }

    async selectProject(project) {
        // Set default project:
        this.project = project;
        logger.info('Connecting to project ' + project);
        await shell.exec(`${this.gcloud} config set project ${project}`, {direct: 'verbose'});

        let auth = await new Promise(function (resolve, reject) {
            google.auth.getApplicationDefault(function (err, auth, projectId) {
                if (err) {
                    logger.error('google.auth.getApplicationDefault', err);
                    return reject(err);
                }
                if (project !== projectId) {
                    logger.warn(`Expected project ${project}, authenticated on ${projectId} instead.`);
                }
                resolve(auth);
            });
        });

        if (auth.createScopedRequired && auth.createScopedRequired()) {
            auth = auth.createScoped([
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/compute'
            ]);
        }

        this.compute = google.compute({
            version: 'v1',
            auth: auth,
            project: project
        });
        this.container = google.container({
            version: 'v1',
            auth: auth,
            project: project
        });
    }
}
