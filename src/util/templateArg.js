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

/**
 * Replace any environment variable in supplied text
 * @param {string} input
 * @param {object=} values
 */
export function replaceInText(input, values) {
    if (typeof input !== 'string') {
        return input;
    }
    if (!values) {
        values = process.env;
    }

    return input.replace(
        /\$(([a-z0-9]+(_[a-z0-9]+)*)|(\(([\w\-_]+)\))|({([\w\-_]+)}))/gi,
        function (text, g1, m1, g3, g4, m2, g6, m3) {
            let name = (m1 || m2 || m3).toUpperCase();
            if (!name || !values.hasOwnProperty(name)) {
                throw new Error(`The variable "${name}" is not defined.`);
            }
            return values[name];
        }
    );
}

/**
 * @param obj
 * @param {object=} values
 * @param {filter=} filter
 */
export function replaceInObject(obj, values, filter) {
    filter = filter || {};
    if (typeof obj === 'string') {
        obj = replaceInText(obj, values);
    }
    else if (Array.isArray(obj)) {
        obj = obj.map(item => replaceInObject(item, values, filter));
    }
    else if (typeof obj === 'object') {
        let keys = Object.keys(obj);
        for (let ix=0; ix < keys.length; ix++) {
            if (!filter[keys[ix]])
                obj[keys[ix]] = replaceInObject(obj[keys[ix]], values, filter);
        }
    }

    return obj;
}
