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
import {promisify} from '../util/callback';
import {GoogleAsyncTask} from '../google/googleAsyncTask';

export class GoogleNetworking {
    /**
     * @param {GoogleApi} gauth
     */
    constructor(gauth) {
        this.gauth = gauth;
    }

    /**
     * @param {string} name - name of the network to fetch or create
     * @param {boolean=} create = true to auto-create if missing
     */
    async getNetwork(name, create) {
        let waiting = new GoogleAsyncTask(this.gauth);
        let net = await this._fetchNetwork(name);

        if (!net && create) {
            // Create cloud vpc network
            let task = await this._createNetwork(name);
            await waiting.completeTask(task);
            net = await this._fetchNetwork(name, true);
            // Now create firewall ingress rules...
            task = await this._createFirewallRules(net);
            await waiting.completeTask(task);
        }

        return { name: net.name, selfLink: net.selfLink };
    }

    /**
     * @private
     * @param {string} network
     * @param {boolean=} throwMissing
     */
    async _fetchNetwork(network, throwMissing) {
        let fetch = {project: this.gauth.project, network: network};
        return new Promise((accept, reject) => {
            this.gauth.compute.networks.get(fetch, function (err, network) {
                if (err && (throwMissing || err.code !== 404)) {
                    return reject(err);
                }
                return accept(network);
            });
        });
    }

    /**
     * @param {string} network
     */
    async _createNetwork(network) {
        let createNet = {
            project: this.gauth.project,
            resource: {
                name: network,
                description: 'Kubernetes VPC network',
                autoCreateSubnetworks: true
            }
        };

        const self = this;
        logger.silly('network config', createNet);

        logger.warn(`Creating network ${network}...`);
        return promisify(self.gauth.compute.networks, 'insert', createNet);
    }

    /**
     * @param {object} network
     */
    async _createFirewallRules(network) {
        let createFw = {
            project: this.gauth.project,
            resource: {
                name: `${network.name}-ingress`,
                description: 'Kubernetes VPC firewall rules',
                network: network.selfLink,
                sourceRanges: ['10.0.0.0/8', '130.211.0.0/22', '35.191.0.0/16'],
                sourceTags: [],
                targetTags: ['kube'],
                allowed: [{
                    IPProtocol: 'tcp',
                    ports: ['30000-32767']
                }]
            }
        };

        const self = this;
        logger.silly('firewall config', createFw);
        logger.warn(`Creating firewall ${createFw.resource.name}...`);

        return promisify(self.gauth.compute.firewalls, 'insert', createFw);
    }

}
