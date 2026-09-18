/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-aeb6ecaf'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "44a3f2b7342db5686068a14b66916812"
  }, {
    "url": "pwa-512x512.png",
    "revision": "44a3f2b7342db5686068a14b66916812"
  }, {
    "url": "pwa-192x192.png",
    "revision": "d3e3e0c9d1dee2a9e7ed55328dae195d"
  }, {
    "url": "index.html",
    "revision": "f633285c68cd313c131cc7355bcc2c89"
  }, {
    "url": "images.png",
    "revision": "46b89e5441b274107834052a0fd4dda9"
  }, {
    "url": "icon.svg",
    "revision": "f8568f3c6fe4313a71df62fc9535a9af"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "29e53d8709ae85dcaf5d6ba32374a1e1"
  }, {
    "url": "404.html",
    "revision": "ce3aabc75468826546f8ce3add5a13c6"
  }, {
    "url": "assets/index-CjaBdA5v.css",
    "revision": null
  }, {
    "url": "assets/index-B5n8EMQU.js",
    "revision": null
  }, {
    "url": "assets/images-BYbuhRKg.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "29e53d8709ae85dcaf5d6ba32374a1e1"
  }, {
    "url": "icon.svg",
    "revision": "f8568f3c6fe4313a71df62fc9535a9af"
  }, {
    "url": "pwa-192x192.png",
    "revision": "d3e3e0c9d1dee2a9e7ed55328dae195d"
  }, {
    "url": "pwa-512x512.png",
    "revision": "44a3f2b7342db5686068a14b66916812"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "44a3f2b7342db5686068a14b66916812"
  }, {
    "url": "manifest.webmanifest",
    "revision": "98d5f5cecccac4db6b5bc0560f377522"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(({
    url
  }) => url.pathname.startsWith("/api/"), new workbox.NetworkOnly(), 'GET');

}));
