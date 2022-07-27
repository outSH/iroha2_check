import fs from "fs";
import { hexToBytes } from "hada";

import { crypto } from "@iroha2/crypto-target-node";
import { KeyPair } from "@iroha2/crypto-core";
import { setCrypto, Client } from "@iroha2/client";
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
} from "@iroha2/data-model";

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

// More options available - https://github.com/hyperledger/iroha/issues/2118 and UserConfig
const client = new Client({
  torii: {
    apiURL: config.TORII_API_URL,
    telemetryURL: config.TORII_TELEMETRY_URL,
  },
  accountId: config.ACCOUNT_ID,
  keyPair: kp,
});

// verbose log in docker compose
client.setPeerConfig({ LogLevel: "TRACE" });

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

  await client.submit(
    Executable(
      "Instructions",
      VecInstruction([Instruction("Register", registerBox)])
    )
  );
}

////// Query Domain
async function ensureDomainExistence(domainName: string) {
  const result = await client.request(QueryBox("FindAllDomains", null));

  const domain = result
    .as("Ok")
    .result.as("Vec")
    .map((x) => x.as("Identifiable").as("Domain"))
    .find((x) => x.id.name === domainName);

  console.log(domain);
  if (!domain) throw new Error("Not found");
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

  await client.submit(
    Executable(
      "Instructions",
      VecInstruction([Instruction("Register", registerBox)])
    )
  );
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
    metadata: Metadata({ map: MapNameValue(new Map([["myTag", Value("String", "testMeta")]])) }),
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

  await client.submit(
    Executable(
      "Instructions",
      VecInstruction([Instruction("Register", registerBox)])
    )
  );
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

  await client.submit(
    Executable("Instructions", VecInstruction([Instruction("Mint", mintBox)]))
  );
}

async function main() {
  const status = await client.getStatus();
  console.log("status:", JSON.stringify(status));
  const health = await client.getHealth();
  console.log("health:", JSON.stringify(health));

  const domainName = "my_test_domain";
  const assetName = "gold";

  // Register Domain
  await registerDomain(domainName);
  await ensureDomainExistence(domainName);

  // Create Account
  const newAccountName = "SomeNewAccount";
  await createAccount(newAccountName, domainName);

  // Create asset
  await createAsset(assetName, domainName);

  // Mint asset
  await mintAsset(
    config.ACCOUNT_ID.name,
    config.ACCOUNT_ID.domain_id.name,
    assetName,
    domainName,
    55
  );
}

main();
