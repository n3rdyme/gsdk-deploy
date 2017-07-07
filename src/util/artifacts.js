'use strict';
/******************************************************************************
 * MIT License
 * Copyright (c) 2017 https://github.com/vroomlabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Created by rogerk on 7/5/17.
 ******************************************************************************/

const fs = require('fs');
const path = require('path');

module.exports = {
    getArtifactsFolder: function () {
        let artifacts = null;

        process.argv.map(arg => arg.match(/^--?arguments[:=](.*)$/))
            .filter(m => m)
            .forEach(m => { artifacts = m[1]; });

        // Create an artifacts directory
        if (!artifacts || !fs.existsSync(artifacts)) {
            if (process.env.ARTIFACTS && fs.existsSync(process.env.ARTIFACTS)) {
                artifacts = path.resolve(process.env.ARTIFACTS);
            }
            else if (process.env.CIRCLE_ARTIFACTS && fs.existsSync(process.env.CIRCLE_ARTIFACTS)) {
                artifacts = path.resolve(process.env.CIRCLE_ARTIFACTS);
            }
            else {
                let baseDir = process.cwd();
                artifacts = path.join(baseDir, './artifacts');
                if (!fs.existsSync(artifacts)) {
                    fs.mkdirSync(artifacts);
                    artifacts = path.resolve(artifacts);
                }
            }
        }

        return artifacts || process.cwd();
    }
};
