import { ApiResponse, ERROR_TYPES } from '@/lib/api-response'
import { ErrorHandler } from '@/service/error-handler/error-handler'
import { ValidationService } from '@/service/validation-service/validation'
import { describe, it, expect } from 'vitest'

describe('Core Library', () => {
  describe('ApiResponse', () => {
    describe('success', () => {
      it('should create successful response with data', async () => {
        // Arrange
        const data = { id: 123, name: 'Test' }

        // Act
        const response = ApiResponse.success(data)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(result).toEqual({
          success: true,
          data: { id: 123, name: 'Test' },
          message: 'Operation completed successfully',
          timestamp: expect.any(String),
        })
      })

      it('should create successful response with custom message', async () => {
        // Arrange
        const data = { id: 123 }
        const customMessage = 'Custom success message'

        // Act
        const response = ApiResponse.success(data, customMessage)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(result).toEqual({
          success: true,
          data: { id: 123 },
          message: customMessage,
          timestamp: expect.any(String),
        })
      })

      it('should handle null data', async () => {
        // Act
        const response = ApiResponse.success(null)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(result.data).toBeNull()
        expect(result.success).toBe(true)
      })
    })

    describe('validationError', () => {
      it('should create validation error response', async () => {
        // Arrange
        const errorMessage = 'Validation failed'

        // Act
        const response = ApiResponse.validationError(errorMessage)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(result).toEqual({
          success: false,
          error: 'Validation Error',
          message: errorMessage,
          timestamp: expect.any(String),
        })
      })
    })

    describe('error', () => {
      it('should create error response with default status', async () => {
        // Arrange
        const errorMessage = 'Something went wrong'

        // Act
        const response = ApiResponse.error(errorMessage)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(500)
        expect(result).toEqual({
          success: false,
          error: 'Internal Server Error',
          message: errorMessage,
          timestamp: expect.any(String),
        })
      })

      it('should create error response with custom status', async () => {
        // Arrange
        const errorMessage = 'Not found'
        const status = 404

        // Act
        const response = ApiResponse.error(errorMessage, ERROR_TYPES.NOT_FOUND_ERROR, status)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(404)
        expect(result).toEqual({
          success: false,
          error: 'Not Found',
          message: errorMessage,
          timestamp: expect.any(String),
        })
      })
    })
  })

  describe('ValidationService', () => {
    describe('validateEmailPayload', () => {
      it('should validate correct email payload', () => {
        // Arrange
        const validPayload = {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
          replyTo: 'reply@example.com',
        }

        // Act
        const result = ValidationService.validateEmailPayload(validPayload)

        // Assert
        expect(result.errors).toEqual([])
        expect(result.data).toEqual(validPayload)
      })

      it('should validate payload without replyTo', () => {
        // Arrange
        const validPayload = {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
        }

        // Act
        const result = ValidationService.validateEmailPayload(validPayload)

        // Assert
        expect(result.errors).toEqual([])
        expect(result.data).toEqual(validPayload)
      })

      it('should reject payload with missing from field', () => {
        // Arrange
        const invalidPayload = {
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
        }

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(1)
        expect(result.data).toBeUndefined()
      })

      it('should reject payload with missing to field', () => {
        // Arrange
        const invalidPayload = {
          from: 'sender@example.com',
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
        }

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain("'to': Invalid input: expected array, received undefined")
      })

      it('should reject payload with empty to array', () => {
        // Arrange
        const invalidPayload = {
          from: 'sender@example.com',
          to: [],
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
        }

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain("'to'")
      })

      it('should reject payload with non-array to field', () => {
        // Arrange
        const invalidPayload = {
          from: 'sender@example.com',
          to: 'recipient@example.com', // Should be array
          subject: 'Test Subject',
          html: '<p>Test HTML</p>',
        }

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain("'to'")
      })

      it('should reject payload with missing subject', () => {
        // Arrange
        const invalidPayload = {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          html: '<p>Test HTML</p>',
        }

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain("'subject'")
      })

      it('should reject payload with missing html', () => {
        // Arrange
        const invalidPayload = {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
        }

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toContain("'html'")
      })

      it('should collect multiple validation errors', () => {
        // Arrange
        const invalidPayload = {}

        // Act
        const result = ValidationService.validateEmailPayload(invalidPayload)

        // Assert
        expect(result.errors).toHaveLength(4)
        expect(result.errors.some(err => err.includes("'from'"))).toBe(true)
        expect(result.errors.some(err => err.includes("'to'"))).toBe(true)
        expect(result.errors.some(err => err.includes("'subject'"))).toBe(true)
        expect(result.errors.some(err => err.includes("'html'"))).toBe(true)
      })

      it('should handle null payload', () => {
        // Act
        const result = ValidationService.validateEmailPayload(null)

        // Assert
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should handle undefined payload', () => {
        // Act
        const result = ValidationService.validateEmailPayload(undefined)

        // Assert
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('ErrorHandler', () => {
    describe('handleApiError', () => {
      it('should handle Error instances', () => {
        // Arrange
        const error = new Error('Test error message')
        error.name = 'TestError'
        const context = 'test-context'

        // Act
        const result = ErrorHandler.handleApiError(error, context)

        // Assert
        expect(result).toEqual({
          error: 'TestError',
          message: 'Test error message',
          status: 500,
          context: 'test-context',
        })
      })

      it('should handle Error instances with default name', () => {
        // Arrange
        const error = new Error('Test error message')
        const context = 'test-context'

        // Act
        const result = ErrorHandler.handleApiError(error, context)

        // Assert
        expect(result).toEqual({
          error: 'Error',
          message: 'Test error message',
          status: 500,
          context: 'test-context',
        })
      })

      it('should handle non-Error exceptions', () => {
        // Arrange
        const error = 'String error'
        const context = 'test-context'

        // Act
        const result = ErrorHandler.handleApiError(error, context)

        // Assert
        expect(result).toEqual({
          error: 'Unknown Error',
          message: 'An unexpected error occurred',
          status: 500,
          context: 'test-context',
        })
      })

      it('should handle null errors', () => {
        // Arrange
        const error = null
        const context = 'test-context'

        // Act
        const result = ErrorHandler.handleApiError(error, context)

        // Assert
        expect(result).toEqual({
          error: 'Unknown Error',
          message: 'An unexpected error occurred',
          status: 500,
          context: 'test-context',
        })
      })

      it('should handle undefined errors', () => {
        // Arrange
        const error = undefined
        const context = 'test-context'

        // Act
        const result = ErrorHandler.handleApiError(error, context)

        // Assert
        expect(result).toEqual({
          error: 'Unknown Error',
          message: 'An unexpected error occurred',
          status: 500,
          context: 'test-context',
        })
      })

      it('should handle object errors', () => {
        // Arrange
        const error = { message: 'Object error', code: 'ERR001' }
        const context = 'test-context'

        // Act
        const result = ErrorHandler.handleApiError(error, context)

        // Assert
        expect(result).toEqual({
          error: 'Unknown Error',
          message: 'An unexpected error occurred',
          status: 500,
          context: 'test-context',
        })
      })
    })

    describe('createResponse', () => {
      it('should create error response from error object', async () => {
        // Arrange
        const errorResponse = {
          error: 'ValidationError',
          message: 'Invalid input',
          status: 400,
        }

        // Act
        const response = ErrorHandler.createResponse(errorResponse)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(result).toEqual({
          error: 'ValidationError',
          message: 'Invalid input',
        })
      })

      it('should handle different status codes', async () => {
        // Arrange
        const errorResponse = {
          error: 'NotFound',
          message: 'Resource not found',
          status: 404,
        }

        // Act
        const response = ErrorHandler.createResponse(errorResponse)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(404)
        expect(result).toEqual({
          error: 'NotFound',
          message: 'Resource not found',
        })
      })
    })
  })
})