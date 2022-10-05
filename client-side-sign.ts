import fs from "fs";
import { bytesToHex, hexToBytes } from "hada";

import { crypto } from "@iroha2/crypto-target-node";
import { KeyPair } from "@iroha2/crypto-core";
import { Client, Signer, Torii, setCrypto, makeTransactionPayload, makeSignedTransaction, computeTransactionHash } from '@iroha2/client'
import {
  AccountId,
  NewAccount,
  DomainId,
  EvaluatesToRegistrableBox,
  Executable,
  Expression,
  IdentifiableBox,
  Instruction,
  MapNameValue,
  Metadata,
  NewDomain,
  OptionIpfsPath,
  QueryBox,
  RegisterBox,
  Value,
  VecInstruction,
  VecPublicKey,
  PublicKey,
  AssetValueType,
  Mintable,
  AssetDefinitionId,
  EvaluatesToValue,
  IdBox,
  MintBox,
  AssetId,
  NewAssetDefinition,
  FindDomainById,
  EvaluatesToDomainId,
  FindAccountById,
  EvaluatesToAccountId,
  FindAssetById,
  EvaluatesToAssetId,
  TransactionPayload,
  VersionedTransaction,
  FilterBox,
  PipelineEventFilter,
  OptionHash,
  OptionPipelineEntityKind,
  PipelineEntityKind,
  OptionPipelineStatusKind,
  PipelineStatusKind,
  RejectionReason,
} from "@iroha2/data-model";

import { fetch as nodeFetch } from 'undici'
import assert from "assert";
const { adapter: WS } = require("@iroha2/client/web-socket/node");

setCrypto(crypto);

function generateKeyPair(params: {
  publicKeyMultihash: string;
  privateKey: {
    digestFunction: string;
    payload: string;
  };
}): KeyPair {
  // @todo: exception safety
  const multihashBytes = Uint8Array.from(hexToBytes(params.publicKeyMultihash));
  const multihash = crypto.createMultihashFromBytes(multihashBytes);
  const publicKey = crypto.createPublicKeyFromMultihash(multihash);
  const privateKey = crypto.createPrivateKeyFromJsKey(params.privateKey);

  const keyPair = crypto.createKeyPairFromKeys(publicKey, privateKey);

  // always free created structures
  [publicKey, privateKey, multihash].forEach((x) => x.free());

  return keyPair;
}

// Read Config
const configPath = "./config.json";
const configJson = fs.readFileSync(configPath, "ascii");
const config = JSON.parse(configJson);

// Create client
const kp = generateKeyPair({
  publicKeyMultihash: config.PUBLIC_KEY,
  privateKey: {
    digestFunction: config.PRIVATE_KEY.digest_function,
    payload: config.PRIVATE_KEY.payload,
  },
});

function clientFactory() {
  const signer = new Signer(config.ACCOUNT_ID, kp);

  const torii = new Torii({
    apiURL: config.TORII_API_URL,
    telemetryURL: config.TORII_TELEMETRY_URL,
    ws: WS,
    fetch: nodeFetch as any,
  })

  const client = new Client({ torii, signer })

  return { signer, torii, client }
}

const { torii, client, signer } = clientFactory();

// verbose log in docker compose
torii.setPeerConfig({ LogLevel: "TRACE" });

function getRejectionDescription(reason: RejectionReason): string {
  return reason.as("Transaction").match({
    NotPermitted: (error) => {
      return `NotPermitted: ${error.reason}`;
    },
    UnsatisfiedSignatureCondition: (error) => {
      return `UnsatisfiedSignatureCondition: ${error.reason}`;
    },
    LimitCheck: (error) => {
      return `LimitCheck: ${error}`;
    },
    InstructionExecution: (error) => {
      return `InstructionExecution: ${error.reason}`;
    },
    WasmExecution: (error) => {
      return `WasmExecution: ${error.reason}`;
    },
    UnexpectedGenesisAccountSignature: () => {
      return `UnexpectedGenesisAccountSignature`;
    },
  });
}

async function waitForTransactionStatus(txHash: Uint8Array) {
  // asserts
  const txHashHex = bytesToHex([...txHash]);
  console.log("waitForTransactionStatus() - hash:", txHashHex);

  const monitor = await torii.listenForEvents({
    filter: FilterBox(
      "Pipeline",
      PipelineEventFilter({
        entity_kind: OptionPipelineEntityKind(
          "Some",
          PipelineEntityKind("Transaction")
        ),
        status_kind: OptionPipelineStatusKind(
          "None"
        ),
        hash: OptionHash("Some", txHash),
      })
    ),
  });
  console.log("waitForTransactionStatus() - monitoring started.");

  // Handle events
  monitor.ee.on("open", (openEvent) => {
    console.log("waitForTransactionStatus() - connection open:", JSON.stringify(openEvent)); // safeStringify ?
  });

  monitor.ee.on("close", (closeEvent) => {
    console.log("waitForTransactionStatus() - connection close:", JSON.stringify(closeEvent)); // safeStringify ?
  });

  const txStatusPromise = new Promise<string>((resolve, reject) => {
    monitor.ee.on("error", (error) => {
      console.log("waitForTransactionStatus() - Received error", error);
      reject(error);
    });

    monitor.ee.on("event", (event) => {
      const { hash, status } = event.as("Pipeline");
      const hashHex = bytesToHex([...hash]);

      status.match({
        Validating: () => {
          const statusLine = `Transaction '${hashHex}' [Validating]`;
          console.log(`waitForTransactionStatus() - ${statusLine}`);
        },
        Committed: () => {
          const statusLine = `Transaction '${hashHex}' [Commited]`;
          console.log(`waitForTransactionStatus() - ${statusLine}`);
          resolve(statusLine);
        },
        Rejected: (reason) => {
          const statusLine = `Transaction '${hashHex}' [Rejected], reason: ${getRejectionDescription(reason)}`;
          console.log(`waitForTransactionStatus() - ${statusLine}`);
          reject(statusLine);
        }
      });
    });
  });

  return txStatusPromise.finally(async () => {
    console.log(`Transaction ${txHashHex} status received, stop the monitoring...`);
    monitor.ee.clearListeners();
    await monitor.stop();
  });
}

////////// Register domain
async function registerDomain(domainName: string) {
  const registerBox = RegisterBox({
    object: EvaluatesToRegistrableBox({
      expression: Expression(
        "Raw",
        Value(
          "Identifiable",
          IdentifiableBox(
            "NewDomain",
            NewDomain({
              id: DomainId({
                name: domainName,
              }),
              metadata: Metadata({ map: MapNameValue(new Map()) }),
              logo: OptionIpfsPath("None"),
            })
          )
        )
      ),
    }),
  });

  // Executable
  const executable = Executable(
    "Instructions",
    VecInstruction([Instruction("Register", registerBox)])
  )

  // PAYLOAD
  const payload = makeTransactionPayload({
    accountId: config.ACCOUNT_ID,
    executable: executable,
    // ttl?: bigint;
    // creationTime?: bigint;
    // nonce?: number;
  })

  console.log(payload);

  const payloadBuffer = TransactionPayload.toBuffer(payload);
  console.log("payloadBuffer", payloadBuffer);

  const payloadDecoded = TransactionPayload.fromBuffer(payloadBuffer);
  console.log("payloadDecoded", payloadDecoded);

  // GET HASH
  const hash = computeTransactionHash(payloadDecoded);
  const statusPromise = waitForTransactionStatus(hash);

  // SIGNED TX
  const signedTx = makeSignedTransaction(payloadDecoded, signer);
  console.log("signedTx", signedTx);

  const signedTxBuffer = VersionedTransaction.toBuffer(signedTx);
  console.log("signedTxBuffer", signedTxBuffer);

  const signedTxDecoded = VersionedTransaction.fromBuffer(signedTxBuffer);
  console.log("signedTxDecoded", signedTxDecoded);

  // SEND
  await torii.submit(signedTxDecoded);

  console.log("tx sent");

  try {
    const status = await statusPromise;
    console.log("status:", status);
  } catch (error) {
    console.log("ERROR:", error);
  }

}

////// Query Domain
async function ensureDomainExistence(domainName: string) {
  const result = await client.requestWithQueryBox(QueryBox("FindAllDomains", null));

  const domain = result
    .as("Ok")
    .result.as("Vec")
    .map((x) => x.as("Identifiable").as("Domain"))
    .find((x) => x.id.name === domainName);

  console.log(domain);
  if (!domain) throw new Error("Not found");
}

async function main() {
  const status = await torii.getStatus();
  console.log("status:", JSON.stringify(status));
  const health = await torii.getHealth();
  console.log("health:", JSON.stringify(health));

  const domainName = "my_test_domain23";

  console.log("\n### REGISTER DOMAIN");
  await registerDomain(domainName);
  // await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2s
  await ensureDomainExistence(domainName);
}

main();
