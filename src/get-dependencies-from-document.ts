/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {parse as urlParse} from 'url';
import {Document} from 'polymer-analyzer';
import {posix as posixPath} from 'path';
import {Node, queryAll, predicates, getAttribute} from 'dom5';
import * as logging from 'plylog';

const logger = logging.getLogger('cli.build.get-dependencies');

/**
 * Detects if a url is external by checking it's protocol. Also checks if it
 * starts with '//', which can be an alias to the page's current protocol
 * in the browser.
 */
export function isDependencyExternal(url: string) {
  // TODO(fks) 08-01-2016: Add additional check for files on current hostname
  // but external to this application root. Ignore them.
  return urlParse(url).protocol !== null || url.startsWith('//');
}
