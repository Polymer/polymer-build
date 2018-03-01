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

import * as babel from 'babel-core';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';

// TODO(aomarks) Switch to @babel/preset-env
const babelPresetES2015 = require('babel-preset-es2015');

const babelPresetES2015AMD =
    babelPresetES2015.buildPreset({}, {modules: 'amd'});

export interface Options {
  transformModules: boolean;
  requireJsUrl: string;
}

/**
 * TODO(aomarks) Add docs.
 */
export function compileJavaScriptFile(ast: babel.types.File, options: Options) {
  const babelOpts = options.transformModules && hasImportOrExport(ast) ?
      babelPresetES2015AMD :
      babelPresetES2015;
  // TODO(aomarks) Does this compile the AST in-place? Should we pass back the
  // BabelFileResult?
  babel.transformFromAst(ast, babelOpts);
}

/**
 * TODO(aomarks) Add docs.
 */
function hasImportOrExport(ast: babel.types.File): boolean {
  // TODO(aomarks) Can we use sourceType instead?
  for (const node of ast.program.body) {
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        return true;
    }
  }
  return false;
}

const p = dom5.predicates;

const isJsScriptNode = p.AND(
    p.hasTagName('script'),
    p.OR(
        p.NOT(p.hasAttr('type')),
        p.hasAttrValue('type', 'text/javascript'),
        p.hasAttrValue('type', 'application/javascript'),
        p.hasAttrValue('type', 'module')));

/**
 * TODO(aomarks) Add docs.
 */
export function compileJavaScriptInHTML(doc: dom5.Node, options: Options) {
  let requireScriptTag, wctScriptTag;

  const jsNodes = dom5.queryAll(doc, isJsScriptNode);

  // Assume that if this document has a nomodule script, the author is already
  // handling browsers that don't support modules, and we don't need to
  // transform anything.
  if (jsNodes.find((node) => dom5.hasAttribute(node, 'nomodule'))) {
    // TODO(aomarks) Should this really not do any compilation? Shouldn't we
    // just turn off module compilation?
    return;
  }

  for (const scriptTag of jsNodes) {
    // Is this a module script we should transform?
    const transformingModule = options.transformModules &&
        dom5.getAttribute(scriptTag, 'type') === 'module';

    if (transformingModule && !requireScriptTag) {
      // We need RequireJS to load the AMD modules we are declaring. Inject the
      // dependency as late as possible (right before the first module is
      // declared) because some of our legacy non-module dependencies,
      // typically loaded in <head>, behave differently when window.require is
      // present.
      const fragment = parse5.parseFragment(
          `<script src="${options.requireJsUrl}"></script>\n`);
      requireScriptTag = fragment.childNodes[0];
      dom5.insertBefore(scriptTag.parentNode, scriptTag, fragment);
    }

    const src = dom5.getAttribute(scriptTag, 'src');
    const isInline = !src;

    if (src &&
        (src.includes('web-component-tester/browser.js') ||
         src.includes('wct-browser-legacy/browser.js'))) {
      wctScriptTag = scriptTag;
    }

    if (transformingModule && !isInline) {
      // Transform an external module script into a `require` for that module,
      // to be executed immediately.
      dom5.replace(
          scriptTag,
          parse5.parseFragment(`<script>require(["${src}"]);</script>\n`));

    } else if (isInline) {
      let js = dom5.getTextContent(scriptTag);
      const babelOpts =
          options.transformModules ? babelPresetES2015AMD : babelPresetES2015;
      let compiled;
      try {
        compiled = babel.transform(js, babelOpts).code;
      } catch (e) {
        // TODO (aomarks) Throw or something.
        // Continue so that we leave the original script as-is. It might work?
        // TODO Show an error in the browser console, or on the runner page.
        // console.warn(`Error compiling script in ${location}: ${e.message}`);
        continue;
      }

      if (transformingModule) {
        // The Babel AMD transformer output always starts with a `define` call,
        // which registers a module but does not execute it immediately. Since
        // we're in HTML, these are our top-level scripts, and we want them to
        // execute immediately. Swap it out for `require` so that it does.
        compiled = compiled.replace('define', 'require');

        // Remove type="module" since this is non-module JavaScript now.
        dom5.removeAttribute(scriptTag, 'type');
      }

      dom5.setTextContent(scriptTag, compiled);
    }
  }

  if (wctScriptTag && requireScriptTag) {
    // This looks like a Web Component Tester script, and we have converted ES
    // modules to AMD. Converting a module to AMD means that `DOMContentLoaded`
    // will fire before RequireJS resolves and executes the modules. Since WCT
    // listens for `DOMContentLoaded`, this means test suites in modules will
    // not have been registered by the time WCT starts running tests.
    //
    // To address this, we inject a block of JS that uses WCT's `waitFor` hook
    // to defer running tests until our AMD modules have loaded. If WCT finds a
    // `waitFor`, it passes it a callback that will run the tests, instead of
    // running tests immediately.
    //
    // Note we must do this as late as possible, before the WCT script, because
    // users may be setting their own `waitFor` that musn't clobber ours.
    // Likewise we must call theirs if we find it.
    dom5.insertBefore(
        wctScriptTag.parentNode, wctScriptTag, parse5.parseFragment(`
<script>
  // Injected by Polyserve.
  (function() {
    window.WCT = window.WCT || {};
    var originalWaitFor = window.WCT.waitFor;
    window.WCT.waitFor = function(cb) {
      window._wctCallback = function() {
        if (originalWaitFor) {
          originalWaitFor(cb);
        } else {
          cb();
        }
      };
    };
  }());
</script>
`));

    // Monkey patch `require` to keep track of loaded AMD modules. Note this
    // assumes that all modules are registered before `DOMContentLoaded`, but
    // that's an assumption WCT normally makes anyway. Do this right after
    // RequireJS is loaded, and hence before the first module is registered.
    //
    // TODO We may want to detect when the module failed to load (e.g. the deps
    // couldn't be resolved, or the factory threw an exception) and show a nice
    // message. For now test running will just hang if any module fails.
    dom5.insertAfter(
        requireScriptTag.parentNode, requireScriptTag, parse5.parseFragment(`
<script>
  // Injected by Polyserve.
  (function() {
    var originalRequire = window.require;
    var moduleCount = 0;
    window.require = function(deps, factory) {
      moduleCount++;
      originalRequire(deps, function() {
        if (factory) {
          factory.apply(undefined, arguments);
        }
        moduleCount--;
        if (moduleCount === 0) {
          window._wctCallback();
        }
      });
    };
  })();
</script>
`));
  }
}
