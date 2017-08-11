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
import * as shell from '../util/shell';
import {replaceInText} from '../util/templateArg';

export class GoogleDockerRepo {
    /**
     * @param {GoogleApi} gauth
     * @param {string=} dockerCmd
     */
    constructor(gauth, dockerCmd) {
        this.gauth = gauth;
        this.docker = dockerCmd || process.env.DOCKER_COMMAND || 'docker';
    }

    /**
     * @param {string} project
     * @param {string} repo
     * @param {string=} tag
     */
    getUri(project, repo, tag) {
        return `us.gcr.io/${project}/${repo}` + (tag ? (':' + tag) : '');
    }

    /**
     * @param {string} uri
     * @param {number} limit
     * @param {string} filter
     */
    async getImages(uri, limit, filter) {
        let response = await shell.exec(
            `${this.gauth.gcloud} --quiet container images list-tags ${uri} --format=json` +
            (limit>0 ? ` --limit=${limit}` : '') +
            (filter  ? ` --filter=tags:${filter}` : '')
        );
        return JSON.parse(response);
    }

    /**
     * Returns the most recent image url for the given repo/branch
     * @param {string} repo
     * @param {string} branch
     */
    async getLatestImage(repo, branch) {
        let uribase = this.getUri(this.gauth.project, repo);
        let images = await this.getImages(uribase, 1, branch + '-');
        if (!(images.length > 0)) {
            throw new Error('No images found in: ' + uribase);
        }

        let img = images[0];
        let imgTag = (img.tags && img.tags.length > 0) ? img.tags[0] : img.digest;
        if (!imgTag) {
            throw new Error('Image missing tags: ' + JSON.stringify(img));
        }

        let uri = this.getUri(this.gauth.project, repo, imgTag);
        logger.verbose(`Using docker image: ${uri}`);
        return uri;
    }

    /**
     * @param {string} image
     * @param {string} repo
     * @param {string} branch
     * @param {string} tagFormat
     */
    async pushLocalImage(image, repo, branch, tagFormat) {
        tagFormat = replaceInText(tagFormat);
        let targetImage = this.getUri(this.gauth.project, repo, tagFormat);
        let latestTag = this.getUri(this.gauth.project, repo, branch + '-latest');

        logger.verbose('pushing docker image', { source: image, target: targetImage, latest: latestTag });

        logger.info(`Tagging docker image ${image} as ${targetImage}`);
        await shell.exec(`${this.docker} tag ${image} ${targetImage}`);

        logger.info('Pushing docker image: ' + targetImage);
        await shell.exec(`${this.gauth.gcloud} docker -- push ${targetImage}`, { direct: true });

        logger.info('Applying image label: ' + latestTag);
        await shell.exec(`${this.gauth.gcloud} --quiet container images add-tag ${targetImage} ${latestTag}`, { direct: true });

        return targetImage;
    }

    /**
     * @param {string} image
     */
    async isLocalImage(image) {
        let text = await shell.exec(`${this.docker} images -q ${image}`);
        return !!text.trim();
    }
}
