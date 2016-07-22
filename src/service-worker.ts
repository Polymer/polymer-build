/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as path from 'path';
import * as logging from 'plylog';
const swPrecache = require('sw-precache');

// non-ES compatible modules
let logger = logging.getLogger('cli.build.sw-precache');

export interface SWConfig {
  cacheId?: string;
  directoryIndex?: string;
  dynamicUrlToDependencies?: {
    [property: string]: string[]
  };
  handleFetch?: boolean;
  ignoreUrlParametersMatching?: RegExp[];
  importScripts?: string[];
  logger?: Function;
  maximumFileSizeToCacheInBytes?: number;
  navigateFallback?: string;
  navigateFallbackWhitelist?: RegExp[];
  replacePrefix?: string;
  runtimeCaching?: {
    urlPattern: RegExp;
    handler: string;
    options?: {
      cache: {
        maxEntries: number;
        name: string;
      };
    };
  }[];
  staticFileGlobs?: string[];
  stripPrefix?: string;
  templateFilePath?: string;
  verbose?: boolean;
}

export interface GenerateServiceWorkerOptions {
  /**
   * Output folder for the service worker bundle
   */
  buildRoot: string;
  /**
   * folder containing files to be served by the service worker.
   */
  root: string;
  /**
   * Main file to serve from service worker.
   */
  entrypoint: string;
  /**
   * File path of the output service worker file.
   */
  serviceWorkerPath: string;
  /**
   * List of files to be cached by the service worker,
   * in addition to files found in `swConfig.staticFileGlobs`
   */
  precachedAssets?: string[];
  /**
   * Existing config to use as a base for the serivce worker generation.
   */
  swConfig?: SWConfig;
}

export interface GenerateServiceWorkerStreamOptions extends GenerateServiceWorkerOptions {
  precachedAssetsPromise?: Promise<string[]>;
}

export function writeServiceWorker(options: GenerateServiceWorkerStreamOptions): Promise<{}> {

  // Resolve the precached assets list if a promise was provided
  let resolveAssetsIfNeeded = Promise.resolve();
  if (options.precachedAssetsPromise) {
    resolveAssetsIfNeeded = options.precachedAssetsPromise.then(
      (precachedAssets: string[]) => {
        options.precachedAssets = precachedAssets;
      }
    );
  }

  return resolveAssetsIfNeeded.then(() => {
    let swConfig: SWConfig = options.swConfig || {};
    let precachedAssets = options.precachedAssets || [];
    precachedAssets.forEach((path: string, i: number) => {
      // strip root prefix, so buildRoot prefix can be added safely
      if (path.startsWith(options.root)) {
        precachedAssets[i] = path.substring(options.root.length);
      }
    });

    let mainHtml = options.entrypoint.substring(options.root.length);
    let precacheFiles = new Set(swConfig.staticFileGlobs);
    precachedAssets.forEach((p: string) => precacheFiles.add(p));
    precacheFiles.add(mainHtml);
    let precacheList = Array.from(precacheFiles);
    precacheList = precacheList.map((p) => path.join(options.buildRoot, p));

    // swPrecache will determine the right urls by stripping buildRoot
    swConfig.stripPrefix = options.buildRoot;
    // static files will be pre-cached
    swConfig.staticFileGlobs = precacheList;
    // Log service-worker helpful output at the debug log level
    swConfig.logger = swConfig.logger || logger.debug;

    logger.debug(`writing service worker...`, swConfig);

    let serviceWorkerPath = path.join(options.buildRoot, options.serviceWorkerPath || 'service-worker.js');

    return new Promise((resolve, reject) => {
      swPrecache.write(serviceWorkerPath, swConfig, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

}
