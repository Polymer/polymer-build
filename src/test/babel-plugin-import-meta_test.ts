/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as babelCore from '@babel/core';
// import {assert} from 'chai';
// import * as path from 'path';
// import stripIndent = require('strip-indent');

import {rewriteImportMeta} from '../babel-plugin-import-meta';

suite.only('babel-plugin-import-meta', () => {

  test('transforms import.meta', () => {
    const plugin = rewriteImportMeta('/foo/bar.js', '/foo', 'http://foo.com/');
    const out = babelCore.transform('import.meta', {plugins: [plugin]}).code;
    console.log(out);
  });

});
