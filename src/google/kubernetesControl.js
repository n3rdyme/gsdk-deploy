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
import * as os from 'os';
import * as path from 'path';
import {logger} from '../util/logger';
import * as shell from '../util/shell';
import {replaceInText} from '../util/templateArg';

export class KubernetesControl {
    /**
     * @param {Configuration} config
     * @param {{name: string, zone: string}} cluster
     */
    constructor(config, cluster) {
        this.config = config;
        this.cluster = cluster;
        this.kubectl = process.env.KUBECTL_COMMAND || 'kubectl';
    }

    /**
     * Reports the state of the named deployment to the console
     * @param {string} name
     */
    async reportStatus(name) {
        let depState = JSON.parse(await shell.exec(`${this.kubectl} get deploy/${name} -o=json`));
        depState = depState || {};
        depState.status = depState.status || {};

        logger.info(`${this.cluster.name} has ${depState.status.replicas||0} replicas, ${depState.status.unavailableReplicas||0} unavailable.`);
        let podState = JSON.parse(await shell.exec(`${this.kubectl} get pod -o=json`));
        podState = podState || {};
        podState.items = podState.items || [];

        podState = podState.items.filter(pod =>
            pod.metadata.labels.app === name ||
            pod.metadata.name.substr(name.length) === name
        );

        let messages = [];
        for(let ix=0; ix < podState.length; ix++) {
            logger.info(`${podState[ix].metadata.name} phase = ${podState[ix].status.phase}`);
            let podMsgs = KubernetesControl.allmessages(podState[ix].status, []);
            podMsgs.forEach(msg => logger.warn(msg));
            messages = messages.concat(podMsgs)
        }
        return messages;
    }

    /**
     * returns the full configuration of a deployment
     */
    async getDeploy(name) {
        let json = await shell.exec(`${this.kubectl} get deploy ${name} -o=json`);
        return JSON.parse(json);
    }

    /**
     * @param {{name, image, endpointName, endpointVersion, protocol, proxyImage}} service
     */
    async deployImage(service) {
        logger.verbose(`Preparing to deploy ${service.name} on ${this.cluster.name}.`, {image: service, apiVer: service.endpointVersion});

        let tempPath = this.config.current.path;
        let svcConfig = path.join(tempPath, service.name + '-svc.json');
        let svcTemplate = this.getServiceTemplate(service.name);
        fs.writeFileSync(svcConfig, JSON.stringify(svcTemplate, null, 2));

        let depConfig = path.join(tempPath, service.name + '-deploy.json');
        let deployTemplate = this.getDeployTemplate(service.name, service.image, service.endpointName, service.endpointVersion, service.protocol, service.proxyImage);
        fs.writeFileSync(depConfig, JSON.stringify(deployTemplate, null, 2));

        // Install the ssl certificate if missing
        await this.addSslSecret('nginx');
        // Deploy service
        logger.info(`Deploying service ${service.name} to ${this.cluster.name}...`);
        await shell.exec(`${this.kubectl} apply -f ${svcConfig}`, {direct: true});
        // Deploy container
        logger.info(`Deploying container ${service.name} to ${this.cluster.name}...`);
        await shell.exec(`${this.kubectl} apply -f ${depConfig}`, {direct: true});

        try {
            await this.waitForRollout(service.name, this.config.current.waitTime);
        }
        catch (err) {
            logger.error('Rolling back due to: ' + err.message);
            await this.reportStatus(service.name);
            await this.rollbackOnce(service.name);
            throw err;
        }
    }

    /**
     * Updates only the running image on a cluster
     * @param {string} name
     * @param {string} image
     * @param {number} timeout
     */
    async updateImage(name, image, timeout) {
        await shell.exec(`${this.kubectl} set image deploy/${name} ${name}=${image}`);
        try {
            await this.waitForRollout(name, timeout);
        }
        catch (err) {
            logger.error('Rolling back due to: ' + err.message);
            await this.reportStatus(name);
            await this.rollbackOnce(name);
            throw err;
        }
    }

    /**
     * @param {string} name
     * @param {number=} timeout
     */
    async rollbackDeploy(name, timeout) {
        logger.warn(`Rolling back ${name} on ${this.cluster.name}`);
        await shell.exec(`${this.kubectl} rollout undo deploy/${name}`, {direct: true});
        return this.waitForRollout(name, timeout);
    }

    /**
     * @param {string} name
     */
    async removeService(name) {
        logger.warn(`Removing service ${name} on ${this.cluster.name}`);
        await shell.exec(`${this.kubectl} delete service ${name}`, {direct: true});
    }

    /**
     * @param {string} name
     */
    async removeDeployment(name) {
        logger.warn(`Removing deployment ${name} on ${this.cluster.name}`);
        await shell.exec(`${this.kubectl} delete deploy ${name}`, {direct: true});
    }

    /**
     * @param {string} name
     * @param {number} timeout
     */
    async waitForRollout(name, timeout) {
        let self = this;
        if (!(timeout > 0)) {
            logger.debug('Skipping rollout verify, waitTime <= 0');
            return;
        }

        let startTime = Date.now();
        logger.verbose(`Waiting on rollout for ${name} on ${this.cluster.name}`);
        return new Promise(async (accept, reject) => {
            let cancelled = false;
            let timerId = setTimeout(() => {
                cancelled = true;
                let timeTaken = parseInt((Date.now() - startTime) / 1000);
                reject(new Error(`Timeout exceeded (${timeTaken} seconds).`));
            }, timeout);

            await shell.exec(`${this.kubectl} rollout status deploy/${name}`, {direct: true});
/*
 * Race condition: all pods may be alive, but not health-checked and kube reports no errors.
 * To reduce false-positives, it requires 3 consecutive success results.
 */
            const successTarget = 3;
            let successCount = 0;
            let faultCount = 0;
            logger.debug('Rollout completed, checking pods...');
            let checkPodStatus = function () {
                if (cancelled) return;
                self.getPodMessages(name)
                    .then(pods => {
                        if (cancelled) return;
                        if (pods.length === 0) {
                            if (++successCount >= successTarget) {
                                logger.silly('Target success count reached: ' + successCount);
                                let timeTaken = parseInt((Date.now() - startTime) / 1000);
                                logger.debug(`Rollout successful after ${timeTaken} seconds.`);
                                clearTimeout(timerId);
                                return accept();
                            }
                        }
                        else {
                            successCount = 0;
                        }
                        logger.silly('waiting on pods', {pods: pods});
                        if (pods.length > 0 && ++faultCount % 3 === 0)
                            logger.debug(`Waiting on ${pods[0].name}: ${pods[0].msgs[0]}`);
                        setTimeout(checkPodStatus, 10000);
                    })
                    .catch(ex => reject(ex));
            };

            checkPodStatus();
        });
    }

    /**
     * @param {string} name
     */
    async getPodMessages(name) {
        let podState = JSON.parse(await shell.exec(`${this.kubectl} get pod -o=json`));
        podState = podState || {};
        podState = podState.items || [];

        podState = podState.filter(pod => pod.metadata.labels.app === name);
        podState = podState.map(pod => {
            return {
                name: pod.metadata.name,
                msgs: KubernetesControl.allmessages(pod.status, [])
            };
        });
        podState = podState.filter(pod => pod.msgs.length);
        return podState;
    }

    /**
     * @param {string} name
     */
    async rollbackOnce(name) {
        logger.warn(`Rolling back ${name} on ${this.cluster.name}`);
        return shell.exec(`${this.kubectl} rollout undo deploy/${name}`, { direct: true });
    }

    /**
     * Returns the service config
     */
    getServiceTemplate(name) {
        let text = fs.readFileSync(this.config.current.serviceTemplate).toString();
        let values = {
            SERVICE_NAME: name,
            SSL_PORT: this.config.current.sslPort,
            NODE_PORT: this.config.getNodePort()
        };
        text = replaceInText(text, values);
        return JSON.parse(text);
    }

    /**
     * Returns the deploy config
     */
    getDeployTemplate(name, image, epName, epVersion, protocol, epImage) {
        process.env.ENDPOINT_NAME = epName;
        process.env.ENDPOINT_VERSION = epVersion;

        let text = fs.readFileSync(this.config.current.deployTemplate).toString();
        let values = {
            SERVICE_NAME: name,
            REPLICAS: this.config.current.replicas,
            DOCKER_IMAGE: image,
            APP_PROTOCOL: protocol,
            APP_PORT: this.config.current.port,
            SSL_PORT: this.config.current.sslPort,
            ENDPOINT_NAME: epName,
            ENDPOINT_VERSION: epVersion,
            PROXY_IMAGE: epImage,
            LIVENESS_PROBE: this.config.current.livenessProbe,
            READINESS_PROBE: this.config.current.readinessProbe,
        };
        text = replaceInText(text, values);
        let template = JSON.parse(text);
        template.spec.template.spec.containers[0].env = this.config.getEnvironment();
        return template;
    }

    /**
     * Generates an ssl key-pair and installs to the specified secret name
     * @param {string} name
     */
    async addSslSecret(name) {
        try {
            await shell.exec(`${this.kubectl} get secrets ` + name, { direct: 'silly' });
            return;
        }
        catch (err) { /* no-op */ }

        let tmpdir = path.join(os.homedir(), '.temp-ssl');
        if (!fs.existsSync(tmpdir)) fs.mkdirSync(tmpdir);

        let keyfile = path.join(tmpdir, name + '.key');
        let crtfile = path.join(tmpdir, name + '.crt');

        // Make sure openssl is installed.
        logger.warn(`Generating missing SSL certificate ${name} on ${this.cluster.name}.`, {name: name});
        try { await shell.exec('openssl version', { direct: 'verbose' }); }
        catch(ex) {
            logger.warn('OpenSSL utility missing, installing...');
            await shell.exec('sudo apt-get install openssl -y', {direct: true});
        }

        await shell.exec(
            'openssl req -x509 -nodes -days 1825 -newkey rsa:2048 ' +
            '-subj /C=US/ST=Delaware/L=Dover/O=ops/OU=dev/CN=example.org ' +
            `-keyout ${keyfile} -out ${crtfile}`,
            { direct: 'debug' }
        );

        await this.installSecret(name, [keyfile, crtfile]);
    }

    /**
     * Installs a set of files as a named secret
     * @param {string} name
     * @param {string[]} files
     */
    async installSecret(name, files) {
        // Install the secret ...
        logger.warn('Installing secret: ' + name);
        let fileArgs = files.map(f => '--from-file=' + f).join(' ');
        return shell.exec(`${this.kubectl} create secret generic ${name} ${fileArgs}`);
    }

    /**
     * @returns {string[]} returns any values of fields called 'message' recursively
     */
    static allmessages(obj, result) {
        if (obj && obj.message) result.push((obj.reason ? (obj.reason + ': ') : '') + obj.message);
        if (Array.isArray(obj)) obj.forEach(ch => KubernetesControl.allmessages(ch, result));
        else if (typeof obj === 'object') Object.keys(obj||{}).forEach(k => KubernetesControl.allmessages(obj[k], result));
        return result;
    }
}
