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

import {GoogleDockerRepo} from '../google/googleDockerRepo';
import {GoogleSvcManager} from '../google/googleSvcManager';
import {BackendConfig} from '../config/backendConfig';
import {GoogleNetworking} from '../google/googleNetworking';
import {GoogleLoadBalancer} from '../google/googleLoadBalancer';
import {GoogleKubernetes} from '../google/googleKubernetes';

/**
 * @param {AppState} app
 */
module.exports = async function fullDeploy(app) {
    logger.verbose('starting full deployment', {project: app.config.project, name: app.config.name});

    let repo = new GoogleDockerRepo(app.gauth);
    let endpoints = new GoogleSvcManager(app.gauth);

    let dockerImage, endpointInfo;

    // push docker images & endpoint
    if (!app.args.image) {
        logger.warn('Skipping docker/api push...');
        dockerImage = await repo.getLatestImage(app.config.name, app.args.branch);
        endpointInfo = await endpoints.getLatestEndpoint(app.config.getApiFiles());
    }
    else {
        dockerImage = await repo.pushLocalImage(app.args.image, app.config.name, app.args.branch, app.config.getDockerTagFormat());
        endpointInfo = await endpoints.deployEndpoint(app.config.getApiFiles());
    }

    let networking = new GoogleNetworking(app.gauth);
    let loadBalancer = new GoogleLoadBalancer(app.gauth);
    let googKube = new GoogleKubernetes(app.gauth, app.config);

    // Step - create environment
    await networking.getNetwork(app.config.current.network, true);
    // Step - create clusters
    let clusters = await googKube.getClusters(true);
    // Step - deploy images
    await googKube.deployAll(app.config.name, dockerImage, endpointInfo, clusters);
    // Step - configure load balancer
    let backendConfig = new BackendConfig(app.config, clusters);
    await loadBalancer.execScript({
            scriptFile: app.config.current.loadBalancerTemplate,
            scriptName: 'httpsLoadBalancer',
            mode: 'create'
        },
        backendConfig);
};
