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
 * Created by rogerk on 7/4/17.
 ******************************************************************************/

export class BackendConfig {
    /**
     * @param {Configuration} config
     * @param {object[]} clusters
     * @param {string} [healthCheck]
     */
    constructor(config, clusters, healthCheck) {
        this.serviceName = config.name;
        this.hostname = config.current.host;
        this.name = this.hostname.replace(/\./g, '-').replace(/[^a-z0-9-]+/gi, '-');
        this.nodePort = config.getNodePort();
        this.timeoutSec = config.current.timeoutSec;
        this.livenessProbe = config.current.livenessProbe;
        this.enableCDN = config.current.enableCDN;
        this.healthCheck = healthCheck || null;
        this.clusters = clusters;
    }

    getInstanceGroups() {
        let all = [];
        Object.keys(this.clusters)
            .forEach(name => {
                this.clusters[name].instanceGroups.forEach(g => all.push(g))
            });
        return all;
    }

    /**
     * Returns the backend configuration
     */
    getBackendConfig() {
        if (!this.healthCheck) {
            throw new Error('healthCheck was not provided.');
        }
        let backends = this.getInstanceGroups()
            .map(group => { return { group: group, balancingMode: 'UTILIZATION', maxUtilization: 0.8 }; });

        return {
            name: this.name,
            description: `Generated backend for ${this.serviceName}`,
            port: this.nodePort,
            portName: this.serviceName + '-port',
            protocol: 'HTTPS',
            enableCDN: this.enableCDN,
            backends: backends,
            healthChecks: [this.healthCheck],
            timeoutSec: this.timeoutSec || 150
        };
    }

    /**
     * Returns null, or an updated configuration if one is needed
     * @param {object} existing backend service definition
     */
    getBackendUpdate(existing) {
        let desired = this.getBackendConfig();
        let updateFields = [];
        // TEST field delta
        Object.keys(desired).forEach(fld => {
            if (!Array.isArray(desired[fld]) && desired[fld] !== existing[fld]) {
                updateFields.push(fld);
            }
        });
        if (JSON.stringify(desired.healthChecks) !== JSON.stringify(existing.healthChecks)) {
            updateFields.push('healthChecks');
        }
        let v1 = JSON.stringify((existing.backends || []).map(b => b.group).sort());
        let v2 = JSON.stringify((desired.backends || []).map(b => b.group).sort());
        if (v1 !== v2) {
            updateFields.push('backends');
        }
        // UPDATE if any modified
        if (updateFields.length === 0) {
            return null;
        }
        return Object.assign({}, existing, desired);
    }
}
