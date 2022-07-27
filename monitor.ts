import { hexToBytes, bytesToHex } from "hada";
import { crypto } from "@iroha2/crypto-target-node";
import { KeyPair } from "@iroha2/crypto-core";
import { setCrypto, Client, SetupEventsReturn, SetupBlocksStreamReturn } from "@iroha2/client";
import {
  AccountId,
  DomainId,
  AssetId,
  FilterBox,
  OptionHash,
  OptionPipelineEntityKind,
  OptionPipelineStatusKind,
  PipelineEntityKind,
  PipelineEventFilter,
  PipelineStatusKind,
  PipelineEvent,
  FilterOptEntityFilter,
  EntityFilter,
  FilterOptDomainFilter,
  DomainFilter,
  FilterOptIdFilterDomainId,
  FilterOptDomainEventFilter,
  DataEvent,
  DomainEvent,
  AccountEvent,
  AssetEvent,
} from "@iroha2/data-model";

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

const client = new Client({
  torii: {
    // Both URLs are optional - in case you need only a part of endpoints,
    // e.g. only Telemetry ones
    apiURL: "http://127.0.0.1:8080",
    telemetryURL: "http://127.0.0.1:8180",
  },
  accountId: accountId,
  keyPair: kp,
});

let monitor: SetupEventsReturn | undefined;

async function startMonitoringCommitedTx() {
  console.log("startMonitoringCommitedTx()");

  monitor = await client.listenForEvents({
    filter: FilterBox(
      'Pipeline',
      PipelineEventFilter({
        entity_kind: OptionPipelineEntityKind(
          'Some',
          PipelineEntityKind('Transaction'),
        ),
        status_kind: OptionPipelineStatusKind(
          'Some',
          PipelineStatusKind('Committed'),
        ),
        hash: OptionHash('None'),
      }),
    ),
  });
  console.log("monitor started...");

  monitor.ee.on('event', (event) => {
    const { hash, status } = event.as('Pipeline')
    const hexHash = bytesToHex([...hash]);
    const statusText = status.match({
      Validating: () => 'validating',
      Committed: () => 'committed',
      Rejected: (_reason) => 'rejected',
    });
    console.log(`\nTransaction [${statusText}] - ${hexHash}`);
  })
}

async function startMonitoringAnyPipeline() {
  console.log("startMonitoringAnyPipeline()");

  monitor = await client.listenForEvents({
    filter: FilterBox(
      'Pipeline',
      PipelineEventFilter({
        entity_kind: OptionPipelineEntityKind('None'),
        status_kind: OptionPipelineStatusKind('None'),
        hash: OptionHash('None'), // Q: What is this? Watch for block/tx with given hash?
      }),
    ),
  });
  console.log("monitor started...");

  monitor.ee.on('event', (event) => {
    //console.log("INCOMING EVENT:", JSON.stringify(event));
    const pipelineEvent: PipelineEvent = event.as('Pipeline');
    const { entity_kind, hash, status } = pipelineEvent;
    const hexHash = bytesToHex([...hash]);
    const statusText = status.match({
      Validating: () => 'validating',
      Committed: () => 'committed',
      Rejected: (_reason) => 'rejected',
    });
    const kindText = entity_kind.match({
      Block: () => 'Block',
      Transaction: () => 'Transaction',
    });
    console.log(`\n${kindText} [${statusText}] - ${hexHash}`);
  })
}

async function startMonitoringByDomain(domainName: string) {
  console.log("startMonitoringByDomain()");

  monitor = await client.listenForEvents({
    filter: FilterBox(
      'Data',
      FilterOptEntityFilter("BySome", EntityFilter(
        'ByDomain',
        FilterOptDomainFilter('BySome', DomainFilter({
          id_filter: FilterOptIdFilterDomainId("BySome", DomainId({
            name: domainName,
          })),
          event_filter: FilterOptDomainEventFilter('AcceptAll'),
        }
        ))
      )),
    ),
  });
  console.log("monitor started...");

  monitor.ee.on('event', (event) => {
    //console.log("INCOMING EVENT:", JSON.stringify(event));
    const dataEvent: DataEvent = event.as('Data');
    const domainEvent: DomainEvent = dataEvent.as('Domain');
    const accountEvent: AccountEvent = domainEvent.as('Account');
    const assetEvent: AssetEvent = accountEvent.as('Asset');
    const addedAssetId: AssetId = assetEvent.as('Added');
    const { definition_id, account_id} = addedAssetId;
    console.log(`\nAsset inc ${definition_id.name}#${definition_id.domain_id.name} by account ${account_id.name}@${account_id.domain_id.name}`);
  });
}

// Doesn't work :/
let blockMonitor: SetupBlocksStreamReturn | undefined;
async function monitorBlocks() {
  blockMonitor = await client.listenForBlocksStream({ height: BigInt(0) }); // height?

  blockMonitor.ee.on("block", (block) => {
    console.log("block:", JSON.stringify(block));
  });
}

async function stopMonitoring() {
  if (monitor) {
    console.log("\nStop monitoring...");
    await monitor.stop();
    monitor = undefined;
  }

  if (blockMonitor) {
    console.log("\nStop block monitoring...");
    await blockMonitor.stop();
    blockMonitor = undefined;
  }
}

process.on('uncaughtException', stopMonitoring);
process.on('SIGINT', stopMonitoring);
process.on('exit', stopMonitoring);

// ./iroha_client_cli asset mint --account="mad_hatter@looking_glass" --asset="tea#looking_glass" --quantity="100"
startMonitoringByDomain("looking_glass");
