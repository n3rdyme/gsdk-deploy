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
import {BackendConfig} from '../config/backendConfig';
import {GoogleLoadBalancer} from '../google/googleLoadBalancer';
import {GoogleKubernetes} from '../google/googleKubernetes';


/**
 * @param {AppState} app
 */
module.exports = async function fullDeploy(app) {
    logger.verbose('removing deployment', {project: app.config.project, name: app.config.name});

    let loadBalancer = new GoogleLoadBalancer(app.gauth);
    let googKube = new GoogleKubernetes(app.gauth, app.config);

    // visit existing clusters and remove the service and deployment
    let clusters = await googKube.getClusters(false);

    let names = Object.keys(clusters);

    await confirm(`Removing ${app.config.name} from:\n  ${names.join('\n  ')}`);

    for (let ix = 0; ix < names.length; ix++) {
        let cluster = clusters[names[ix]];
        try {
            let kubectl = await googKube.getKubeController(cluster);
            await kubectl.removeService(app.config.name);
            await kubectl.removeDeployment(app.config.name);
        }
        catch (ex) {
            logger.error('Unable to remove from cluster ' + names[ix]);
            logger.verbose(ex);
        }
    }

    await confirm(`Removing ${app.config.current.host} load balancer and IP Address.`);

    // Step - configure load balancer
    let backendConfig = new BackendConfig(app.config, clusters);
    await loadBalancer.execScript({
            scriptFile: app.config.current.loadBalancerTemplate,
            scriptName: 'httpsLoadBalancer',
            mode: 'delete'
        },
        backendConfig);
};


async function confirm(prompt) {
    const colors = require('colors');
    const yesno = require('yesno');

    if (process.argv.find(arg => arg.match(/^--?confirm/))) {
        return true;
    }

    return await new Promise((accept, reject) => {
        prompt = colors.dim.cyan(`\n${prompt}\nContinue [y/N]?`);
        yesno.ask(prompt, false, ok => {
            if(!ok) return reject(new Error('Operation cancelled.'));
            else accept(true);
        });
    });
}
