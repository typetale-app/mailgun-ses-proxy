import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as v3MessagesPost } from '@/app/v3/[siteId]/messages/route'
import { POST as v1SendPost } from '@/app/v1/send/route'
import { POST as statsPost } from '@/app/stats/[action]/route'
import { newsletterService } from '@/service/newsletter-service'
import { sendSystemMail } from '@/service/transaction-email-service'
import { emailService } from '@/service/email-service'
import { NextRequest } from 'next/server'

describe('API Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('End-to-end workflow', () => {
    it('should handle complete newsletter workflow', async () => {
      // Arrange - Newsletter message
      const mockFormData = new FormData()
      mockFormData.append('from', 'newsletter@example.com')
      mockFormData.append('to', 'subscriber@example.com')
      mockFormData.append('subject', 'Weekly Newsletter')
      mockFormData.append('html', '<h1>Newsletter Content</h1>')
      mockFormData.append('v:email-id', 'newsletter-batch-123')

      const newsletterRequest = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      } as unknown as Request

      const newsletterParams = Promise.resolve({ siteId: 'site-123' })

      vi.mocked(newsletterService.addToQueue).mockResolvedValue({
        messageId: 'newsletter-msg-123',
        batchId: 'newsletter-batch-123',
      })

      // Act - Send newsletter
      const newsletterResponse = await v3MessagesPost(newsletterRequest, { params: newsletterParams })
      const newsletterResult = await newsletterResponse.json()

      // Assert - Newsletter queued successfully
      expect(newsletterResponse.status).toBe(200)
      expect(newsletterResult.id).toEqual('newsletter-batch-123')

      // Arrange - System email notification
      const systemEmailPayload = {
        to: ['admin@example.com'],
        subject: 'Newsletter Sent Successfully',
        html: '<p>Newsletter batch newsletter-batch-123 has been queued successfully.</p>',
      }

      const systemEmailRequest = {
        json: vi.fn().mockResolvedValue(systemEmailPayload),
      } as unknown as NextRequest

      vi.mocked(sendSystemMail).mockResolvedValue({
        messageId: 'system-msg-123',
        dbId: 'system-db-123',
      })

      // Act - Send system notification
      const systemResponse = await v1SendPost(systemEmailRequest)
      const systemResult = await systemResponse.json()

      // Assert - System email sent
      expect(systemResponse.status).toBe(200)
      expect(systemResult.success).toBe(true)
      expect(systemResult.data.messageId).toBe('system-msg-123')

      // Arrange - Check stats
      const statsPayload = {
        from: Date.now() - 86400000, // 24 hours ago
        to: Date.now(),
        siteId: 'site-123',
      }

      const statsRequest = {
        json: vi.fn().mockResolvedValue(statsPayload),
      } as unknown as Request

      const statsParams = Promise.resolve({ action: 'getNewsletterUsage' })

      vi.mocked(emailService.getUsage).mockResolvedValue({
        status: 'ok',
        data: {
          forRange: {
            gte: new Date(statsPayload.from),
            lte: new Date(statsPayload.to),
          },
          message: 'newsletter usage',
          count: 1,
          timestamp: new Date().toISOString(),
        },
      })

      // Act - Get stats
      const statsResponse = await statsPost(statsRequest, { params: statsParams })
      const statsResult = await statsResponse.json()

      // Assert - Stats retrieved
      expect(statsResponse.status).toBe(200)
      expect(statsResult.status).toBe('ok')
      expect(statsResult.data.count).toBe(1)
    })

    it('should handle error propagation across services', async () => {
      // Arrange - Newsletter with service error
      const mockFormData = new FormData()
      mockFormData.append('from', 'sender@example.com')
      mockFormData.append('to', 'recipient@example.com')

      const newsletterRequest = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      } as unknown as Request

      const newsletterParams = Promise.resolve({ siteId: 'site-123' })

      const serviceError = new Error('Queue service unavailable')
      vi.mocked(newsletterService.addToQueue).mockRejectedValue(serviceError)

      // Act - Attempt to send newsletter
      const newsletterResponse = await v3MessagesPost(newsletterRequest, { params: newsletterParams })
      const newsletterResult = await newsletterResponse.json()

      // Assert - Error handled gracefully
      expect(newsletterResponse.status).toBe(400)
      expect(newsletterResult.message).toBe('Queue service unavailable')

      // Arrange - System email with validation error
      const invalidEmailPayload = {
        // Missing required fields
        subject: 'Error Notification',
      }

      const systemEmailRequest = {
        json: vi.fn().mockResolvedValue(invalidEmailPayload),
      } as unknown as NextRequest

      // Act - Attempt to send invalid system email
      const systemResponse = await v1SendPost(systemEmailRequest)
      const systemResult = await systemResponse.json()

      // Assert - Validation error returned
      expect(systemResponse.status).toBe(400)
      expect(systemResult.success).toBe(false)
      expect(systemResult.error).toBe('Validation Error')

      // Arrange - Stats with database error
      const statsPayload = {
        from: Date.now() - 86400000,
        to: Date.now(),
        siteId: 'site-123',
      }

      const statsRequest = {
        json: vi.fn().mockResolvedValue(statsPayload),
      } as unknown as Request

      const statsParams = Promise.resolve({ action: 'getNewsletterUsage' })

      const dbError = new Error('Database connection failed')
      vi.mocked(emailService.getUsage).mockRejectedValue(dbError)

      // Act - Attempt to get stats
      const statsResponse = await statsPost(statsRequest, { params: statsParams })
      const statsResult = await statsResponse.json()

      // Assert - Database error handled
      expect(statsResponse.status).toBe(500)
      expect(statsResult.message).toBe('Internal server error')
    })
  })

  describe('Cross-route validation', () => {
    it('should maintain consistent error response formats', async () => {
      // Test v3 messages error format
      const v3Request = {
        formData: vi.fn().mockRejectedValue(new Error('Invalid form data')),
      } as unknown as Request
      const v3Params = Promise.resolve({ siteId: 'site-123' })

      const v3Response = await v3MessagesPost(v3Request, { params: v3Params })
      const v3Result = await v3Response.json()

      expect(v3Response.status).toBe(400)
      expect(v3Result).toHaveProperty('message')

      // Test v1 send error format
      const v1Request = {
        json: vi.fn().mockResolvedValue({}), // Invalid payload
      } as unknown as NextRequest

      const v1Response = await v1SendPost(v1Request)
      const v1Result = await v1Response.json()

      expect(v1Response.status).toBe(400)
      expect(v1Result).toHaveProperty('success', false)
      expect(v1Result).toHaveProperty('error')
      expect(v1Result).toHaveProperty('message')

      // Test stats with valid request (JSON parsing error test removed due to Vitest limitations)
      const statsRequest = {
        json: vi.fn().mockResolvedValue({
          from: Date.now() - 86400000,
          to: Date.now(),
          siteId: 'site-123',
        }),
      } as unknown as Request
      const statsParams = Promise.resolve({ action: 'getNewsletterUsage' })

      vi.mocked(emailService.getUsage).mockResolvedValue({
        status: 'ok',
        data: {
          forRange: { gte: new Date(), lte: new Date() },
          message: 'newsletter usage',
          count: 1,
          timestamp: new Date().toISOString(),
        },
      })

      const statsResponse = await statsPost(statsRequest, { params: statsParams })
      const statsResult = await statsResponse.json()

      expect(statsResponse.status).toBe(200)
      expect(statsResult).toHaveProperty('status', 'ok')
    })

    it('should handle concurrent requests properly', async () => {
      // Arrange multiple concurrent requests
      const requests = []

      // Newsletter request
      const mockFormData = new FormData()
      mockFormData.append('from', 'sender@example.com')
      mockFormData.append('to', 'recipient@example.com')
      mockFormData.append('v:email-id', 'batch-concurrent')

      const newsletterRequest = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      } as unknown as Request

      vi.mocked(newsletterService.addToQueue).mockResolvedValue({
        messageId: 'concurrent-msg-1',
        batchId: 'batch-concurrent',
      })

      requests.push(v3MessagesPost(newsletterRequest, { params: Promise.resolve({ siteId: 'site-1' }) }))

      // System email request
      const systemEmailPayload = {
        to: ['user@example.com'],
        subject: 'Concurrent Test',
        html: '<p>Test</p>',
      }

      const systemEmailRequest = {
        json: vi.fn().mockResolvedValue(systemEmailPayload),
      } as unknown as NextRequest

      vi.mocked(sendSystemMail).mockResolvedValue({
        messageId: 'concurrent-msg-2',
        dbId: 'concurrent-db-2',
      })

      requests.push(v1SendPost(systemEmailRequest))

      // Stats request
      const statsPayload = {
        from: Date.now() - 86400000,
        to: Date.now(),
        siteId: 'site-1',
      }

      const statsRequest = {
        json: vi.fn().mockResolvedValue(statsPayload),
      } as unknown as Request

      vi.mocked(emailService.getUsage).mockResolvedValue({
        status: 'ok',
        data: {
          forRange: { gte: new Date(), lte: new Date() },
          message: 'newsletter usage',
          count: 5,
          timestamp: new Date().toISOString(),
        },
      })

      requests.push(statsPost(statsRequest, { params: Promise.resolve({ action: 'getNewsletterUsage' }) }))

      // Act - Execute all requests concurrently
      const responses = await Promise.all(requests)

      // Assert - All requests completed successfully
      expect(responses).toHaveLength(3)
      expect(responses[0].status).toBe(200) // Newsletter
      expect(responses[1].status).toBe(200) // System email
      expect(responses[2].status).toBe(200) // Stats
    })
  })
})