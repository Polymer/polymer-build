/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import {assert} from 'chai';
import {urlFromPath} from '../path-transformers';

const windowsRootPath = 'C:\\Users\\TEST_USER\\TEST_ROOT';
const posixRootPath = '/Users/TEST_USER/TEST_ROOT';
const processPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

suite('urlFromPath()', () => {

  afterEach(() => {
    Object.defineProperty(process, 'platform', processPlatform);
  });

  test('throws error when path is not in root', () => {
    assert.throws(() => {
      urlFromPath(posixRootPath, '/some/other/path/shop-app.html');
    });
  });

  test('creates a URL path relative to root in a Windows environment', () => {
    Object.defineProperty(process, 'platform', {value: 'windows'});
    const shortPath =
        urlFromPath(windowsRootPath, windowsRootPath + '\\shop-app.html');
    assert.equal(shortPath, 'shop-app.html');
    const medPath =
        urlFromPath(windowsRootPath, windowsRootPath + '\\src\\shop-app.html');
    assert.equal(medPath, 'src/shop-app.html');
    const longPath = urlFromPath(
        windowsRootPath,
        windowsRootPath + '\\bower_components\\app-layout\\docs.html');
    assert.equal(longPath, 'bower_components/app-layout/docs.html');
  });

  test('creates a URL path relative to root in a Posix environment', () => {
    Object.defineProperty(process, 'platform', {value: 'ubuntu'});
    const shortPath =
        urlFromPath(posixRootPath, posixRootPath + '/shop-app.html');
    assert.equal(shortPath, 'shop-app.html');
    const medPath =
        urlFromPath(posixRootPath, posixRootPath + '/src/shop-app.html');
    assert.equal(medPath, 'src/shop-app.html');
    const longPath = urlFromPath(
        posixRootPath,
        posixRootPath + '/bower_components/app-layout/docs.html');
    assert.equal(longPath, 'bower_components/app-layout/docs.html');
  });
});
