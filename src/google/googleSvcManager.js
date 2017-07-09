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
import * as YAML from 'yamljs';
import {logger} from '../util/logger';
import * as shell from '../util/shell';

export class GoogleSvcManager {
    /**
     * @param {GoogleApi} gauth
     */
    constructor(gauth) {
        this.gauth = gauth;
    }

    /**
     * @param {string[]} fileNames
     */
    async deployEndpoint(fileNames) {

        let endpoint = { name: undefined, version: undefined, grpc: undefined };
        if (fileNames.length > 0) {
            logger.info('Updating endpoint...');

            let loadedYaml = fileNames.filter(p => p.match(/.ya?ml$/)).map(p => YAML.load(p));
            let loadedJson = fileNames.filter(p => p.match(/.json$/)).map(p => JSON.parse(fs.readFileSync(p)));
            endpoint.grpc = loadedYaml.concat(loadedJson).filter(p => (p.type === 'google.api.Service' && p.name)).length > 0;

            let json = await shell.exec(`${this.gauth.gcloud} service-management deploy ${fileNames.join(' ')} ` +
                    `--project ${this.gauth.project} --format=json`, { direct: 'debug', stdout: () => {} });

            let api = JSON.parse(json);
            process.env.ENDPOINT_NAME = endpoint.name = api.serviceConfig.name;
            process.env.ENDPOINT_VERSION = endpoint.version = api.serviceConfig.id;
            logger.info(`Endpoint version ${endpoint.version} created for ${endpoint.name}`);
        }
        return endpoint;
    }

    /**
     * Returns the latest endpoint descriptor {name: string, version: string}
     * @param {string[]} fileNames
     */
    async getLatestEndpoint(fileNames) {
        if (fileNames.length === 0) {
            return {};// no endpoint
        }

        let loadedYaml = fileNames.filter(p => p.match(/.ya?ml$/)).map(p => YAML.load(p));
        let loadedJson = fileNames.filter(p => p.match(/.json$/)).map(p => JSON.parse(fs.readFileSync(p)));

        let endpoint = loadedYaml.concat(loadedJson)
            .filter(p => (p.type === 'google.api.Service' && p.name) || (p.swagger && p.swagger.toString().match(/^\d/)))
            .filter(p => (p.name && p.name.length > 0) || (p.host && p.host.length > 0))[0];
        if (!endpoint) {
            throw new Error('Unable to locate name in any yaml api config.');
        }
        let isGrpc = endpoint.type === 'google.api.Service';
        endpoint = { name: endpoint.name || endpoint.host };

        let json = await shell.exec(`${this.gauth.gcloud} service-management describe ${endpoint.name} ` +
                `--project ${this.gauth.project} --format=json`);
        let api = JSON.parse(json);
        logger.verbose(`Using endpoint version ${api.serviceConfig.id} of ${api.serviceConfig.name}`);
        process.env.ENDPOINT_NAME = api.serviceConfig.name;
        process.env.ENDPOINT_VERSION = api.serviceConfig.id;
        return {
            name: api.serviceConfig.name,
            version: api.serviceConfig.id,
            grpc: isGrpc
        };
    }
}
