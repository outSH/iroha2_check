// doesn't expose any convenience features like a TransactionBuilder or a ConfigBuilder.

import { crypto } from '@iroha2/crypto-target-node'
import { KeyPair } from '@iroha2/crypto-core'
import { setCrypto, Client } from '@iroha2/client'
import { hexToBytes } from 'hada'
import {
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
} from '@iroha2/data-model'

setCrypto(crypto)

function generateKeyPair(params: {
  publicKeyMultihash: string
  privateKey: {
    digestFunction: string
    payload: string
  }
}): KeyPair {
  const multihashBytes = Uint8Array.from(
    hexToBytes(params.publicKeyMultihash),
  )
  const multihash = crypto.createMultihashFromBytes(multihashBytes)
  const publicKey = crypto.createPublicKeyFromMultihash(multihash)
  const privateKey = crypto.createPrivateKeyFromJsKey(params.privateKey)

  const keyPair = crypto.createKeyPairFromKeys(publicKey, privateKey)

  // don't forget to "free" created structures
  for (const x of [publicKey, privateKey, multihash]) {
    x.free()
  }

  return keyPair
}

const kp = generateKeyPair({
  publicKeyMultihash:
    'ed0120e555d194e8822da35ac541ce9eec8b45058f4d294d9426ef97ba92698766f7d3',
  privateKey: {
    digestFunction: 'ed25519',
    payload:
      'de757bcb79f4c63e8fa0795edc26f86dfdba189b846e903d0b732bb644607720e555d194e8822da35ac541ce9eec8b45058f4d294d9426ef97ba92698766f7d3',
  },
})

const client = new Client({
  torii: {
    // Both URLs are optional - in case you need only a part of endpoints,
    // e.g. only Telemetry ones
    apiURL: 'http://127.0.0.1:8080',
    telemetryURL: 'http://127.0.0.1:8081',
  },
})

////////// Register domain
async function registerDomain(domainName: string) {
  const registerBox = RegisterBox({
    object: EvaluatesToRegistrableBox({
      expression: Expression(
        'Raw',
        Value(
          'Identifiable',
          IdentifiableBox(
            'NewDomain',
            NewDomain({
              id: DomainId({
                name: domainName,
              }),
              metadata: Metadata({ map: MapNameValue(new Map()) }),
              logo: OptionIpfsPath('None'),
            }),
          ),
        ),
      ),
    }),
  })

  await client.submit(
    Executable(
      'Instructions',
      VecInstruction([Instruction('Register', registerBox)]),
    ),
  )
}

////// Query Domain
async function ensureDomainExistence(domainName: string) {
  const result = await client.request(QueryBox('FindAllDomains', null))

  const domain = result
    .as('Ok')
    .result.as('Vec')
    .map((x) => x.as('Identifiable').as('Domain'))
    .find((x) => x.id.name === domainName)

  if (!domain) throw new Error('Not found')
}

async function main() {
  await registerDomain('test1');
  await ensureDomainExistence('test1');
}

main();