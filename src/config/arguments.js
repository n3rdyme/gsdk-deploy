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
 * Created by vroomlabs on 7/2/17.
 ******************************************************************************/

import * as path from 'path';
import {getArtifactsFolder} from '../util/artifacts';
import {replaceInText} from '../util/templateArg';

export class Arguments {
    constructor() {
        this.command = '';
        this.branch = '';
        this.artifacts = '';
        this.image = 'user/build';
        this.authEnv = null; // parsed as auth-env
        this.authFile = null;// parsed as auth-file
        this.config = './deploy.yaml';
        this.baseDir = process.cwd();// parsed as base-dir

        // TOOLS:
        this.gcloud = 'gcloud';
        if (Arguments.isCircleCI()) {
            this.gcloud = 'sudo /opt/google-cloud-sdk/bin/gcloud';
        }

        this.gcloud = process.env.GCLOUD_COMMAND || this.gcloud;
        this.autoUpgrade = process.env.AUTO_UPDATE_SDK === 'true' || Arguments.isCircleCI();
    }

    /**
     * @param {string[]} params
     */
    parse(params) {
        for (let ix=0; ix < params.length; ix++) {
            let param = params[ix];
            let m = param.match(/^--?([?\w_-]+)([:=](.*))?$/);
            if (m) {
                let name = m[1].toLowerCase();
                let val = m[3];
                while((m = name.match(/-(\w)/))) {
                    name = name.replace(/-\w/g, m[1].toUpperCase());
                }
                this[name] = val;
            }
            else {
                if (this.command) {
                    throw new Error(`Unable to process both commands: ${this.command} and ${param}`);
                }
                this.command = param.toLowerCase();
            }
        }

        Object.keys(this).forEach(k => {
            this[k] = typeof this[k] !== 'string' ? this[k] : replaceInText(this[k]);
        });

        this.config = path.resolve(this.baseDir, this.config);
        this.artifacts = getArtifactsFolder();

        process.env.BRANCH = this.branch;
        process.env.ARTIFACTS = this.artifacts;
        process.env.BUILD_TIME = new Date().toISOString().replace(/[^\w]+/gi, '-').replace(/^-|-$/g,'');
    }

    static isCircleCI() {
        return ((process.env.CIRCLECI || process.env.CI) === 'true');
    }
}
