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

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yamljs';

import {logger} from '../util/logger';
import {replaceInObject} from '../util/templateArg';
import {replaceInText} from '../util/templateArg';
import {DeployConfig} from './deployConfig';

export class Configuration {
    /**
     * @param {Arguments} args
     */
    constructor(args) {
        if (!fs.existsSync(args.config)) {
            throw new Error('The configuration file was not found at:\n' + args.config);
        }
        if (!args.branch) {
            throw new Error('Specify a deployment/branch name with -branch=[NAME]');
        }

        /** @type {DeployConfig} */
        this.current = this._readConfig(args.config, args.branch);
        this._stateFile = path.join(args.artifacts, 'deployConfig.json');
        this.save();

        this.current.assertValid();
        this.name = this.current.name;
        this.project = this.current['google-project'];
        this.current.host = this.current.host.toLowerCase();
        this.artifacts = args.artifacts;
        this.clusters = {};

        process.env.GCLOUD_PROJECT = this.project;
        process.env.SERVICE_NAME = this.name;
        process.env.HOSTNAME = this.current.host;
        process.env.NODE_PORT = this.getNodePort();
    }

    /**
     * @private
     * @param {string} fileName
     * @param {string} deployName
     * @returns {DeployConfig}
     */
    _readConfig(fileName, deployName) {
        let cfg;
        let rawCfg = fs.readFileSync(fileName).toString();
        if (fileName.match(/\.json$/)) {
            cfg = JSON.parse(rawCfg);
        }
        else if (fileName.match(/\.ya?ml$/)) {
            cfg = YAML.parse(rawCfg);
        }
        else {
            throw new Error('Unknown configuration type, supported types are (json|yaml).');
        }

        if (!cfg.hasOwnProperty(deployName)) {
            throw(new Error(`The config file does not have a deployment called "${deployName}".`));
        }

        let current = Object.assign({}, cfg[deployName]);
        while (current.extend || current.extends) {
            let baseType = current.extend || current.extends;
            delete current.extend;
            delete current.extends;
            if (!cfg.hasOwnProperty(baseType)) {
                throw(new Error(`The deployment extends unknown deployment called "${baseType}".`));
            }
            current = Object.assign({}, cfg[baseType], current);
        }

        current = Object.assign(new DeployConfig(), current);
        current.path = path.resolve(fileName);

        return current;
    }

    save() {
        fs.writeFileSync(this._stateFile, JSON.stringify(this, null, 2));
    }

    /**
     * @returns {Array} returns an array of {name:string, value: string} objects
     */
    getEnvironment() {
        let hasport = false;

        let env = this.current.env
            .filter(i => typeof item === 'string' || i.name)
            .map(item => {
            if (typeof item === 'string') {
                let m = item.match(/^([\w_-]+)(=(.*))?$/);
                item = {name: m[1]};
                if (typeof m[3] === 'string')
                    item.value = m[3];
            }

            item.name = item.name.toUpperCase();
            if (!item.hasOwnProperty('value')) {
                item.value = '$' + item.name.toUpperCase();
            }
            hasport = hasport || (item.name === 'NODE_PORT');
            return item;
        });
        if (!hasport) {
            env.push({name: 'NODE_PORT', value: this.current.port.toString()});
        }

        env = replaceInObject(env);
        return env;
    }

    /**
     * @returns {number} Returns the specified nodePort or generates one from name
     */
    getNodePort() {
        if (!(this.current.nodePort > 0)) {
            // Compute a nodePort base on hash of the service name
            const crypto = require('crypto');
            const md5sum = crypto.createHash('md5');
            md5sum.update(this.name);
            let digits = md5sum.digest('hex');
            let digit = parseInt(digits.substr(0, 8)) ^ parseInt(digits.substr(8, 8))
                ^ parseInt(digits.substr(16, 8)) ^ parseInt(digits.substr(24, 8));
            this.current.nodePort = 30000 + (digit % 2768);
        }

        if (this.current.nodePort < 30000 || this.current.nodePort > 32767) {
            throw new Error(`The node port ${this.current.nodePort} is invalid.`);
        }
        return this.current.nodePort;
    }

    /**
     * Returns the fully-qualified api source files
     * @returns {string[]}
     */
    getApiFiles() {
        let apiConfig = [].concat(this.current['api-config'] || []);
        let basePath = path.dirname(this.current.path);
        apiConfig = apiConfig.map(pth => path.resolve(basePath, pth));

        for (let ix = 0; ix < apiConfig.length && this.current.endpointFormat; ix++) {
            let fname = apiConfig[ix];
            let fType = fname.match(/.ya?ml$/i) ? YAML : fname.match(/.json$/i) ? JSON : null;
            let cfg = fType ? fType.parse(fs.readFileSync(fname).toString()) : {};
            if (cfg.type === 'google.api.Service') {
                let newPath = path.join(this.artifacts, path.basename(fname));
                cfg.name = replaceInText(this.current.endpointFormat);
                logger.verbose('replaced service endpoint name', { 'new': newPath, old: fname, value: cfg.name });
                fs.writeFileSync(newPath, fType.stringify(cfg, null, 2));
                apiConfig[ix] = newPath;
            }
        }

        return apiConfig;
    }

    /**
     * @returns {string} - The version-specific tag that should be used
     */
    getDockerTagFormat() {
        let tagFormat = this.current.tagFormat;
        if (!tagFormat && process.env.CIRCLE_SHA1 && process.env.CIRCLE_BUILD_NUM) {
            tagFormat = '$BRANCH-$CIRCLE_SHA1-$CIRCLE_BUILD_NUM';
        }
        else if (!tagFormat) {
            tagFormat += '$BRANCH-$BUILD_TIME';
        }
        return tagFormat;
    }
}
