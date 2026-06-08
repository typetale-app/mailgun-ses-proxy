import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseNotificationEvent } from '@/lib/core/aws-utils'

function buildRawEvent(
    eventType: string,
    options: {
        messageId?: string
        timestamp?: string
        isNewsletter?: boolean
        isTransactional?: boolean
    } = {}
) {
    return JSON.stringify({
        eventType,
        mail: {
            messageId: options.messageId || 'test-message-id',
            timestamp: options.timestamp,
            tags: {
                batchId: options.isNewsletter ? ['batch-1'] : [],
                'ghost-email': options.isNewsletter ? ['true'] : [],
                'transactional-email': options.isTransactional ? ['true'] : [],
            }
        }
    })
}

function buildSnsWrappedEvent(eventType: string) {
    return JSON.stringify({
        Type: 'Notification',
        Message: buildRawEvent(eventType)
    })
}

describe('parseNotificationEvent', () => {
    it('maps Delivery to lowercase "delivered"', () => {
        const raw = buildRawEvent('Delivery', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('delivered')
        expect(result.messageId).toBe('test-message-id')
        expect(result.isNewsletterEmailEvent).toBe(true)
        expect(result.isTransactionalEmailEvent).toBe(false)
    })

    it('maps Send to lowercase "accepted"', () => {
        const raw = buildRawEvent('Send', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('accepted')
    })

    it('maps Bounce to lowercase "failed"', () => {
        const raw = buildRawEvent('Bounce', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('failed')
    })

    it('maps Complaint to lowercase "complained"', () => {
        const raw = buildRawEvent('Complaint', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('complained')
    })

    it('maps Click to lowercase "clicked"', () => {
        const raw = buildRawEvent('Click', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('clicked')
    })

    it('maps Open to lowercase "opened"', () => {
        const raw = buildRawEvent('Open', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('opened')
    })

    it('maps Reject to lowercase "rejected"', () => {
        const raw = buildRawEvent('Reject', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('rejected')
    })

    it('maps RenderingFailure to lowercase "rejected"', () => {
        const raw = buildRawEvent('RenderingFailure', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('rejected')
    })

    it('maps Subscription to lowercase "unsubscribed"', () => {
        const raw = buildRawEvent('Subscription', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('unsubscribed')
    })

    it('maps unknown event types to lowercase "unknown"', () => {
        const raw = buildRawEvent('UnknownEventType' as string, { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.type).toBe('unknown')
    })

    it('handles SNS wrapped notifications', () => {
        const snsEvent = buildSnsWrappedEvent('Delivery')
        const result = parseNotificationEvent('sns-456', snsEvent)

        expect(result.type).toBe('delivered')
        expect(result.notificationId).toBe('sns-456')
        expect(result.messageId).toBe('test-message-id')
    })

    it('flags transactional email events correctly', () => {
        const raw = buildRawEvent('Delivery', { isTransactional: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.isTransactionalEmailEvent).toBe(true)
        expect(result.isNewsletterEmailEvent).toBe(false)
        expect(result.type).toBe('delivered')
    })

    it('uses SNS message ID as notificationId', () => {
        const raw = buildRawEvent('Delivery', { isNewsletter: true })
        const result = parseNotificationEvent('unique-sns-id', raw)

        expect(result.notificationId).toBe('unique-sns-id')
    })

    it('stores raw event string', () => {
        const raw = buildRawEvent('Delivery', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.raw).toBe(raw)
    })

    it('uses fallback timestamp when none provided', () => {
        const raw = buildRawEvent('Delivery', { isNewsletter: true })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('parses provided timestamp correctly', () => {
        const ts = '2024-01-15T10:30:00.000Z'
        const raw = buildRawEvent('Delivery', { isNewsletter: true, timestamp: ts })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.timestamp).toEqual(new Date(ts))
    })

    it('uses fallback timestamp for invalid date strings', () => {
        const raw = buildRawEvent('Delivery', { isNewsletter: true, timestamp: 'not-a-date' })
        const result = parseNotificationEvent('sns-123', raw)

        expect(result.timestamp).toBeInstanceOf(Date)
        expect(result.timestamp.getTime()).not.toBeNaN()
    })
})
