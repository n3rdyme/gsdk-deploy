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
import * as path from 'path';
import {replaceInObject} from '../util/templateArg';

/**
 * The configuration of a deployment as read from the configuration file
 */
export class DeployConfig {
    constructor() {
        this.path = ''; // File path to this config
        this.name = '$SERVICE_NAME'; // Kubernetes deploy,svc name
        this['google-project'] = '$GCLOUD_PROJECT'; //Google Project
        this['api-config'] = []; // File paths to api configs
        this.host = '$SERVICE_NAME.whatever.com'; //Hostname used
        this.env =  ['NODE_ENV=BRANCH', 'ENDPOINT_NAME', 'ENDPOINT_VERSION'];
        this.replicas =  2; // Number of replicas in each cluster
        this.clusters =  []; // Names of Kubernetes clusters
        this.nodePort = -1; // Kubernetes Service port 30000 - 32767
        this.network = 'kube-vpc-net'; // Google VPC network name
        this.machineType = 'n1-highmem-2'; // Machine type, n1-standard-1
        this.diskSizeGb = 500; // Hard drive space per node
        this.autoUpgrade = true; // Configure Kubernetes to auto upgrade
        this.autoRepair = true; // Configure Kubernetes to replace broken nodes
        this.port = 8080; // Port number your service listens on
        this.sslPort = 9443; // The SSL port used by esp/sidecar container
        this.enableCDN = true; // Enable CDN on Google's Load Balancer
        this.timeoutSec = 120; // HTTP request timeout on GLB
        this.livenessProbe = '/_ah/health'; // HTTP health probe
        this.readinessProbe = '/_ah/health?isReady=true'; // HTTP health probe
        this.waitTime = 600000; // (10m) time(ms) to wait for deploy completion
        this.tagFormat = ''; // Formatted docker tag unique to revision
        this.endpointFormat = '';  // Formatted name to update api_config.yaml
        this.clusterTemplate = ''; // Templated creation of Kubernetes cluster
        this.deployTemplate = ''; // Templated creation of deployment
        this.serviceTemplate = ''; // Templated creation of service
        this.loadBalancerTemplate = ''; // Templated creation of Load Balancer
        this.proxyImage = '';
    }

    assertValid() {
        // format input parameters
        replaceInObject(this, null, {env: 1, endpointFormat: 1});

        if (Array.isArray(this.hosts)) {
            this.host = this.host || this.hosts[0];
            delete this.hosts;
        }

        if (!this.name.match(/^\w[\w-]{1,64}\w$/)) {
            throw new Error('Invalid service name: ' + this.name);
        }
        if (!this['google-project'].match(/^\w[\w-]{5,64}\w$/)) {
            throw new Error('Invalid google project name: ' + this['google-project']);
        }
        if (!Array.isArray(this.env)) {
            throw new Error('The env configuration must be an array.');
        }
        if (typeof this.host !== 'string' || !(this.host.length > 0)) {
            throw new Error('The host property must include a domain that you have a certificate for.');
        }
        if (!this.network) {
            this.network = 'kube-vpc-net';
        }
        if (!Array.isArray(this.clusters)) {
            throw new Error('Expected an array of cluster names.');
        }
        this.clusters = (this.clusters||[]).filter(n => n.length).map(c => c.toLowerCase());

        this.replicas = parseInt(this.replicas) || 1;
        if (!(this.replicas >= 1)) {
            this.replicas = 1;
        }

        this.clusterTemplate = this.clusterTemplate || path.join(__dirname, '../templates/clusterTemplate.json');
        this.deployTemplate = this.deployTemplate || path.join(__dirname, '../templates/deployment.json');
        this.serviceTemplate = this.serviceTemplate || path.join(__dirname, '../templates/service.json');
        this.loadBalancerTemplate = this.loadBalancerTemplate || path.join(__dirname, '../templates/loadBalancer.json');
    }
}
