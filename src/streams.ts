/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {posix as posixPath} from 'path';
import {PassThrough, Readable, Transform} from 'stream';
import File = require('vinyl');
import * as fs from 'fs';
import {Node, getAttribute} from 'dom5';
import {Analyzer, Loader, FSResolver, DocumentDescriptor} from 'hydrolysis';

import urlFromPath from './url-from-path';
import {DocumentDeps, getDependenciesFromDocument} from './document-parser';

const minimatchAll = require('minimatch-all');
const multipipe = require('multipipe');

export type FileCB = (error?: any, file?: File) => void;

export interface DocumentDeps {
  imports?: Array<string>;
  scripts?: Array<string>;
  styles?: Array<string>;
}
/**
 * Waits for the given ReadableStream
 */
export function waitFor(stream: NodeJS.ReadableStream): Promise<NodeJS.ReadableStream> {
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

/**
 * Waits for all the given ReadableStreams
 */
export function waitForAll(streams: NodeJS.ReadableStream[]): Promise<NodeJS.ReadableStream[]> {
  return Promise.all<NodeJS.ReadableStream>(streams.map((s) => waitFor(s)));
}

/**
 * Composes multiple streams (or Transforms) into one.
 */
export function compose(streams: NodeJS.ReadWriteStream[]) {
  if (streams && streams.length > 0) {
    return multipipe(streams);
  } else {
    return new PassThrough({objectMode: true});
  }
}

/**
 * A stream that accepts source file objects from a vinyl stream, and emits
 * the file paths of all required file dependencies. Useful for building
 * the dependency tree during build.
 */
export class SourceDependenciesStream extends Transform {

  // A set of all dependency file paths passed through the stream
  sourceGlobs: string[];
  files = new Set<string>();

  constructor(sourcGlobs: string[]) {
    super({ objectMode: true });
    this.sourceGlobs = sourcGlobs;
  }

  /**
   * Process the given dependency before pushing it through the stream.
   * Each dependency is only pushed through once to avoid duplicates.
   */
  pushDependency(dependencyPath: string) {
    // If this is the first time we've seen this dependency, push it through.
    if (this.files.has(dependencyPath)) {
      return;
    }

    if (minimatchAll(dependencyPath, this.sourceGlobs)) {
      console.log('MATCH SOURCE', dependencyPath);
      return;
    }

    this.files.add(dependencyPath);
    let dependency = new File({ path: dependencyPath });
    this.push(dependency);
  }

  _transform(
    file: File,
    encoding: string,
    callback: (error?: Error, data?: File) => void
  ): void {
    // If the file has already been seen, it was as the dependency of another
    // source file. We can assume its dependencies were already parsed then.
    if (this.files.has(file.path)) {
      callback();
      return;
    }

    // Only HTML source files can have dependencies. If the given file is not
    // an HTML file, we can assume it has no dependencies.
    if (file.extname !== '.html') {
      callback();
      return;
    }

    this._getDependencies(file.path).then((allDeps: DocumentDeps) => {
      allDeps.imports.forEach(this.pushDependency.bind(this));
      allDeps.scripts.forEach(this.pushDependency.bind(this));
      allDeps.styles.forEach(this.pushDependency.bind(this));
      callback();
    }).catch(err => {
      callback(err);
    });
  }

  /**
   * Create an analyzer and retreive all transitive dependencies for `url`
   */
  _getDependencies(url: string): Promise<DocumentDeps> {
    let pathDirectory = posixPath.dirname(url);
    let resolver = new FSResolver({});
    let loader = new Loader();
    loader.addResolver(resolver);
    let analyzer = new Analyzer(false, loader);

    return analyzer.metadataTree(url)
      .then((tree) => getDependenciesFromDocument(tree, pathDirectory));
  }
}

/**
 * A stream that passes through Vinyl file objects and loads any files
 * that have not yet had their content loaded.
 */
export class VinylHydrateStream extends Transform {

  constructor() {
    super({ objectMode: true });
  }

  _transform(
    file: File,
    encoding: string,
    callback: (error?: Error, data?: File) => void
  ): void {
    // Don't load a file that already has contents.
    if (file.contents) {
      callback(null, file);
      return;
    }

    fs.readFile(file.path, (err?: Error, data?: Buffer) => {
      if (err) {
        callback(err);
        return;
      }
      file.contents = data;
      callback(null, file);
    });
  }

}