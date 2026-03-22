import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/v3/[siteId]/messages/route'
import { addNewsletterToQueue } from '@/service/newsletter-service'

// Mock the service
vi.mocked(addNewsletterToQueue).mockImplementation(vi.fn())

describe('/v3/[siteId]/messages POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully queue a newsletter message', async () => {
    // Arrange
    const mockFormData = new FormData()
    mockFormData.append('from', 'sender@example.com')
    mockFormData.append('to', 'recipient@example.com')
    mockFormData.append('subject', 'Test Subject')
    mockFormData.append('html', '<p>Test HTML</p>')
    mockFormData.append('text', 'Test text')
    mockFormData.append('v:email-id', 'batch-123')

    const mockRequest = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as unknown as Request

    const mockParams = Promise.resolve({ siteId: 'site-123' })

    vi.mocked(addNewsletterToQueue).mockResolvedValue({
      messageId: 'msg-123',
      batchId: 'batch-123',
    })

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(result.id).toEqual('batch-123')
    expect(addNewsletterToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text',
        'v:email-id': 'batch-123',
      }),
      'site-123'
    )
  })

  it('should handle missing email-id by setting default', async () => {
    // Arrange
    const mockFormData = new FormData()
    mockFormData.append('from', 'sender@example.com')
    mockFormData.append('to', 'recipient@example.com')
    mockFormData.append('subject', 'Test Subject')
    mockFormData.append('html', '<p>Test HTML</p>')

    const mockRequest = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as unknown as Request

    const mockParams = Promise.resolve({ siteId: 'site-123' })

    vi.mocked(addNewsletterToQueue).mockResolvedValue({
      messageId: 'msg-123',
      batchId: 'no-batch-id-provided',
    })

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(result.id).toEqual('no-batch-id-provided')
    expect(addNewsletterToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        'v:email-id': 'no-batch-id-provided',
      }),
      'site-123'
    )
  })

  it('should return 400 when siteId is missing', async () => {
    // Arrange
    const mockRequest = {} as Request
    const mockParams = Promise.resolve({ siteId: '' })

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(result.message).toEqual('siteId is required')
  })

  it('should handle service errors gracefully', async () => {
    // Arrange
    const mockFormData = new FormData()
    mockFormData.append('from', 'sender@example.com')

    const mockRequest = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as unknown as Request

    const mockParams = Promise.resolve({ siteId: 'site-123' })

    const serviceError = new Error('Service unavailable')
    vi.mocked(addNewsletterToQueue).mockRejectedValue(serviceError)

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(result.message).toEqual('Service unavailable')
  })

  it('should handle non-Error exceptions', async () => {
    // Arrange
    const mockFormData = new FormData()
    mockFormData.append('from', 'sender@example.com')

    const mockRequest = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as unknown as Request

    const mockParams = Promise.resolve({ siteId: 'site-123' })

    vi.mocked(addNewsletterToQueue).mockRejectedValue('String error')

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(result.message).toEqual('an error occurred')
  })

  it('should handle form data parsing errors', async () => {
    // Arrange
    const mockRequest = {
      formData: vi.fn().mockRejectedValue(new Error('Invalid form data')),
    } as unknown as Request

    const mockParams = Promise.resolve({ siteId: 'site-123' })

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(result.message).toEqual('Invalid form data')
  })

  it('should handle complex form data with multiple recipients', async () => {
    // Arrange
    const mockFormData = new FormData()
    mockFormData.append('from', 'sender@example.com')
    mockFormData.append('to', 'recipient1@example.com')
    mockFormData.append('to', 'recipient2@example.com')
    mockFormData.append('subject', 'Test Subject')
    mockFormData.append('html', '<p>Test HTML</p>')
    mockFormData.append('v:email-id', 'batch-456')

    const mockRequest = {
      formData: vi.fn().mockResolvedValue(mockFormData),
    } as unknown as Request

    const mockParams = Promise.resolve({ siteId: 'site-123' })

    vi.mocked(addNewsletterToQueue).mockResolvedValue({
      messageId: 'msg-456',
      batchId: 'batch-456',
    })

    // Act
    const response = await POST(mockRequest, { params: mockParams })
    const result = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(result.id).toEqual('batch-456')
    expect(addNewsletterToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['recipient1@example.com', 'recipient2@example.com'],
        'v:email-id': 'batch-456',
      }),
      'site-123'
    )
  })
})