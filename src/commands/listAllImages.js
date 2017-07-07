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

/**
 * @param {AppState} app
 */
module.exports = async function listAllImages(app) {
    let repo = new GoogleDockerRepo(app.args, app.gauth);
    let uri = repo.getUri(app.config.project, app.config.name);
    let images = await repo.getImages(uri, 25, app.args.branch + '-');
    let maxName = 0;

    images.map(img => {
        img = {
            name: img.tags && img.tags.length ? img.tags.join(',') : img.digest,
            date: img.timestamp.datetime
        };
        maxName = Math.max(img.name.length, maxName);
        return img;
    }).forEach(img => {
        let name = (img.name + '                                                    ').substr(0, maxName + 2);
        logger.info(`${name}${img.date}`);
    });
};
