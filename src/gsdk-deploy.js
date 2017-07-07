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

import {AppState} from './appState';

let methods = {
    'test-config': require('./commands/testConfig'),
    'full-deploy': require('./commands/fullDeploy'),
    'kube-images': require('./commands/kubeGetImages'),
    'list-images': require('./commands/listAllImages'),
    'image-list': require('./commands/listAllImages'),
    'kube-status': require('./commands/kubeStatus'),
    'kube-rollback': require('./commands/rollbackDeploy'),
    'deploy-api': require('./commands/deployApi'),
    'deploy-tag': require('./commands/deployTag'),
    'deploy-image': require('./commands/deployImage'),
    'remove-deployment': require('./commands/removeDeployment'),
    'view-logs': require('./commands/view-logs'),
    'logs': require('./commands/view-logs'),
    'help': require('./commands/help')
};

module.exports = async function _main(argv) {
    const app = new AppState(argv);
    await app.init();

    let cmd = methods[app.args.command];
    if (!cmd) {
        throw new Error(`unknown command: "${app.args.command}", use -help for usage.`);
    }

    await cmd(app);
};

