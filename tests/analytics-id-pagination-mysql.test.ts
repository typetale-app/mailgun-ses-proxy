import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
// Only fixture literals: real application execution uses Prisma bound values.
function escape(value: unknown): string {
    if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
    if (typeof value !== 'string') throw new Error('Unexpected fixture parameter')
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}
import { buildAnalyticsIdPage } from '@/service/events-service/events-id-query'

// Opt-in only. Never connect to a user's DB. The runner owns a disposable
// network-disabled MySQL container with synthetic data and removes it later.
const container = process.env.ANALYTICS_TEST_MYSQL_CONTAINER || ''
const enabled = /^analytics-upstream-fixture-[a-z0-9-]+$/.test(container)
function run(sql: string) {
    if (!enabled) throw new Error('Disposable test container required')
    const result = spawnSync('docker', ['exec', '-i', container, 'mysql', '-uroot', '--batch', '--raw', '--skip-column-names'], { input: sql, encoding: 'utf8', timeout: 10000 })
    if (result.status !== 0) throw new Error(`Fixture SQL failed: ${result.stderr}`)
    return result.stdout.trim().split('\n').filter(Boolean)
}
function bind(query: ReturnType<typeof buildAnalyticsIdPage>) {
    let index = 0
    return query.sql.replace(/\?/g, () => {
        const value = query.values[index++]
        return escape(value instanceof Date ? value.toISOString().slice(0, 23).replace('T', ' ') : value)
    })
}
const params = { siteId: 'tenant-a', type: 'delivered OR opened', begin: 10, end: 20, order: 'asc' as const, start: 0, limit: 2, url: 'https://fixture.test/events' }

describe.skipIf(!enabled)('synthetic MySQL ID-page parity and index migration', () => {
    beforeAll(() => {
        const initial = readFileSync('prisma/migrations/20250502124523_init/migration.sql', 'utf8')
        const index = readFileSync('prisma/migrations/20261006000000_add_analytics_id_page_index/migration.sql', 'utf8')
        run(`CREATE DATABASE analytics_fixture; USE analytics_fixture; ${initial} ${index}
          INSERT INTO NewsletterBatch (id,siteId,fromEmail,contents,batchId,created) VALUES
          ('batch-a','tenant-a','fixture@example.test','{}','campaign-a','1970-01-01'),
          ('batch-b','tenant-b','fixture@example.test','{}','campaign-b','1970-01-01');
          INSERT INTO NewsletterMessages (id,messageId,toEmail,newsletterBatchId,created,formatedContents) VALUES
          ('message-row-a','message-a','synthetic@example.test','batch-a','1970-01-01',''),
          ('message-row-b','message-b','synthetic@example.test','batch-b','1970-01-01','');
          INSERT INTO NewsletterNotifications (id,type,notificationId,messageId,rawEvent,timestamp,created) VALUES
          ('01','delivered','notice-1','message-a','{}','1970-01-01','1970-01-01 00:00:15'),
          ('02','opened','notice-2','message-b','{}','1970-01-01','1970-01-01 00:00:15'),
          ('03','opened','notice-3','message-a','{}','1970-01-01','1970-01-01 00:00:15'),
          ('04','delivered','notice-4','message-a','{}','1970-01-01','1970-01-01 00:00:17'),
          ('05','opened','notice-5','message-a','{}','1970-01-01','1970-01-01 00:00:10'),
          ('06','opened','notice-6','message-a','{}','1970-01-01','1970-01-01 00:00:20'),
          ('07','failed','notice-7','message-a','{}','1970-01-01','1970-01-01 00:00:14'),
          ('08','opened','notice-8','message-a','{}','1970-01-01','1970-01-01 00:00:11');`)
    })
    for (const order of ['asc', 'desc'] as const) {
        for (const types of [['delivered'], ['opened','delivered'], ['opened','opened'], ['opened','opéned'], ['unknown']]) {
            for (const skip of [0, 1, 3, 20]) {
                it(`${order} types=${types.join(',')} offset=${skip}: exact ordered IDs match the existing join`, () => {
                    const opts = { ...params, order }
                    const newIds = run(`USE analytics_fixture; ${bind(buildAnalyticsIdPage(opts, types, skip, 2))};`)
                    const oldIds = run(`USE analytics_fixture;
                        SELECT n.id FROM NewsletterNotifications n
                        JOIN NewsletterMessages m ON m.messageId=n.messageId
                        JOIN NewsletterBatch b ON b.id=m.newsletterBatchId
                        WHERE n.type IN (${types.map(type => escape(type)).join(',')})
                          AND b.siteId='tenant-a' AND n.created>'1970-01-01 00:00:10' AND n.created<'1970-01-01 00:00:20'
                        ORDER BY n.id ${order.toUpperCase()} LIMIT 2 OFFSET ${skip};`)
                    expect(newIds).toEqual(oldIds)
                    expect(newIds).not.toContain('02') // other tenant
                    expect(newIds).not.toContain('05') // exclusive lower bound
                    expect(newIds).not.toContain('06') // exclusive upper bound
                })
            }
        }
    }
    it('single-type scan uses the migrated index without branch filesort', () => {
        const plan = run(`USE analytics_fixture; EXPLAIN ${bind(buildAnalyticsIdPage(params, ['opened'], 0, 2))};`)
        const notificationStep = plan.find(row => row.split('\t')[2] === 'n')
        expect(notificationStep).toContain('idx_notifications_type_id_created')
        expect(notificationStep).not.toContain('Using filesort')
    })
})
