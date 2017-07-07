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
import {GoogleKubernetes} from '../google/googleKubernetes';

/**
 * @param {AppState} app
 */
module.exports = async function kubeGetImages(app) {
    let googKube = new GoogleKubernetes(app.gauth, app.config);
    let clusters = await googKube.getClusters(false);

    let names = Object.keys(clusters);
    for (let ix = 0; ix < names.length; ix++) {
        let cluster = clusters[names[ix]];
        try {
            let kubectl = await googKube.getKubeController(cluster);
            let data = await kubectl.getDeploy(app.config.name);

            data.spec.template.spec.containers.forEach(cimg => {
                logger.info(`${cluster.name}/${cimg.name} = ${cimg.image}`);
            });
        }
        catch (ex) {
            logger.error('Unable to report on cluster ' + names[ix]);
            logger.verbose(ex);
        }
    }
};
