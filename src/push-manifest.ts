/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {writeFile} from 'fs';
import * as path from 'path';
import {Analyzer, FSUrlLoader} from 'polymer-analyzer';

import {urlFromPath} from './path-transformers';
import {PolymerProject} from './polymer-project';


export interface AddPushManifestOptions {
  project: PolymerProject;
  buildRoot: string;
  path?: string;
}

// Push Manifest Types Definitions
export type LinkType = 'document' | 'script' | 'style' | 'image' | 'font';
const extensionToTypeMapping: {[extname: string]: LinkType} = {
  '.css': 'style',
  '.gif': 'image',
  '.html': 'document',
  '.png': 'image',
  '.jpg': 'image',
  '.js': 'script',
  '.json': 'script',
  '.svg': 'image',
  '.webp': 'image',
  '.woff': 'font',
  '.woff2': 'font'
};
export interface PushManifestEntry {
  [dependencyAbsoluteUrl: string]: {
    type?: LinkType,
    // NOTE(fks) 04-05-2017: Only weight=1 is supported by browsers at the
    // moment. When support is added, we can add automatic weighting and support
    // multiple numbers.
    weight: 1,
  };
}
export interface PushManifest {
  [fragmentAbsoluteUrl: string]: PushManifestEntry;
}


/**
 * Analyze the given URL and return a unique Set of import URLs analyzed from
 * that root.
 */
async function analyzeFileForImportUrls(
    analyzer: Analyzer, url: string, ignoreUrls?: Set<string>):
    Promise<Set<string>> {
      const analyzedDocument = await analyzer.analyze(url);
      const analyzedImports = analyzedDocument.getByKind(
          'import', {externalPackages: true, imported: true});
      const analyzedImportUrls = new Set();
      function shouldIgnoreFile(url: string) {
        return ignoreUrls && ignoreUrls.has(url);
      }

      for (const analyzedImport of analyzedImports) {
        if (!shouldIgnoreFile(analyzedImport.url)) {
          analyzedImportUrls.add(analyzedImport.url);
        }
      }
      return analyzedImportUrls;
    };

/**
 * Gets a link type from a file URL. Useful for generating a PushManifestEntry
 * and needed for the "as=" value on Link headers.
 */
function getLinkTypeFromUrl(url: string): LinkType|undefined {
  return extensionToTypeMapping[path.extname(url)] || undefined;
};

/**
 * Generate a PushManifestEntry from an array of URLs.
 */
function generatePushManifestEntries(urls: string[]): PushManifestEntry {
  const newEntry: PushManifestEntry = {};
  for (const url of urls) {
    newEntry[url] = {type: getLinkTypeFromUrl(url), weight: 1};
  }
  return newEntry;
};

/**
 * Returns a promise that resolves with a generated push manifest, based off of
 * the options provided.
 */
export async function generatePushManifest(options: AddPushManifestOptions):
    Promise<PushManifest> {
  console.assert(!!options, '`project` & `buildRoot` options are required');
  console.assert(!!options.project, '`project` option is required');
  console.assert(!!options.buildRoot, '`buildRoot` option is required');

  const pushManifest: any = {};
  const analyzer = new Analyzer({
    urlLoader: new FSUrlLoader(options.buildRoot),
  });

  // Generate the dependencies to push for the shell
  const absoluteShellUrl =
      urlFromPath(options.project.config.root, options.project.config.shell);
  const shellImportUrls =
      await analyzeFileForImportUrls(analyzer, absoluteShellUrl);
  pushManifest[absoluteShellUrl] =
      generatePushManifestEntries(Array.from(shellImportUrls));

  // Generate the dependencies to push for each fragment.
  // Make sure that any duplicates from the shell dependencies list are
  // removed.
  for (const fragment of options.project.config.fragments) {
    const absoluteFragmentUrl =
        urlFromPath(options.project.config.root, fragment);
    const fragmentImportUrls = await analyzeFileForImportUrls(
        analyzer, absoluteFragmentUrl, shellImportUrls);
    pushManifest[absoluteFragmentUrl] =
        generatePushManifestEntries(Array.from(fragmentImportUrls));
  }

  return pushManifest;
}

/**
 * Returns a promise that resolves when a push manifest has been generated
 * and written to the build directory. This uses generatePushManifest() to
 * generate a push manifest, which it then writes to the file system based on
 * the buildRoot & path (if provided) options.
 */
export async function addPushManifest(options: AddPushManifestOptions):
    Promise<void> {
  const fileContents = await generatePushManifest(options);
  const fileContentsBuffer =
      new Buffer(JSON.stringify(fileContents, undefined, '  '));
  return await(new Promise<void>((resolve, reject) => {
    const pushManifestPath =
        path.join(options.buildRoot, options.path || 'push-manifest.json');
    writeFile(pushManifestPath, fileContentsBuffer, (err: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  }));
}