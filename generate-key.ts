// ERROR
// /home/vagrant/iroha2/js-client/node_modules/@iroha2/crypto-target-node/dist/wasm/crypto.js:873
//     throw new Error(getStringFromWasm0(arg0, arg1));
//           ^
// Error: null pointer passed to rust
//     at null.module.exports.__wbindgen_throw (/home/vagrant/iroha2/js-client/node_modules/@iroha2/crypto-target-node/dist/wasm/crypto.js:873:11)
//     at wasm://wasm/0076bb3a:wasm-function[607]:0xb52ad
//     at wasm://wasm/0076bb3a:wasm-function[605]:0xb5293
//     at wasm://wasm/0076bb3a:wasm-function[229]:0xa4b97
//     at KeyGenConfiguration.useSeed (/home/vagrant/iroha2/js-client/node_modules/@iroha2/crypto-target-node/dist/wasm/crypto.js:418:24)
//     at Object.<anonymous> (/home/vagrant/iroha2/js-client/generate-key.ts:21:4)
//     at Module._compile (node:internal/modules/cjs/loader:1105:14)
//     at Object.h (/home/vagrant/iroha2/js-client/node_modules/@esbuild-kit/cjs-loader/dist/index.js:1:933)
//     at Module.load (node:internal/modules/cjs/loader:981:32)
//     at Function.Module._load (node:internal/modules/cjs/loader:822:12

// Using KeyGenConfiguration from crypto-core throws too:
// import { KeyGenConfiguration } from "@iroha2/crypto-core";
// ERROR:
// /home/vagrant/iroha2/js-client/generate-key.ts:30
// const config = new KeyGenConfiguration()
// TypeError: import_crypto_core.KeyGenConfiguration is not a constructo

// Question: What is a correct use of `generateKeyPairWithConfiguration` ??

import { crypto } from "@iroha2/crypto-target-node";
import { setCrypto } from "@iroha2/client";
import { PublicKey } from "@iroha2/data-model";

setCrypto(crypto);

const SEED_BYTES = [11, 22, 33, 44, 55, 66, 77, 88];
const keyAlgo = crypto.AlgorithmEd25519();
const config = new (crypto as any).KeyGenConfiguration()
  .useSeed(Uint8Array.from(SEED_BYTES))
  .withAlgorithm(keyAlgo);
const keyPair = crypto.generateKeyPairWithConfiguration(config);
console.log("KEY PAIR:", keyPair);
const publicKey2 = PublicKey({
  payload: keyPair.publicKey().payload(),
  digest_function: keyPair.publicKey().digestFunction(),
});
console.log("publicKey2:", publicKey2);
