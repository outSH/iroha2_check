import fs from "fs";
import { hexToBytes } from "hada";

import { crypto } from "@iroha2/crypto-target-node";
import { KeyPair } from "@iroha2/crypto-core";
import { Client, Signer, Torii, setCrypto } from '@iroha2/client'
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
} from "@iroha2/data-model";

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

const { torii, client } = clientFactory();

// verbose log in docker compose
torii.setPeerConfig({ LogLevel: "TRACE" });

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

  await client.submitExecutable(
    Executable(
      "Instructions",
      VecInstruction([Instruction("Register", registerBox)])
    )
  );
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

async function getDomain(domainName: string) {
  const result = await client.requestWithQueryBox(
    QueryBox(
      "FindDomainById",
      FindDomainById({
        id: EvaluatesToDomainId({
          expression: Expression(
            "Raw",
            Value(
              "Id",
              IdBox(
                "DomainId",
                DomainId({
                  name: domainName,
                })
              )
            )
          ),
        }),
      })
    )
  );

  console.log("getDomain() result:", result);
  const domain = result.as("Ok").result.as("Identifiable").as("Domain");

  console.log("getDomain() domain:", domain);
  if (!domain || domain.id.name != domainName) {
    throw new Error(`Could not find domain ${domainName}`);
  }

  return domain;
}

async function createAccount(accountName: string, domainName: string) {
  const accountId = AccountId({
    name: accountName,
    domain_id: DomainId({
      name: domainName,
    }),
  });

  // ERROR
  // Error: null pointer passed to rust
  // at module.exports.__wbindgen_throw (/home/vagrant/iroha2/js-client/node_modules/@iroha2/crypto-target-node/dist/wasm/crypto.js:873:11)
  // at wasm://wasm/0076bb3a:wasm-function[607]:0xb52ad
  // at wasm://wasm/0076bb3a:wasm-function[605]:0xb5293
  // at wasm://wasm/0076bb3a:wasm-function[229]:0xa4b97
  // at KeyGenConfiguration.useSeed (/home/vagrant/iroha2/js-client/node_modules/@iroha2/crypto-target-node/dist/wasm/crypto.js:418:24)
  // at createAccount (/home/vagrant/iroha2/js-client/dist/index.js:84:74)
  // at main (/home/vagrant/iroha2/js-client/dist/index.js:170:11)
  // at processTicksAndRejections (node:internal/process/task_queues:96:5)
  ///////////////
  // const SEED_BYTES = [11, 22, 33, 44, 55, 66, 77, 88];
  // const keyAlgo = crypto.AlgorithmEd25519();
  // const config = new (crypto as any).KeyGenConfiguration().useSeed(Uint8Array.from(SEED_BYTES)).withAlgorithm(keyAlgo);
  // const keyPair = crypto.generateKeyPairWithConfiguration(config);
  // console.log("KEY PAIR:", keyPair);
  // const publicKey2 = PublicKey({
  //   payload: keyPair.publicKey().payload(),
  //   digest_function: keyPair.publicKey().digestFunction(),
  // })
  // console.log("publicKey2:", publicKey2);
  ////////////////

  // Load key from fs. First run manually:
  // openssl genpkey -algorithm ed25519 -outform PEM -out ./dist/private.pem
  // openssl pkey -in ./dist/private.pem -inform PEM -pubout -out ./dist/public.pem
  const pkeyPem = fs.readFileSync("./dist/public.pem");
  const publicKey = PublicKey({
    payload: pkeyPem,
    digest_function: "ed25519",
  });

  const registerBox = RegisterBox({
    object: EvaluatesToRegistrableBox({
      expression: Expression(
        "Raw",
        Value(
          "Identifiable",
          IdentifiableBox(
            "NewAccount",
            NewAccount({
              // another opt: Account, more details
              id: accountId,
              signatories: VecPublicKey([publicKey]),
              metadata: Metadata({ map: MapNameValue(new Map()) }),
            })
          )
        )
      ),
    }),
  });

  await client.submitExecutable(
    Executable(
      "Instructions",
      VecInstruction([Instruction("Register", registerBox)])
    )
  );
}

async function getAccount(name: string, domainName: string) {
  const accountId = AccountId({
    name: name,
    domain_id: DomainId({
      name: domainName,
    }),
  });

  const result = await client.requestWithQueryBox(
    QueryBox(
      "FindAccountById",
      FindAccountById({
        id: EvaluatesToAccountId({
          expression: Expression(
            "Raw",
            Value("Id", IdBox("AccountId", accountId))
          ),
        }),
      })
    )
  );

  console.log("getAccount() result:", result);
  const account = result.as("Ok").result.as("Identifiable").as("Account");

  console.log("getAccount() account:", account);
  if (!account || account.id.name != name) {
    throw new Error(`Could not find account ${name}:${domainName}`);
  }

  return account;
}

// Add Asset
async function createAsset(assetName: string, domainName: string) {
  const assetDefinitionId = AssetDefinitionId({
    name: assetName,
    domain_id: DomainId({ name: domainName }),
  });

  const newAssetDef = NewAssetDefinition({
    id: assetDefinitionId,
    value_type: AssetValueType("Quantity"),
    metadata: Metadata({
      map: MapNameValue(new Map([["myTag", Value("String", "testMeta")]])),
    }),
    mintable: Mintable("Infinitely"),
  });

  const registerBox = RegisterBox({
    object: EvaluatesToRegistrableBox({
      expression: Expression(
        "Raw",
        Value(
          "Identifiable",
          IdentifiableBox("NewAssetDefinition", newAssetDef)
        )
      ),
    }),
  });

  await client.submitExecutable(
    Executable(
      "Instructions",
      VecInstruction([Instruction("Register", registerBox)])
    )
  );
}

async function getAsset(
  assetName: string,
  assetDomainName: string,
  accountName: string,
  accountDomainName: string
) {
  const assetId = AssetId({
    account_id: AccountId({
      name: accountName,
      domain_id: DomainId({
        name: accountDomainName,
      }),
    }),
    definition_id: AssetDefinitionId({
      name: assetName,
      domain_id: DomainId({ name: assetDomainName }),
    }),
  });

  const result = await client.requestWithQueryBox(
    QueryBox(
      "FindAssetById",
      FindAssetById({
        id: EvaluatesToAssetId({
          expression: Expression("Raw", Value("Id", IdBox("AssetId", assetId))),
        }),
      })
    )
  );

  console.log("getAsset() result:", result);
  const asset = result.as("Ok").result.as("Identifiable").as("Asset");

  console.log("getAsset() asset:", asset);
  if (!asset || asset.id.definition_id.name != assetName) {
    throw new Error(`Could not find asset ${assetName}`);
  }

  return asset;
}

async function getAssetQuantity(
  assetName: string,
  assetDomainName: string,
  accountName: string,
  accountDomainName: string
) {
  try {
    const asset = await getAsset(
      assetName,
      assetDomainName,
      accountName,
      accountDomainName
    );
    return asset.value.as("Quantity").valueOf();
  } catch {
    return 0;
  }
}

async function mintAsset(
  accountName: string,
  accountDomainName: string,
  assetName: string,
  assetDomainName: string,
  amount: number
) {
  const assetId = AssetId({
    account_id: AccountId({
      name: accountName,
      domain_id: DomainId({
        name: accountDomainName,
      }),
    }),
    definition_id: AssetDefinitionId({
      name: assetName,
      domain_id: DomainId({ name: assetDomainName }),
    }),
  });

  const mintBox = MintBox({
    object: EvaluatesToValue({
      expression: Expression("Raw", Value("U32", amount)),
    }),
    // destination_id: EvaluatesToRegistrableBox({
    destination_id: EvaluatesToRegistrableBox({
      // EvaluatesToIdBox
      expression: Expression(
        "Raw",
        Value(
          "Id",
          IdBox(
            // idBox instead of AssetDefinitionId as described in the tutorial
            "AssetId",
            assetId
          )
        )
      ),
    }),
  });

  await client.submitExecutable(
    Executable("Instructions", VecInstruction([Instruction("Mint", mintBox)]))
  );
}

async function main() {
  const status = await torii.getStatus();
  console.log("status:", JSON.stringify(status));
  const health = await torii.getHealth();
  console.log("health:", JSON.stringify(health));

  const domainName = "my_test_domain";
  const assetName = "gold";

  console.log("\n### REGISTER DOMAIN");
  await registerDomain(domainName);
  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2s
  await ensureDomainExistence(domainName);
  await getDomain(domainName);

  console.log("\n### CREATE ACCOUNT");
  const newAccountName = "SomeNewAccount";
  await createAccount(newAccountName, domainName);
  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2s
  await getAccount(newAccountName, domainName);

  console.log("\n### CREATE ASSET");
  await createAsset(assetName, domainName);
  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2s
  // WARNING: Asset must be minted before it can be searched by ID!

  console.log("\n### MINT ASSET");
  // Get initial balance
  const initialQuant = await getAssetQuantity(
    assetName,
    domainName,
    config.ACCOUNT_ID.name,
    config.ACCOUNT_ID.domain_id.name
  );
  console.log("initialQuant:", initialQuant);

  // Mint
  const amount = 55;
  await mintAsset(
    config.ACCOUNT_ID.name,
    config.ACCOUNT_ID.domain_id.name,
    assetName,
    domainName,
    amount
  );
  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2s

  // Get final balance
  const finalQuant = await getAssetQuantity(
    assetName,
    domainName,
    config.ACCOUNT_ID.name,
    config.ACCOUNT_ID.domain_id.name
  );
  console.log("finalQuant:", finalQuant);

  if (finalQuant != initialQuant + amount) {
    throw new Error("Invalid balance after mint operation!");
  }
}

main();
