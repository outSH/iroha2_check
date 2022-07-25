Node: v16.15.0

Output:
``` bash
vagrant@CactusDevVM:~/iroha2/js-client$ node ./dist/index.js
/home/vagrant/iroha2/js-client/node_modules/@iroha2/client-isomorphic-fetch/dist/node.js:28
var import_node_fetch = __toESM(require("node-fetch"));
                                ^

Error [ERR_REQUIRE_ESM]: require() of ES Module /home/vagrant/iroha2/js-client/node_modules/node-fetch/src/index.js from /home/vagrant/iroha2/js-client/node_modules/@iroha2/client-isomorphic-fetch/dist/node.js not supported.
Instead change the require of index.js in /home/vagrant/iroha2/js-client/node_modules/@iroha2/client-isomorphic-fetch/dist/node.js to a dynamic import() which is available in all CommonJS modules.
    at Object.<anonymous> (/home/vagrant/iroha2/js-client/node_modules/@iroha2/client-isomorphic-fetch/dist/node.js:28:33)
    at Object.<anonymous> (/home/vagrant/iroha2/js-client/node_modules/@iroha2/client/dist/lib.cjs.js:38:38)
    at Object.<anonymous> (/home/vagrant/iroha2/js-client/dist/index.js:5:18) {
  code: 'ERR_REQUIRE_ESM'
}
```