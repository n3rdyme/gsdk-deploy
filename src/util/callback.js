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

/**
 * Returns a promise from a callback method in the form of (error, result)
 * Using this since I'm running babel and don't want to include bluebird.
 * @param {object} context - the object to which the method belongs
 * @param {function} method - the method to promisify
 * @returns {Promise}
 */
export function promisify(context, method) {
    let args = [].slice.call(arguments).splice(2);
    if (typeof method === 'string') {
        if (context[method] && context[method].apply) {
            method = context[method];
        }
    }
    if (!method.apply) {
        throw new Error(`Expected a function, found ${method}.`);
    }

    return new Promise((accept, reject) => {
        args.push(function promise_callback(error, result) {
            if (error) return reject(error);
            else return accept(result);
        });

        try {
            method.apply(context, args);
        }
        catch (ex) {
            reject(ex);
        }
    })
}
