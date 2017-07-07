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

import * as fs from 'fs';
import * as path from 'path';
import {logger} from '../util/logger';
import * as shell from '../util/shell';
import {promisify} from '../util/callback';
import {replaceInText} from '../util/templateArg';
import {GoogleAsyncTask} from '../google/googleAsyncTask';
import {KubernetesControl} from './kubernetesControl';

export class GoogleKubernetes {
    /**
     * @param {GoogleApi} gauth
     * @param {Configuration} config
     */
    constructor(gauth, config) {
        this.gauth = gauth;
        this.config = config;
    }

    /**
     * @param {string} name - name of the service
     * @param {string} dockerImage
     * @param {{name: string, version: string}} endpointInfo
     * @param {object} clusters - map from result of getClusters
     */
    async deployAll(name, dockerImage, endpointInfo, clusters) {
        let clusterNames = Object.keys(clusters);
        let deployments = [];
        let serviceConfig = {
            name: name,
            image: dockerImage,
            endpointName: endpointInfo.name,
            endpointVersion: endpointInfo.version
        };

        for (let ix = 0; ix < clusterNames.length; ix++) {
            let cName = clusterNames[ix];
            let cluster = clusters[cName];
            let kubectl = await this.getKubeController(cluster);
            deployments.push(await kubectl.deployImage(serviceConfig));
            await this.configureNamedPort(cluster);
        }

        return deployments;
    }

    /**
     * Returns an authenticated KubernetesControl object
     * @param {{name: string, zone: string}} cluster
     */
    async getKubeController(cluster) {
        logger.info(`Connecting to cluster ${cluster.name}`);
        await shell.exec(`${this.gauth.gcloud} container clusters get-credentials --quiet ` +
            `--project ${this.gauth.project} --zone ${cluster.zone} ${cluster.name}`, {direct: 'verbose'});

        // Hack for Circle :/
        // If you are using sudo with gcloud and not with kubectl we have to change owner.
        if (this.gauth.gcloud.match(/^sudo/)) {
            await shell.exec('sudo chown -R ubuntu:ubuntu /home/ubuntu/.kube');
            await shell.exec('sudo chown -R ubuntu:ubuntu /home/ubuntu/.config/gcloud/credentials');
        }

        return new KubernetesControl(this.config, cluster);
    }

    /**
     * @param {boolean} createMissing
     */
    async getClusters(createMissing) {
        const self = this;
        let existing = await this.getMatchingClusters();

        let clusters = {};
        let mapCluster = c => {
            clusters[c.name.toLowerCase()] = {
                name: c.name,
                network: c.network,
                zone: c.zone,
                currentNodeCount: c.currentNodeCount,
                instanceGroups: c.instanceGroupUrls.map(url => url.replace(/\/instanceGroupManagers\//g, '/instanceGroups/'))
            }
        };

        existing.forEach(mapCluster);

        let missing = this.config.current.clusters.filter(c => !clusters[c]);
        if (missing.length) {
            logger.verbose('Some clusters are missing.', {existing: Object.keys(clusters), missing: missing});
            if (createMissing) {
                let todo = missing.map(name => self.createCluster(name));
                let results = await Promise.all(todo);
                results.forEach(mapCluster);
            }
        }
        else {
            logger.verbose('Clusters found:', {existing: Object.keys(clusters)});
        }

        logger.silly('clusters loaded:', {clusters: Object.keys(clusters), expected: this.config.current.clusters});
        Object.assign(this.config.clusters, clusters);
        return clusters;
    }

    getTemplate(name, zone) {
        let text = fs.readFileSync(this.config.current.clusterTemplate).toString();
        let values = {
            CLUSTER_NAME: name,
            NETWORK_NAME: this.config.current.network,
            ZONE_NAME: zone,
            CLUSTER_SIZE: this.config.current.replicas,
            MACHINE_TYPE: this.config.current.machineType,
            DISK_SIZE: this.config.current.diskSizeGb
        };
        text = replaceInText(text, values);
        return JSON.parse(text);
    }

    async createCluster(name) {
        let waiting = new GoogleAsyncTask(this.gauth);

        let req = {
            projectId: this.config.project,
            zone: this.regionZoneByName(name).zone || '-',
        };
        req.resource = this.getTemplate(name, req.zone);
        logger.silly('creating cluster ' + name, req);

        const self = this;
        logger.warn(`Creating cluster ${name}...`);
        let opcreate = await promisify(self.gauth.container.projects.zones.clusters, 'create', req);
        await waiting.completeTask(opcreate);

        // Change to define management policy
        req.clusterId = name;
        req.nodePoolId = 'default-pool';
        req.resource = {
            management: {
                autoUpgrade: this.config.current.autoUpgrade,
                autoRepair: this.config.current.autoRepair
            }
        };

        logger.info(`Updating management policy ${name}...`);
        let opupdate = await promisify(self.gauth.container.projects.zones.clusters.nodePools, 'setManagement', req);
        await waiting.completeTask(opupdate);

        return this.getClusterByName(name);
    }

    /**
     * Filters the existing clusters by those that match the configuration
     */
    async getMatchingClusters() {
        let clusters = await this.getAllExistingClusters();
        let filter = {};
        this.config.current.clusters.forEach(cname => {filter[cname] = true});
        return clusters.filter(c => filter[c.name.toLowerCase()]);
    }

    /**
     * Returns all clusters that exist in the project
     */
    async getAllExistingClusters() {
        let req = {
            projectId: this.config.project,
            zone: '-'
        };
        let result = await promisify(this.gauth.container.projects.zones.clusters, 'list', req);
        return result.clusters || [];
    }

    /**
     * Returns a given cluster by name
     */
    async getClusterByName(name) {
        let req = {
            projectId: this.config.project,
            zone: this.regionZoneByName(name).zone || '-',
            clusterId: name
        };
        return promisify(this.gauth.container.projects.zones.clusters, 'get', req);
    }

    /**
     * @param {{zone: string, instanceGroups: string[]}} cluster
     * @param {{name: string, port: number}} [port]
     */
    async configureNamedPort(cluster, port) {
        const self = this;

        if (!port) {
            port = {
                name: this.config.name + '-port',
                port: this.config.getNodePort()
            };
        }

        for (let ix = 0; ix < cluster.instanceGroups.length; ix++) {
            let grp = cluster.instanceGroups[ix];
            let fetch = {
                project: this.config.project,
                zone: cluster.zone,
                instanceGroup: path.basename(grp),
            };

            let groupInfo = await promisify(self.gauth.compute.instanceGroups, 'get', fetch);

            //Create a named port to use later:
            if (groupInfo.namedPorts &&
                groupInfo.namedPorts.filter(p => p.name === port.name && p.port === port.port).length > 0) {
                continue;// already set, next group...
            }

            logger.info(`Updating named port on ${fetch.instanceGroup} with ${port.name} = ${port.port}`);
            let namedPorts = (groupInfo.namedPorts || []).filter(p => p.name !== port.name).concat(port);
            let req = {
                project: this.config.project,
                zone: cluster.zone,
                instanceGroup: path.basename(grp),
                resource: {
                    namedPorts: namedPorts,
                    fingerprint: groupInfo.fingerprint
                }
            };

            await promisify(self.gauth.compute.instanceGroups, 'setNamedPorts', req);
        }
    }

    /**
     * @param {string} name
     * @returns {{region: string, zone: string}}
     */
    regionZoneByName(name) {
        let m = name.match(/([a-z]+-(north|south|east|west|central)+\d{1,2})-[a-z]/);
        return {
            region: m ? m[1] : null,
            zone: m ? m[0] : null
        };
    }
}
