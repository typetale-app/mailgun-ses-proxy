# Opt-in index-first analytics ID pages (draft)

The Mailgun-compatible `/v3/[siteId]/events` endpoint currently uses offset pagination and orders by notification **id**. This change preserves that contract: it does not introduce a cursor, change to chronological ordering, alter timestamp formatting, change time-bound exclusivity or change the `paging.next` increment. The dashboard events endpoint is not changed.

## Design

With `ANALYTICS_INDEX_FIRST=true`, select only matching notification IDs first, using the `(type, id, created)` index and a notification-first join. Each requested type contributes at most `start + limit` matching IDs. The small union is sorted/limited globally before Prisma hydrates payloads by primary key. Values are parameterized, ordering is static SQL, and the hydration step repeats site/type/date filters. A concurrent delete or filter change between these two reads fails the page for retry rather than returning a silently incomplete page. This is not snapshot isolation.

The flag is **off by default**. Unset it or set any value other than `true` to restore the existing ORM read path. This fallback is an operator decision, not an automatic retry after a slow/failed query.

## Trade-offs and gates

- The `(type,id,created)` index serves the upstream ID ordering; `created` is a residual filter, not the leading date-range key. Sparse recent windows and tenant-selective results may still scan many rows. No universal latency guarantee is claimed.
- Large legacy offsets still require work proportional to the offset. A keyset/chronological API is a separate compatibility change, not part of this proposal.
- `FORCE INDEX` / `STRAIGHT_JOIN` constrain optimizer choices. Validate on representative MySQL/MariaDB workloads (broad/narrow/empty date windows, ascending/descending, one/multiple types, offset depth and tenant sizes) before enabling. MySQL 8.4.7 was exercised; MariaDB testing remains a review gate.
- The additional index consumes disk and write I/O. `ALGORITHM=INPLACE LOCK=NONE` refuses a blocking/table-copy fallback where unsupported, but online DDL still needs metadata locks, temporary space and operational monitoring.
- **The feature flag does not prevent the index build.** `npm start` runs `prisma migrate deploy`. On a large DB, do not blindly deploy this draft: schedule and review the migration separately, measure free space, long transactions, lock wait and index creation time, then deploy with the flag off. Enable only after response parity/load tests pass. Never rebuild a production table as an implicit test.
- Query rollback: disable the flag and redeploy/restart by the installation's existing method after approval. Leave the index in place initially; index removal and migration-history reconciliation are separate reviewed operations.

## Verification

```sh
# Generate client with a local fixture/dummy URL (generation does not connect).
npm run db:generate
npm run test:run -- tests/analytics-id-pagination.test.ts
# Requires Docker access and mysql:8.4.7 already cached. No implicit image pull.
node scripts/test-analytics-id-pagination.mjs
```

The Docker runner creates a memory/CPU-capped disposable server with **no network**, tmpfs data, no host data volume, no published ports and synthetic `.test` recipients only. It checks final server readiness, runs the upstream initial schema plus the new migration, tests exact ordered-ID parity for both directions, offsets, duplicate event types, tenant exclusion and exclusive dates, checks an index plan, then removes the exact container and its anonymous volumes. Unit tests also cover payload, next URL, rollback flag, parameter binding and concurrent row loss. These tests are correctness evidence, not a production benchmark or certification for every DB version.

No site-specific retention, private escrow, production payloads, database credentials or dependency upgrades belong in this contribution.
