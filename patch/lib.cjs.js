"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/client/dist-tsc/lib.js
var lib_exports = {};
__export(lib_exports, {
  Client: () => Client,
  ClientIncompleteConfigError: () => ClientIncompleteConfigError,
  ResponseError: () => ResponseError,
  getCrypto: () => getCrypto,
  setCrypto: () => setCrypto,
  setupBlocksStream: () => setupBlocksStream,
  setupEvents: () => setupEvents
});
module.exports = __toCommonJS(lib_exports);

// packages/client/dist-tsc/client.js
var import_data_model3 = require("@iroha2/data-model");
var fetch = require("node-fetch");
var import_client_isomorphic_fetch = {
  fetch
}

// packages/client/dist-tsc/collect-garbage.js
var currentScope = null;
function createScope() {
  const state = {
    garbage: []
  };
  return {
    run(cb) {
      if (currentScope)
        throw new Error("Already in the scope");
      try {
        currentScope = state;
        cb();
      } finally {
        currentScope = null;
      }
    },
    free() {
      for (const x of state.garbage) {
        x.free();
      }
      state.garbage = [];
    }
  };
}
function collect(some) {
  if (!currentScope)
    throw new Error("Used out of a scope");
  currentScope.garbage.push(some);
  return some;
}

// packages/client/dist-tsc/util.js
var import_client_isomorphic_ws = require("@iroha2/client-isomorphic-ws");
var import_emittery = __toESM(require("emittery"));
var import_parse = __toESM(require("json-bigint/lib/parse"));
var MAX_SAFE_U32 = 4294967295;
function randomU32() {
  return ~~(Math.random() * MAX_SAFE_U32);
}
function transformProtocolInUrlFromHttpToWs(url) {
  return url.replace(/^https?:\/\//, (substr) => {
    const isSafe = /https/.test(substr);
    return `ws${isSafe ? "s" : ""}://`;
  });
}
function setupWebSocket(params) {
  const debug3 = params.parentDebugger.extend("websocket");
  const url = transformProtocolInUrlFromHttpToWs(params.baseURL) + params.endpoint;
  const ee = new import_emittery.default();
  debug3("opening connection to %o", url);
  const { isClosed, send, close } = (0, import_client_isomorphic_ws.initWebSocket)({
    url,
    onopen: (e) => {
      debug3("connection opened");
      ee.emit("open", e);
    },
    onclose: (e) => {
      debug3("connection closed; code: %o, reason: %o, was clean: %o", e.code, e.reason, e.wasClean);
      ee.emit("close", e);
    },
    onerror: (e) => {
      debug3("connection error %o", e);
      ee.emit("error", e);
    },
    onmessage: ({ data }) => {
      debug3("message", data);
      ee.emit("message", data);
    }
  });
  async function closeAsync() {
    if (isClosed())
      return;
    debug3("closing connection...");
    close();
    return ee.once("close").then(() => {
    });
  }
  async function accepted() {
    return new Promise((resolve, reject) => {
      ee.once("accepted").then(resolve);
      ee.once("close").then(() => {
        reject(new Error("Handshake acquiring failed - connection closed"));
      });
    });
  }
  return { isClosed, send, close: closeAsync, ee, accepted };
}
var jsonBigIntParse = (0, import_parse.default)({ useNativeBigInt: true });
function parseJsonWithBigInts(raw) {
  return jsonBigIntParse(raw);
}
if (void 0) {
  const { test, expect } = void 0;
  test("When plain JSON is passed, it parses numbers as plain numbers", () => {
    const raw = `{"num":123}`;
    const parsed = { num: 123 };
    const actual = parseJsonWithBigInts(raw);
    expect(actual).toEqual(parsed);
  });
  test("When JSON with too big ints is passed, it parses numbers as BigInts", () => {
    const raw = `{"num":123456789123456789}`;
    const parsed = { num: 123456789123456789n };
    const actual = parseJsonWithBigInts(raw);
    expect(actual).toEqual(parsed);
  });
}

// packages/client/dist-tsc/crypto-singleton.js
var __crypto = null;
function setCrypto(crypto) {
  __crypto = crypto;
}
function getCrypto() {
  return __crypto;
}

// packages/client/dist-tsc/events.js
var import_data_model = require("@iroha2/data-model");
var import_debug = __toESM(require("debug"));

// packages/client/dist-tsc/const.js
var ENDPOINT_HEALTH = "/health";
var ENDPOINT_TRANSACTION = "/transaction";
var ENDPOINT_QUERY = "/query";
var ENDPOINT_CONFIGURATION = "/configuration";
var ENDPOINT_EVENTS = "/events";
var ENDPOINT_BLOCKS_STREAM = "/block/stream";
var ENDPOINT_STATUS = "/status";
var ENDPOINT_METRICS = "/metrics";
var HEALTHY_RESPONSE = `"Healthy"`;

// packages/client/dist-tsc/events.js
var debug = (0, import_debug.default)("@iroha2/client:events");
async function setupEvents(params) {
  const { ee, isClosed, close, accepted, send: sendRaw } = setupWebSocket({
    baseURL: params.toriiApiURL,
    endpoint: ENDPOINT_EVENTS,
    parentDebugger: debug
  });
  function send(msg) {
    sendRaw(import_data_model.VersionedEventSubscriberMessage.toBuffer((0, import_data_model.VersionedEventSubscriberMessage)("V1", msg)));
  }
  ee.on("open", () => {
    send((0, import_data_model.EventSubscriberMessage)("SubscriptionRequest", params.filter));
  });
  ee.on("message", (raw) => {
    const event = import_data_model.VersionedEventPublisherMessage.fromBuffer(raw).as("V1");
    if (event.is("SubscriptionAccepted")) {
      debug("subscription accepted");
      ee.emit("accepted");
    } else {
      ee.emit("event", event.as("Event"));
      send((0, import_data_model.EventSubscriberMessage)("EventReceived"));
    }
  });
  await accepted();
  return {
    stop: close,
    ee,
    isClosed
  };
}

// packages/client/dist-tsc/blocks-stream.js
var import_debug2 = __toESM(require("debug"));
var import_data_model2 = require("@iroha2/data-model");
var debug2 = (0, import_debug2.default)("@iroha2/client:blocks-stream");
async function setupBlocksStream(params) {
  const { ee, send: sendRaw, isClosed, close, accepted } = setupWebSocket({
    baseURL: params.toriiApiURL,
    endpoint: ENDPOINT_BLOCKS_STREAM,
    parentDebugger: debug2
  });
  function send(msg) {
    sendRaw(import_data_model2.VersionedBlockSubscriberMessage.toBuffer((0, import_data_model2.VersionedBlockSubscriberMessage)("V1", msg)));
  }
  ee.on("open", () => {
    send((0, import_data_model2.BlockSubscriberMessage)("SubscriptionRequest", params.height));
  });
  ee.on("message", (raw) => {
    const msg = import_data_model2.VersionedBlockPublisherMessage.fromBuffer(raw).as("V1");
    msg.match({
      SubscriptionAccepted() {
        debug2("subscription accepted");
        ee.emit("accepted");
      },
      Block(block) {
        debug2("new block: %o", block);
        ee.emit("block", block);
        send((0, import_data_model2.BlockSubscriberMessage)("BlockReceived"));
      }
    });
  });
  await accepted();
  return {
    ee,
    stop: close,
    isClosed
  };
}

// packages/client/dist-tsc/client.js
function useCryptoAssertive() {
  const crypto = getCrypto();
  if (!crypto) {
    throw new Error('"crypto" is not defined, but required for Iroha Client to function. Have you set it with `setCrypto()`?');
  }
  return crypto;
}
var ClientIncompleteConfigError = class extends Error {
  constructor(missing) {
    super(`You are trying to use client with incomplete configuration. Missing: ${missing}`);
  }
};
var ResponseError = class extends Error {
  static throwIfStatusIsNot(response, status) {
    if (response.status !== status)
      throw new ResponseError(response);
  }
  constructor(response) {
    super(`${response.status}: ${response.statusText}`);
  }
};
function makeSignature(keyPair, payload) {
  const { createSignature } = useCryptoAssertive();
  const signature = collect(createSignature(keyPair, payload));
  const pubKey = keyPair.publicKey();
  return (0, import_data_model3.Signature)({
    public_key: (0, import_data_model3.PublicKey)({
      digest_function: pubKey.digestFunction(),
      payload: pubKey.payload()
    }),
    payload: signature.signatureBytes()
  });
}
var Client = class {
  toriiApiURL;
  toriiTelemetryURL;
  keyPair;
  accountId;
  transactionDefaultTTL;
  transactionAddNonce;
  constructor(config) {
    this.toriiApiURL = config.torii.apiURL ?? null;
    this.toriiTelemetryURL = config.torii.telemetryURL ?? null;
    this.transactionAddNonce = config.transaction?.addNonce ?? false;
    this.transactionDefaultTTL = config.transaction?.timeToLiveMs ?? 100000n;
    this.keyPair = config.keyPair ?? null;
    this.accountId = config.accountId ?? null;
  }
  async getHealth() {
    const url = this.forceGetApiURL();
    try {
      const response = await (0, import_client_isomorphic_fetch.fetch)(url + ENDPOINT_HEALTH);
      ResponseError.throwIfStatusIsNot(response, 200);
      const text = await response.text();
      if (text !== HEALTHY_RESPONSE) {
        return import_data_model3.Enum.variant("Err", `Expected '${HEALTHY_RESPONSE}' response; got: '${text}'`);
      }
      return import_data_model3.Enum.variant("Ok", null);
    } catch (err) {
      return import_data_model3.Enum.variant("Err", `Some error occured: ${String(err)}`);
    }
  }
  async submit(executable, params) {
    const scope = createScope();
    const { createHash } = useCryptoAssertive();
    const accountId = this.forceGetAccountId();
    const keyPair = this.forceGetKeyPair();
    const url = this.forceGetApiURL();
    const payload = (0, import_data_model3.TransactionPayload)({
      instructions: executable,
      time_to_live_ms: this.transactionDefaultTTL,
      nonce: params?.nonce ? (0, import_data_model3.OptionU32)("Some", params.nonce) : this.transactionAddNonce ? (0, import_data_model3.OptionU32)("Some", randomU32()) : (0, import_data_model3.OptionU32)("None"),
      metadata: params?.metadata ?? (0, import_data_model3.MapNameValue)(/* @__PURE__ */ new Map()),
      creation_time: BigInt(Date.now()),
      account_id: accountId
    });
    try {
      let finalBytes;
      scope.run(() => {
        const payloadHash = collect(createHash(import_data_model3.TransactionPayload.toBuffer(payload)));
        const signature = makeSignature(keyPair, payloadHash.bytes());
        finalBytes = import_data_model3.VersionedTransaction.toBuffer((0, import_data_model3.VersionedTransaction)("V1", (0, import_data_model3.Transaction)({ payload, signatures: (0, import_data_model3.VecSignatureOfTransactionPayload)([signature]) })));
      });
      const response = await (0, import_client_isomorphic_fetch.fetch)(url + ENDPOINT_TRANSACTION, {
        body: finalBytes,
        method: "POST"
      });
      ResponseError.throwIfStatusIsNot(response, 200);
    } finally {
      scope.free();
    }
  }
  async request(query, params) {
    const scope = createScope();
    const { createHash } = useCryptoAssertive();
    const url = this.forceGetApiURL();
    const accountId = this.forceGetAccountId();
    const keyPair = this.forceGetKeyPair();
    const payload = (0, import_data_model3.QueryPayload)({
      query,
      account_id: accountId,
      timestamp_ms: BigInt(Date.now()),
      filter: params?.filter ?? (0, import_data_model3.PredicateBox)("Raw", (0, import_data_model3.Predicate)("Pass"))
    });
    try {
      let queryBytes;
      scope.run(() => {
        const payloadHash = collect(createHash(import_data_model3.QueryPayload.toBuffer(payload)));
        const signature = makeSignature(keyPair, payloadHash.bytes());
        queryBytes = import_data_model3.VersionedSignedQueryRequest.toBuffer((0, import_data_model3.VersionedSignedQueryRequest)("V1", (0, import_data_model3.SignedQueryRequest)({ payload, signature })));
      });
      const response = await (0, import_client_isomorphic_fetch.fetch)(url + ENDPOINT_QUERY, {
        method: "POST",
        body: queryBytes
      }).then();
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (response.status === 200) {
        const value = import_data_model3.VersionedPaginatedQueryResult.fromBuffer(bytes).as("V1");
        return import_data_model3.Enum.variant("Ok", value);
      } else {
        const error = import_data_model3.QueryError.fromBuffer(bytes);
        return import_data_model3.Enum.variant("Err", error);
      }
    } finally {
      scope.free();
    }
  }
  async listenForEvents(params) {
    return setupEvents({
      filter: params.filter,
      toriiApiURL: this.forceGetApiURL()
    });
  }
  async listenForBlocksStream(params) {
    return setupBlocksStream({
      height: params.height,
      toriiApiURL: this.forceGetApiURL()
    });
  }
  async setPeerConfig(params) {
    const response = await (0, import_client_isomorphic_fetch.fetch)(this.forceGetApiURL() + ENDPOINT_CONFIGURATION, {
      method: "POST",
      body: JSON.stringify(params),
      headers: {
        "Content-Type": "application/json"
      }
    });
    ResponseError.throwIfStatusIsNot(response, 200);
  }
  async getStatus() {
    const response = await (0, import_client_isomorphic_fetch.fetch)(this.forceGetTelemetryURL() + ENDPOINT_STATUS);
    ResponseError.throwIfStatusIsNot(response, 200);
    return response.text().then(parseJsonWithBigInts);
  }
  async getMetrics() {
    return (0, import_client_isomorphic_fetch.fetch)(this.forceGetTelemetryURL() + ENDPOINT_METRICS).then((response) => {
      ResponseError.throwIfStatusIsNot(response, 200);
      return response.text();
    });
  }
  forceGetApiURL() {
    if (!this.toriiApiURL)
      throw new ClientIncompleteConfigError("Torii API URL");
    return this.toriiApiURL;
  }
  forceGetTelemetryURL() {
    if (!this.toriiTelemetryURL)
      throw new ClientIncompleteConfigError("Torii Telemetry URL");
    return this.toriiTelemetryURL;
  }
  forceGetAccountId() {
    if (!this.accountId)
      throw new ClientIncompleteConfigError("Account ID");
    return this.accountId;
  }
  forceGetKeyPair() {
    if (!this.keyPair)
      throw new ClientIncompleteConfigError("Key Pair");
    return this.keyPair;
  }
};
//# sourceMappingURL=lib.cjs.js.map
