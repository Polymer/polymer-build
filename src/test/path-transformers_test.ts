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
import {join as pathJoin, sep as pathSeparator} from 'path';
import {ProjectConfig} from 'polymer-project-config';

import {getAbsoluteFilePath, LocalFsPath, urlFromPath} from '../path-transformers';
import {rootedFileUrl} from './util';

const WindowsRootPath = 'C:\\Users\\TEST_USER\\TEST_ROOT' as LocalFsPath;
const MacRootPath = '/Users/TEST_USER/TEST_ROOT' as LocalFsPath;
const RootPath = pathSeparator === '\\' ? WindowsRootPath : MacRootPath;

suite('pathFromUrl()', () => {
  const config = {root: RootPath} as any as ProjectConfig;
  test('creates a filesystem path using the platform separators', () => {
    const otherSeparator = pathSeparator === '/' ? '\\' : '/';
    const path = getAbsoluteFilePath(
        config, rootedFileUrl`Users/TEST_USER/TEST_ROOT/some/url/pathname`);
    assert.include(path, pathSeparator);
    assert.notInclude(path, otherSeparator);
  });

  test('will not go outside the root path', () => {
    assert.throws(() => {
      getAbsoluteFilePath(config, rootedFileUrl`some/other/directory/`);
    });
  });

  test('handles spaces correctly', () => {
    const path = getAbsoluteFilePath(
        config, rootedFileUrl`Users/TEST_USER/TEST_ROOT/hello%20world.txt`);
    assert.equal(path, pathJoin(RootPath, 'hello world.txt'));
  });
});

suite('urlFromPath()', () => {
  test('throws error when path is not in root', () => {
    assert.throws(() => {
      urlFromPath(
          '/this/is/a/path' as LocalFsPath,
          '/some/other/path/shop-app.html' as LocalFsPath);
    });
    assert.throws(() => {
      urlFromPath(
          '/the/path' as LocalFsPath,
          '/the/pathologist/index.html' as LocalFsPath);
    });
  });

  test('creates a URL path relative to root', () => {
    const shortPath = urlFromPath(
        RootPath, pathJoin(RootPath, 'shop-app.html') as LocalFsPath);
    assert.equal(shortPath, 'shop-app.html');
    const medPath = urlFromPath(
        RootPath, pathJoin(RootPath, 'src', 'shop-app.html') as LocalFsPath);
    assert.equal(medPath, 'src/shop-app.html');
    const longPath = urlFromPath(
        RootPath,
        pathJoin(RootPath, 'bower_components', 'app-layout', 'docs.html') as
            LocalFsPath);
    assert.equal(longPath, 'bower_components/app-layout/docs.html');
  });

  test('will properly encode URL-unfriendly characters like spaces', () => {
    const url =
        urlFromPath(RootPath, pathJoin(RootPath, 'spaced out') as LocalFsPath);
    assert.equal(url, 'spaced%20out');
  });
});
