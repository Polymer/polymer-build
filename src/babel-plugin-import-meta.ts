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
import {NodePath} from '@babel/traverse';
import * as t from '@babel/types';
import {MetaProperty} from '@babel/types';
import {relative} from 'path';
import {URL} from 'whatwg-url';

/**
 * Rewrites `import.meta` into an object with a `url` property.
 */
export const rewriteImportMeta = (
    filePath: string,
    rootDir: string,
    base: string,
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
        // console.log('import.meta at', node.loc);
        const relativePath = relative(rootDir, filePath);
        const url = new URL(relativePath, base);
        path.replaceWith(
            t.objectExpression([t.objectProperty(
                t.identifier('url'), t.stringLiteral(url.toString()))]) as any);
      }
    }
  }
});
