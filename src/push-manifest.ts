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
import {Analyzer, FSUrlLoader, Import} from 'polymer-analyzer';

import {urlFromPath} from './path-transformers';
import {PolymerProject} from './polymer-project';


export interface AddPushManifestOptions {
  project: PolymerProject;
  buildRoot: string;
  path?: string;
}

/**
 * Push Manifest Types Definitions
 * A push manifest is a JSON object representing relative application URL and
 * the resources that should be pushed when those URLs are requested by the
 * server. Below is a example of this data format:
 *
 *       {
 *         "index.html": {       // PushManifestEntryCollection
 *           "/css/app.css": {   // PushManifestEntry
 *             "type": "style",  // ResourceType
 *             "weight": 1
 *           },
 *           ...
 *         },
 *         "page.html": {
 *           "/css/page.css": {
 *             "type": "style",
 *             "weight": 1
 *           },
 *           ...
 *         }
 *       }
 *
 * NOTE(fks) 04-05-2017: Only weight=1 is supported by browsers at the moment.
 * When support is added, we can add automatic weighting and support multiple
 * numbers.
 */
export type ResourceType = 'document' | 'script' | 'style' | 'image' | 'font';
export interface PushManifestEntry {
  type?: ResourceType;
  weight: 1;
}
export interface PushManifestEntryCollection {
  [dependencyAbsoluteUrl: string]: PushManifestEntry;
}
export interface PushManifest {
  [requestAbsoluteUrl: string]: PushManifestEntryCollection;
}

/**
 * A mapping of file extensions and their default resource type.
 */
const extensionToTypeMapping: {[extname: string]: ResourceType} = {
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

/**
 * Get the default resource type for a file based on its extension.
 */
function getResourceTypeFromUrl(url: string): ResourceType|undefined {
  return extensionToTypeMapping[path.extname(url)] || undefined;
}

/**
 * Get the resource type for an import, handling special import types and
 * falling back to getResourceTypeFromUrl() if none exist.
 */
function getResourceTypeFromImport(importFeature: Import): ResourceType|
    undefined {
  const importTagName = importFeature.astNode.tagName;
  const isHtmlAstNode = !!importTagName;

  // Only HTML has the ability to define custom resource types for an import.
  // If we are looking at an import coming from JS or CSS, we can assume its
  // resource type from the file name.
  if (!isHtmlAstNode) {
    return getResourceTypeFromUrl(importFeature.url);
  }

  // If the tag is known to always import a single resource type, return that.
  if (importTagName === 'script') {
    return 'script';
  }
  if (importTagName === 'img') {
    return 'image';
  }

  // Check <link> tags for a "rel" attribute that may dictate the resource type.
  if (importTagName === 'link') {
    const importAttributes = importFeature.astNode.attrs;
    const relAttributeData = Array.isArray(importAttributes) &&
        importAttributes.find((attr) => attr.name === 'rel');
    const relAttribute = relAttributeData && relAttributeData.value;
    if (relAttribute.indexOf('stylesheet') > -1) {
      return 'style';
    }
    if (relAttribute.indexOf('import') > -1) {
      return 'document';
    }
    if (relAttribute.indexOf('icon') > -1) {
      return 'image';
    }
  }

  // No custom resource type was detected for this import.
  // Default to the file extension.
  return getResourceTypeFromUrl(importFeature.url);
};

/**
 * Create a PushManifestEntry from an analyzer Import.
 */
function createPushEntryFromImport(importFeature: Import): PushManifestEntry {
  return {
    type: getResourceTypeFromImport(importFeature),
    weight: 1,
  };
}

/**
 * Analyze the given URL and resolve with a collection of push manifest entries
 * to be added to the overall push manifest.
 */
async function generatePushManifestEntryForUrl(
    analyzer: Analyzer, url: string, ignoreUrls?: string[]):
    Promise<PushManifestEntryCollection> {
      const analyzedDocument = await analyzer.analyze(url);
      const analyzedImports = analyzedDocument.getByKind(
          'import', {externalPackages: true, imported: true});
      const analyzedImportUrls: PushManifestEntryCollection = {};
      function shouldIgnoreFile(url: string) {
        return ignoreUrls && ignoreUrls.indexOf(url) > -1;
      }

      for (const analyzedImport of analyzedImports) {
        const analyzedImportUrl = analyzedImport.url;
        const analyzedImportEntry = analyzedImportUrls[analyzedImportUrl];
        if (!shouldIgnoreFile(analyzedImportUrl) && !analyzedImportEntry) {
          analyzedImportUrls[analyzedImportUrl] =
              createPushEntryFromImport(analyzedImport);
        }
      }

      return analyzedImportUrls;
    };

/**
 * Resolve with a push manifest generated for the application build located at
 * buildRoot.
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
  pushManifest[absoluteShellUrl] =
      await generatePushManifestEntryForUrl(analyzer, absoluteShellUrl);
  const shellImportUrls = Object.keys(pushManifest[absoluteShellUrl]);

  // Generate the dependencies to push for each fragment.
  for (const fragment of options.project.config.fragments) {
    const absoluteFragmentUrl =
        urlFromPath(options.project.config.root, fragment);
    pushManifest[absoluteFragmentUrl] = await generatePushManifestEntryForUrl(
        analyzer, absoluteFragmentUrl, shellImportUrls);
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