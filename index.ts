// doesn't expose any convenience features like a TransactionBuilder or a ConfigBuilder.

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
  AssetDefinition,
  AssetValueType,
  Mintable,
  AssetDefinitionId,
  EvaluatesToValue,
  IdBox,
  MintBox,
  EvaluatesToIdBox,
  AssetId,
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
    telemetryURL: "http://127.0.0.1:8081",
  },
  accountId: accountId,
  keyPair: kp,
});

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

  // Generation doesn't work
  // TODO - fix. Might be needed for test
  // const SEED_BYTES = [49, 50, 51, 52]; // todo - random
  // const keyAlgo = crypto.AlgorithmEd25519();
  // const config = new KeyGenConfiguration().useSeed(Uint8Array.from(SEED_BYTES)).withAlgorithm(keyAlgo);
  // const keyPair = crypto.generateKeyPairWithConfiguration(config);
  // console.log("KEY PAIR:", keyPair);

  // const publicKey = PublicKey({
  //   payload: keyPair.publicKey().payload(),
  //   digest_function: keyPair.publicKey().digestFunction(),
  // })
  // console.log("publicKey:", publicKey);

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

/**
 * FAILS
 * NotPermittedFail {
 * reason: "Validator CheckNested {
 *  validator: Or {
 *    first: OnlyAssetsCreatedByThisAccount, second: HasTokenAsValidator {
 *      has_token: GrantedByAssetCreator
 *    },
 *    _phantom_operation: PhantomData }
 *   } denied operation
 *   Register(
 *     RegisterBox {
 *      object: EvaluatesTo {
 *        expression: Raw(Identifiable(AssetDefinition(AssetDefinition {
 *          id: DefinitionId {
 *            name: \"gold\",
 *            domain_id: Id { name: \"my_test_domain\" } },
 *            value_type: Quantity,
 *            mintable: Infinitely,
 *      metadata: Metadata { map: {} }
 *  }))), _value_type: PhantomData } }):
 * Nor first validator OnlyAssetsCreatedByThisAccount succeed:
 *  Conversion Error: Failed converting from iroha_data_model::RegistrableBox to iroha_data_model::Value,
 * nor second validator HasTokenAsValidator { has_token: GrantedByAssetCreator } succeed:
 *  Unable to identify corresponding permission token: Conversion Error: Failed converting from iroha_data_model::RegistrableBox to iroha_data_model::Value",
 */
async function createAsset(assetName: string, domainName: string) {
  const assetDefinition = AssetDefinition({
    value_type: AssetValueType("Quantity"),
    id: AssetDefinitionId({
      name: assetName,
      domain_id: DomainId({ name: domainName }),
    }),
    metadata: Metadata({ map: MapNameValue(new Map()) }),
    mintable: Mintable("Infinitely"), // mintable
  });

  const registerBox = RegisterBox({
    object: EvaluatesToRegistrableBox({
      expression: Expression(
        "Raw",
        Value(
          "Identifiable",
          IdentifiableBox("AssetDefinition", assetDefinition)
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

// "Unsupported Mint instruction" ?? - FIXED
// Now: NotPermittedFail - neither of following succeeded:
//  - Can't mint assets with definitions registered by other accounts. (?)
//  - Account does not have the needed permission token: PermissionToken { name: \"can_mint_user_asset_definitions\", params: {\"asset_definition_id\": Id(AssetDefinitionId(DefinitionId { name: \"roses\", domain_id: Id { name: \"wonderland\" } }))} }."
async function mintAsset(
  accountName: string,
  domainName: string,
  assetName: string,
  amount: number
) {
  const assetId = AssetId({
    definition_id: AssetDefinitionId({
      name: assetName,
      domain_id: DomainId({ name: domainName }),
    }),
    account_id: AccountId({
      name: accountName,
      domain_id: DomainId({
        name: domainName,
      }),
    }),
  });

  const mintBox = MintBox({
    object: EvaluatesToValue({
      expression: Expression("Raw", Value("U32", amount)),
    }),
    destination_id: EvaluatesToIdBox({
      expression: Expression(
        'Raw',
        Value(
          'Id',
          IdBox( // idBox instead of AssetDefinitionId as described in the tutorial
            'AssetId', assetId
          ),
        ),
      )
    }),
  });

  await client.submit(
    Executable("Instructions", VecInstruction([Instruction("Mint", mintBox)]))
  );
}

async function main() {
  const domainName = "my_test_domain";
  // Register Domain
  //await registerDomain(domainName);

  // Register domain
  //await ensureDomainExistence(domainName);

  // Create Account
  // const newAccountName = "SomeNewAccount";
  // await createAccount(newAccountName, domainName);

  const assetName = "gold";
  // Create asset
  //await createAsset(assetName, domainName);

  // Mint asset
  await mintAsset("alice", "wonderland", "roses", 55);
}

main();
