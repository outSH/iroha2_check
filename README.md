Node: v16.15.0

Output:
``` bash
> js-client@1.0.0 build
> tsc

index.ts:135:11 - error TS7006: Parameter 'x' implicitly has an 'any' type.

135     .map((x) => x.as("Identifiable").as("Domain"))
              ~

index.ts:136:12 - error TS7006: Parameter 'x' implicitly has an 'any' type.

136     .find((x) => x.id.name === domainName);
               ~

monitor.ts:109:36 - error TS2339: Property 'as' does not exist on type 'Event'.

109     const { hash, status } = event.as("Pipeline");
                                       ~~

monitor.ts:114:18 - error TS7006: Parameter '_reason' implicitly has an 'any' type.

114       Rejected: (_reason) => "rejected",
                     ~~~~~~~

monitor.ts:137:48 - error TS2339: Property 'as' does not exist on type 'Event'.

137     const pipelineEvent: PipelineEvent = event.as("Pipeline");
                                                   ~~

monitor.ts:138:13 - error TS2339: Property 'entity_kind' does not exist on type 'PipelineEvent'.

138     const { entity_kind, hash, status } = pipelineEvent;
                ~~~~~~~~~~~

monitor.ts:138:26 - error TS2339: Property 'hash' does not exist on type 'PipelineEvent'.

138     const { entity_kind, hash, status } = pipelineEvent;
                             ~~~~

monitor.ts:138:32 - error TS2339: Property 'status' does not exist on type 'PipelineEvent'.

138     const { entity_kind, hash, status } = pipelineEvent;
                                   ~~~~~~

monitor.ts:143:18 - error TS7006: Parameter '_reason' implicitly has an 'any' type.

143       Rejected: (_reason) => "rejected",
                     ~~~~~~~

monitor.ts:183:40 - error TS2339: Property 'as' does not exist on type 'Event'.

183     const dataEvent: DataEvent = event.as("Data");
                                           ~~

monitor.ts:184:48 - error TS2339: Property 'as' does not exist on type 'DataEvent'.

184     const domainEvent: DomainEvent = dataEvent.as("Domain");
                                                   ~~

monitor.ts:185:52 - error TS2339: Property 'as' does not exist on type 'DomainEvent'.

185     const accountEvent: AccountEvent = domainEvent.as("Account");
                                                       ~~

monitor.ts:186:49 - error TS2339: Property 'as' does not exist on type 'AccountEvent'.

186     const assetEvent: AssetEvent = accountEvent.as("Asset");
                                                    ~~

monitor.ts:187:46 - error TS2339: Property 'as' does not exist on type 'AssetEvent'.

187     const addedAssetId: AssetId = assetEvent.as("Added");
                                                 ~~

monitor.ts:188:13 - error TS2339: Property 'definition_id' does not exist on type 'AssetId'.

188     const { definition_id, account_id } = addedAssetId;
                ~~~~~~~~~~~~~

monitor.ts:188:28 - error TS2339: Property 'account_id' does not exist on type 'AssetId'.

188     const { definition_id, account_id } = addedAssetId;
                               ~~~~~~~~~~


Found 16 errors in 2 files.

Errors  Files
     2  index.ts:135
    14  monitor.ts:109
```