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

import * as fs from 'fs';
import * as pem from 'pem';
import {logger} from '../util/logger';
import {promisify} from '../util/callback';
import {replaceInObject} from '../util/templateArg';
import {GoogleAsyncTask} from '../google/googleAsyncTask';

export class GoogleLoadBalancer {
    /**
     * @param {GoogleApi} gauth
     */
    constructor(gauth) {
        this.gauth = gauth;
        this.wait = new GoogleAsyncTask(this.gauth);
        // These methods are used in scripts
        [this.checkDnsEntry, this.configureBackend, this.selectCertificate].toString();
    }

    /**
     * @param {{scriptFile: string, scriptName: string, mode: string}} scriptInfo
     * @param {BackendConfig} backendConfig
     */
    async execScript(scriptInfo, backendConfig) {
        let script = JSON.parse(fs.readFileSync(scriptInfo.scriptFile));
        script = script[scriptInfo.scriptName];
        if (!script || !Array.isArray(script)) {
            throw new Error('Unable to locate script: ' + scriptInfo.scriptName);
        }
        // For delete, play backwards
        if (scriptInfo.mode === 'delete') {
            script = script.reverse();
        }
        let state = {
            NAME: backendConfig.name,
            HOSTNAME: backendConfig.hostname,
            NODE_PORT: backendConfig.nodePort,
            SERVICE_NAME: backendConfig.serviceName,
            LIVENESSPROBE: backendConfig.livenessProbe,
        };
        for (let ix = 0; ix < script.length; ix++) {
            let taskSet = script[ix];
            let taskKeys = Object.keys(taskSet);
            for (let ixt = 0; ixt < taskKeys.length; ixt++) {
                let task = Object.assign({}, taskSet[taskKeys[ixt]], {type: taskKeys[ixt], mode: scriptInfo.mode});
                if (scriptInfo.mode !== 'create') {
                    delete task.create;
                    delete task.params;
                }
                let result = await this.execTask(replaceInObject(task, state), backendConfig);
                if (result && result.hasOwnProperty(task.returns))
                    state[taskKeys[ixt].toUpperCase()] = result[task.returns];
            }
        }
    }

    /**
     *
     * @param {{type, mode, fetch, create, invoke, preserve, params}} task
     * @param {BackendConfig} backendConfig
     */
    async execTask(task, backendConfig) {
        logger.verbose('starting compute task:', task);
        let {type, mode, fetch, create, invoke} = task;
        let verb = 'get';
        if (mode === 'delete') {
            if (task.preserve || !task.fetch) return;
            logger.warn(`Removing ${type} for ${task.fetch[Object.keys(task.fetch)[0]]}`);
            verb =  'delete';
        }
        let result = null;
        try {
            if (fetch) {
                fetch.project = this.gauth.project;
                result = await promisify(this.gauth.compute[type], verb, fetch);
            }
        }
        catch (ex) {
            if (ex.code !== 404) {
                logger.error(`Unable to get ${type} matching: ${JSON.stringify(fetch)}`);
                throw ex;
            }
            logger.verbose(`${type} not found`, fetch);
        }
        if (mode === 'delete' && result && !task.preserve) {
            await this.wait.completeTask(result);
            result = null;
        }
        if (mode !== 'delete' && invoke) {
            result = await this[invoke](backendConfig, task.params, result);
        }
        if (mode === 'create' && !result && create) {
            logger.warn(`Creating ${type}...`, fetch);
            let req = { project: this.gauth.project, resource: create };
            result = await promisify(this.gauth.compute[type], 'insert', req);
            await this.wait.completeTask(result);
            result = await promisify(this.gauth.compute[type], 'get', fetch);
        }
        logger.silly('compute task result', {type: type, result: result});
        return result;
    }

    /**
     * @param {BackendConfig} backendConfig
     * @param {{host, address}} params
     */
    async checkDnsEntry(backendConfig, params) {
        let actual;
        try { actual = await promisify(require('dns'), 'lookup', params.host, {family: 4}); }
        catch (ex) {
            actual = `[${ex.code || ex.message}]`;
            logger.silly(`dns lookup error: ${params.host}`, ex);
        }
        if (actual !== params.address) {
            logger.warn(`Missing DNS record: ${params.host} = ${params.address}`);
        }
    }

    /**
     * Create the backend service description
     * @param {BackendConfig} backendConfig
     * @param {{healthCheck: string}} params
     */
    async configureBackend(backendConfig, params) {
        backendConfig.healthCheck = params.healthCheck;
        let fetch = { project: this.gauth.project, backendService: backendConfig.name };
        let backend = null;
        try { backend = await promisify(this.gauth.compute.backendServices, 'get', fetch); }
        catch (ex) {
            if (ex.code !== 404) throw ex;
        }

        if (!backend) {
            let create = {
                project: this.gauth.project,
                resource: backendConfig.getBackendConfig()
            };
            logger.warn(`Creating service backend ${backendConfig.name}...`);
            let op = await promisify(this.gauth.compute.backendServices, 'insert', create);
            await this.wait.completeTask(op);
            backend = await promisify(this.gauth.compute.backendServices, 'get', fetch);
        }
        else {
            let update = {
                project: this.gauth.project,
                backendService: backendConfig.name,
                resource: backendConfig.getBackendUpdate(backend)
            };
            if (update.resource !== null) {
                logger.warn(`Updating service backend ${backendConfig.name}...`);
                let op = await promisify(this.gauth.compute.backendServices, 'update', update);
                await this.wait.completeTask(op);
                backend = await promisify(this.gauth.compute.backendServices, 'get', fetch);
            }
        }
        return backend;
    }

    /**
     * Finds the certifcate that best matches a hostname
     * @param {BackendConfig} backendConfig
     */
    async selectCertificate(backendConfig) {
        let dnsmap = await this.loadCertificateMap();
        let certKey = backendConfig.hostname.toLowerCase();
        if (!dnsmap[certKey]) {
            certKey = certKey.split('.');
            certKey[0] = '*';
            certKey = certKey.join('.');
        }
        if (!dnsmap[certKey]) {
            throw new Error(`Unable to locate a certificate for ${backendConfig.hostname}.`);
        }
        let cert = Object.assign({}, dnsmap[certKey]);
        cert.domain = certKey;
        logger.verbose(`Using certifcate ${certKey} for ${backendConfig.hostname}.`);
        return cert;
    }

    /**
     * Loads the available ssl certs from Networking->Load Balancing->Advanced->Certificates
     */
    async loadCertificateMap() {
        let req = {project: this.gauth.project};
        logger.verbose('Fetching certificates list...');
        let coll = await GoogleLoadBalancer.fetchList(req, this.gauth.compute.sslCertificates);
        logger.silly(`Found ${coll.length} certificate(s).`);

        let parsers = coll.map(cert => {
            return new Promise((accept, reject) => {
                pem.readCertificateInfo(cert.certificate, (err, data) => {
                    if (err) return reject(err);
                    let names = [data.commonName];
                    if (data.san && Array.isArray(data.san.dns)) {
                        names = data.san.dns;
                    }
                    return accept({name: cert.name, selfLink: cert.selfLink, dns: names});
                });
            });
        });

        let dnsMap = {};
        let certificates = await Promise.all(parsers);
        certificates.forEach(e => {
            logger.silly(`Found cert ${e.name} for domains ${e.dns.join(',')}`);
            e.dns.forEach(dns => {
                dnsMap[dns] = {name: e.name, selfLink: e.selfLink};
            });
        });
        logger.verbose(`Found ${certificates.length} certificates.`, dnsMap);
        return dnsMap;
    }

    /**
     * @param {{project: string}} request - the request object for the collection
     * @param {{list: function}} coll - the compute.* member containing the list method
     */
    static async fetchList(request, coll) {
        let found = [];
        let page = {nextPageToken: 'first'};

        while (page && page.nextPageToken) {
            logger.silly('fetching list, page = ' + page.nextPageToken);
            page = await promisify(coll, 'list', request);
            found = found.concat(page.items || []);
            request.pageToken = page.nextPageToken;
        }

        return found;
    }
}
