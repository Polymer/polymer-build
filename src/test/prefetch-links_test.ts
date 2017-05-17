/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

import {assert} from 'chai';
import {EventEmitter} from 'stream';
import File = require('vinyl');

const mergeStream = require('merge-stream');

import {PolymerProject} from '../polymer-project';
import {createLinks} from '../prefetch-links';

async function pipedFiles(root: string, pipe: EventEmitter):
    Promise<Map<string, File>> {
      const files = new Map<string, File>();
      const unroot = ((p: string) => p.substring(root.length + 1));
      return new Promise<Map<string, File>>((resolve, reject) => {
        pipe.on('data', (f: File) => files.set(unroot(f.path), f))
        pipe.on('end', () => {
          resolve(files);
        })
        pipe.on('error', (error: any) => reject(error));
      });
    }

suite('prefetch', () => {

  suite('AddPrefetchLinks', () => {

    test('adds prefetch links unbundled', async() => {

      const project = new PolymerProject({
        root: 'test-fixtures/bundle-project/',
        entrypoint: 'index.html',
      });

      const files = await pipedFiles(
          project.config.root,
          mergeStream(project.sources(), project.dependencies())
              .pipe(project.addPrefetchLinks()));
      const html = files.get('index.html').contents.toString();
      assert.include(html, '<link rel="prefetch" href="/simple-script.js">');
      assert.include(html, '<link rel="prefetch" href="/simple-style.css">');
      assert.include(html, '<link rel="prefetch" href="/simple-import.html">');
      assert.include(
          html, '<link rel="prefetch" href="/simple-import-2.html">');
    });

    test('adds prefetch links to bundled output', async() => {

      const project = new PolymerProject({
        root: 'test-fixtures/bundle-project/',
        entrypoint: 'index.html',
      });

      const files = await pipedFiles(
          project.config.root,
          mergeStream(project.sources(), project.dependencies())
              .pipe(project.bundler({inlineCss: false}))
              .pipe(project.addPrefetchLinks()));

      const expectedFiles = ['index.html', 'simple-style.css'];
      assert.deepEqual(expectedFiles, [...files.keys()].sort());
      const html = files.get('index.html').contents.toString();
      assert.include(html, '<link rel="prefetch" href="/simple-style.css">');
      assert.notInclude(html, '<link rel="prefetch" href="/simple-script.js">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/simple-import.html">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/simple-import-2.html">');
    });

    test('prefetch links do not include lazy dependencies', async() => {

      const project = new PolymerProject({
        root: 'test-fixtures/bundler-data/',
        entrypoint: 'index.html',
      });

      const files = await pipedFiles(
          project.config.root,
          mergeStream(project.sources(), project.dependencies())
              .pipe(project.addPrefetchLinks()));

      const html = files.get('index.html').contents.toString();
      assert.include(html, '<link rel="prefetch" href="/shell.html">');
      assert.include(html, '<link rel="prefetch" href="/framework.html">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/entrypoint-a.html">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/entrypoint-b.html">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/entrypoint-c.html">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/common-dependency.html">');
      assert.notInclude(
          html, '<link rel="prefetch" href="/lazy-dependency.html">');
    });

    test('prefetch links are relative when base tag present', async() => {

      const project = new PolymerProject({
        root: 'test-fixtures/differential-serving/',
        entrypoint: 'index.html',
      });

      const files = await pipedFiles(
          project.config.root,
          mergeStream(project.sources(), project.dependencies())
              .pipe(project.addPrefetchLinks()));

      const html = files.get('index.html').contents.toString();
      assert.include(html, '<link rel="prefetch" href="shell.html">');
    });
  });

  suite('createLinks', () => {
    const html = '<html><body>foo</body></html>';
    const htmlWithBase = '<html><base href="/base/"><body>foo</body></html>';
    const deps = new Set([
      'bower_components/polymer/polymer.html',
      'src/my-icons.html',
    ]);

    test('with rel import', () => {
      const url = 'src/my-app.html';
      const expected =
          ('<html><head>' +
           '<link rel="import" href="../bower_components/polymer/polymer.html">' +
           '<link rel="import" href="my-icons.html">' +
           '</head><body>foo</body></html>');
      const actual = createLinks(html, url, deps, 'import', false)
      assert.equal(actual, expected);
    });

    test('with rel prefetch', () => {
      const url = 'index.html';
      const expected =
          ('<html><head>' +
           '<link rel="prefetch" href="/bower_components/polymer/polymer.html">' +
           '<link rel="prefetch" href="/src/my-icons.html">' +
           '</head><body>foo</body></html>');
      const actual = createLinks(html, url, deps, 'prefetch', true)
      assert.equal(actual, expected);
    });

    test('with rel prefetch and a base href', () => {
      const url = 'index.html';
      const expected =
          ('<html><head><base href="/base/">' +
           '<link rel="prefetch" href="bower_components/polymer/polymer.html">' +
           '<link rel="prefetch" href="src/my-icons.html">' +
           '</head><body>foo</body></html>');
      const actual = createLinks(htmlWithBase, url, deps, 'prefetch', true)
      assert.equal(actual, expected);
    });
  });
});
