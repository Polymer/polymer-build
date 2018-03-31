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

import importMetaSyntax from '@babel/plugin-syntax-import-meta';
import template from '@babel/template';
import {NodePath} from '@babel/traverse';
import {MetaProperty} from '@babel/types';
import {relative} from 'path';

const ast = template.ast;

/**
 * Rewrites `import.meta` into an object with a `url` property.
 *
 * `import.meta.url` must be a URL string with the fully qualified URL of the
 * module. We use the document's base URI and the relative path from rootDir to
 * filePath to build the URL.
 *
 * TODO: Add a option for a path fragment between the document base and module
 * file path.
 *
 * @param filePath THe path of the file being transformed
 * @param rootDir The root project folder containing filePath
 * @param base A base URL to use instead of document.baseURI
 */
export const rewriteImportMeta = (
    filePath: string,
    rootDir: string,
    base?: string,
    ) => ({
  inherits: importMetaSyntax,
  manipulateOptions(_opts: any, parserOpts: any) {
    parserOpts.plugins.push('importMeta');
  },
  visitor: {
    MetaProperty(path: NodePath<MetaProperty>) {
      const node = path.node;
      if (node.meta && node.meta.name === 'import' &&
          node.property.name === 'meta') {
        const relativePath = relative(rootDir, filePath);
        const baseURI = base !== undefined ? `'${base}'` : 'document.baseURI';
        path.replaceWith(
            ast`({url: new URL('${relativePath}', ${baseURI}).toString()})`);
      }
    }
  }
});
