import { hexToBytes } from "hada";
import { crypto } from "@iroha2/crypto-target-node";
import { KeyPair } from "@iroha2/crypto-core";
import { Client, Signer, Torii, setCrypto, SetupBlocksStreamReturn } from '@iroha2/client'
import { AccountId, DomainId } from "@iroha2/data-model";

import { fetch as nodeFetch } from 'undici'
const { adapter: WS } = require("@iroha2/client/web-socket/node");

setCrypto(crypto);

function generateKeyPair(params: {
  publicKeyMultihash: string;
  privateKey: {
    digestFunction: string;
    payload: string;
  };
}): KeyPair {
  const multihashBytes = Uint8Array.from(hexToBytes(params.publicKeyMultihash));
  const multihash = crypto.createMultihashFromBytes(multihashBytes);
  const publicKey = crypto.createPublicKeyFromMultihash(multihash);
  const privateKey = crypto.createPrivateKeyFromJsKey(params.privateKey);

  const keyPair = crypto.createKeyPairFromKeys(publicKey, privateKey);

  // don't forget to "free" created structures
  for (const x of [publicKey, privateKey, multihash]) {
    x.free();
  }

  return keyPair;
}

const kp = generateKeyPair({
  publicKeyMultihash:
    "ed01207233bfc89dcbd68c19fde6ce6158225298ec1131b6a130d1aeb454c1ab5183c0",
  privateKey: {
    digestFunction: "ed25519",
    payload:
      "9ac47abf59b356e0bd7dcbbbb4dec080e302156a48ca907e47cb6aea1d32719e7233bfc89dcbd68c19fde6ce6158225298ec1131b6a130d1aeb454c1ab5183c0",
  },
});

const accountId = AccountId({
  name: "alice",
  domain_id: DomainId({
    name: "wonderland",
  }),
});

// const client = new Client({
//   torii: {
//     // Both URLs are optional - in case you need only a part of endpoints,
//     // e.g. only Telemetry ones
//     apiURL: "http://127.0.0.1:8080",
//     telemetryURL: "http://127.0.0.1:8180",
//   },
//   accountId: accountId,
//   keyPair: kp,
//   //ws: adapter,
// });

function clientFactory() {
  const signer = new Signer(accountId, kp);

  const torii = new Torii({
    apiURL: "http://127.0.0.1:8080",
    telemetryURL: "http://127.0.0.1:8180",
    ws: WS,
    fetch: nodeFetch as any,
  })

  const client = new Client({ torii, signer })

  return { signer, torii, client }
}
const { torii, client } = clientFactory();

let blockMonitor: SetupBlocksStreamReturn | undefined;

async function monitorBlocks() {
  blockMonitor = await torii.listenForBlocksStream({ height: BigInt(0) });

  blockMonitor.ee.on("block", (block) => {
    console.log("block:", block);
  });

  blockMonitor.ee.on("message", () => {
    console.log("Got message...");
  });

  blockMonitor.ee.on("accepted", () => {
    console.log("Accepted...");
  });

  blockMonitor.ee.on("close", (close) => {
    console.log("Closed:", JSON.stringify(close));
  });

  blockMonitor.ee.on("open", (open) => {
    console.log("Open:", JSON.stringify(open));
  });

  blockMonitor.ee.on("error", (error) => {
    console.error("ERROR:", JSON.stringify(error));
  });
}

monitorBlocks();
