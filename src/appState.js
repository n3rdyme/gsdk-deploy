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

import {Arguments} from './config/arguments';
import {Configuration} from './config/configuration';
import {GoogleApi} from './google/googleApi';

export class AppState {
    constructor(argv) {
        this.args = new Arguments();
        let args = this.args;
        args.parse(argv);

        if (!args.command || args.command === 'help' || args.hasOwnProperty('help') || args.hasOwnProperty('?')) {
            args.command = 'help';
            return;
        }

        this.config = new Configuration(args);
        this.gauth = new GoogleApi(this.args.gcloud, this.config.project);
    }

    async init() {
        if (this.gauth) {
            await this.gauth.authenticate(this.args);
            await this.gauth.selectProject(this.config.project);
        }
    }
}
