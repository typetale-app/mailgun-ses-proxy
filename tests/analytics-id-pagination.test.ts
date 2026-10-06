import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { findMany, queryRaw } = vi.hoisted(() => ({ findMany: vi.fn(), queryRaw: vi.fn() }))
vi.mock('@/service/database/db', () => ({ prisma: { $queryRaw: queryRaw, newsletterNotifications: { findMany } } }))
import { getEmailEvents, validateQueryParams } from '@/service/events-service/events-utils'
import { buildAnalyticsIdPage } from '@/service/events-service/events-id-query'

const params = {
    siteId: 'site-a', type: 'delivered OR opened', begin: 10, end: 20,
    order: 'asc' as const, start: 2, limit: 2,
    url: 'https://proxy.test/v3/site-a/events?event=delivered%20OR%20opened&begin=10&end=20&start=2&tag=test',
}
const event = (id: string) => ({
    id, type: 'delivered', messageId: `message-${id}`, created: new Date(15000), timestamp: new Date(12000),
    rawEvent: '{"eventType":"Delivery"}',
    newsletter: { toEmail: 'synthetic@example.test', newsletterBatch: { batchId: 'fixture-campaign' } },
})

describe('opt-in ID-first analytics pagination', () => {
    beforeEach(() => { findMany.mockReset(); queryRaw.mockReset(); vi.stubEnv('ANALYTICS_INDEX_FIRST', 'true') })
    afterEach(() => vi.unstubAllEnvs())

    it('preserves upstream offset next URL, raw payload formatting and SQL-selected ID order', async () => {
        queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
        findMany.mockResolvedValue([event('b'), event('a')])
        const result = await getEmailEvents(params)
        expect(result.items.map(row => row.id)).toEqual(['a-message-a', 'b-message-b'])
        expect(result.items[0]).toMatchObject({ event: 'delivered', timestamp: 12, recipient: 'synthetic@example.test', message: { headers: { 'message-id': 'fixture-campaign' } } })
        const next = new URL(result.paging.next)
        expect(next.searchParams.get('start')).toBe('4')
        expect(next.searchParams.get('tag')).toBe('test')
        expect(next.searchParams.has('cursor')).toBe(false)
        const hydration = findMany.mock.calls[0][0]
        expect(hydration.where).toEqual({ id: { in: ['a', 'b'] }, type: { in: ['delivered', 'opened'] }, newsletter: { newsletterBatch: { siteId: 'site-a' } }, created: { gt: new Date(10000), lt: new Date(20000) } })
    })
    it('keeps the existing query path as default and rollback', async () => {
        vi.stubEnv('ANALYTICS_INDEX_FIRST', '')
        findMany.mockResolvedValue([event('a')])
        await getEmailEvents(params)
        expect(queryRaw).not.toHaveBeenCalled()
        expect(findMany.mock.calls[0][0]).toMatchObject({ skip: 2, take: 2, orderBy: { id: 'asc' } })
    })
    it('does not hydrate empty pages and still advances legacy offset', async () => {
        queryRaw.mockResolvedValue([])
        const result = await getEmailEvents(params)
        expect(result.items).toEqual([])
        expect(findMany).not.toHaveBeenCalled()
        expect(new URL(result.paging.next).searchParams.get('start')).toBe('4')
    })
    it('fails rather than silently skipping changed or deleted events', async () => {
        queryRaw.mockResolvedValue([{ id: 'missing' }]); findMany.mockResolvedValue([])
        await expect(getEmailEvents(params)).rejects.toThrow('retry the request')
    })
    it('does not swallow database errors or fall back to expensive reads', async () => {
        queryRaw.mockRejectedValue(new Error('query interrupted'))
        await expect(getEmailEvents(params)).rejects.toThrow('query interrupted')
        expect(findMany).not.toHaveBeenCalled()
    })
    it('preserves failed/bounce Mailgun fields', async () => {
        queryRaw.mockResolvedValue([{ id: 'a' }])
        findMany.mockResolvedValue([{ ...event('a'), type: 'failed', rawEvent: '{"eventType":"Bounce"}' }])
        expect((await getEmailEvents({ ...params, type: 'failed' })).items[0]).toMatchObject({ severity: 'permanent', reason: 'suppress-bounce' })
    })
    it('does not change the upstream numeric parsing/order contract', () => {
        expect(validateQueryParams(new URLSearchParams('event=opened&begin=10&end=20&ascending=yes&start=2'))).toEqual({ event: 'opened', begin: 10, end: 20, order: 'asc', start: 2, limit: 300 })
    })
})

describe('parameterized bounded ID queries', () => {
    it.each(['asc', 'desc'] as const)('retains %s UUID ordering rather than created ordering', order => {
        const query = buildAnalyticsIdPage({ ...params, order }, ['delivered', 'opened'], 2, 2)
        expect(query.sql).toContain(`ORDER BY page.id ${order.toUpperCase()}`)
        expect(query.sql).not.toContain('ORDER BY n.created')
        expect(query.sql).toContain('FORCE INDEX (idx_notifications_type_id_created)')
        expect(query.sql).toContain('UNION')
        expect(query.values).toEqual(['delivered', 'site-a', new Date(10000), new Date(20000), 4, 'opened', 'site-a', new Date(10000), new Date(20000), 4, 2, 2])
    })
    it('deduplicates requested types without duplicating events', () => {
        const query = buildAnalyticsIdPage(params, ['opened', 'opened'], 0, 2)
        expect(query.sql).not.toContain('UNION')
        expect(query.values.filter(value => value === 'opened')).toHaveLength(1)
    })
    it('binds hostile site/type values instead of generating SQL literals', () => {
        const query = buildAnalyticsIdPage({ ...params, siteId: "site' OR 1=1" }, ["opened'); DROP TABLE x; --"], 0, 2)
        expect(query.sql).not.toContain('DROP TABLE')
        expect(query.sql).not.toContain('1=1')
        expect(query.values).toContain("site' OR 1=1")
        expect(query.values).toContain("opened'); DROP TABLE x; --")
    })
    it.each([[-1, 2], [0, -1], [1.5, 2], [0, NaN], [Number.MAX_SAFE_INTEGER, 2]])('rejects unsafe LIMIT/OFFSET (%s,%s)', (skip, take) => {
        expect(() => buildAnalyticsIdPage(params, ['opened'], skip, take)).toThrow('Invalid analytics pagination')
    })
})
