import { formDataToObject } from '@/lib/utils/common'
import { describe, it, expect } from 'vitest'

describe('formDataToObject', () => {
  describe('basic functionality', () => {
    it('should convert simple form data to object', () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'John Doe')
      formData.append('email', 'john@example.com')
      formData.append('age', '30')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: '30',
      })
    })

    it('should handle empty form data', () => {
      // Arrange
      const formData = new FormData()

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({})
    })

    it('should handle multiple values for same key', () => {
      // Arrange
      const formData = new FormData()
      formData.append('tags', 'javascript')
      formData.append('tags', 'typescript')
      formData.append('tags', 'node')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        tags: ['javascript', 'typescript', 'node'],
      })
    })

    it('should handle mixed single and multiple values', () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'John')
      formData.append('hobbies', 'reading')
      formData.append('hobbies', 'coding')
      formData.append('email', 'john@example.com')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        name: 'John',
        hobbies: ['reading', 'coding'],
        email: 'john@example.com',
      })
    })
  })

  describe('file handling', () => {
    it('should exclude files by default', () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'John')
      formData.append('avatar', new File(['content'], 'avatar.jpg', { type: 'image/jpeg' }))
      formData.append('email', 'john@example.com')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        name: 'John',
        email: 'john@example.com',
      })
      expect(result).not.toHaveProperty('avatar')
    })

    it('should exclude files when explicitly set', () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'John')
      formData.append('document', new File(['content'], 'doc.pdf', { type: 'application/pdf' }))

      // Act
      const result = formDataToObject(formData, { fileHandling: 'exclude' })

      // Assert
      expect(result).toEqual({
        name: 'John',
      })
    })

    it('should include filenames when specified', () => {
      // Arrange
      const formData = new FormData()
      formData.append('name', 'John')
      formData.append('avatar', new File(['content'], 'avatar.jpg', { type: 'image/jpeg' }))
      formData.append('document', new File(['content'], 'document.pdf', { type: 'application/pdf' }))

      // Act
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })

      // Assert
      expect(result).toEqual({
        name: 'John',
        avatar: 'avatar.jpg',
        document: 'document.pdf',
      })
    })

    it('should handle multiple files with same key', () => {
      // Arrange
      const formData = new FormData()
      formData.append('files', new File(['content1'], 'file1.txt', { type: 'text/plain' }))
      formData.append('files', new File(['content2'], 'file2.txt', { type: 'text/plain' }))

      // Act
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })

      // Assert
      expect(result).toEqual({
        files: ['file1.txt', 'file2.txt'],
      })
    })

    it('should handle mixed files and strings with same key', () => {
      // Arrange
      const formData = new FormData()
      formData.append('items', 'text-item')
      formData.append('items', new File(['content'], 'file-item.txt', { type: 'text/plain' }))

      // Act
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })

      // Assert
      expect(result).toEqual({
        items: ['text-item', 'file-item.txt'],
      })
    })

    it('should handle empty filename', () => {
      // Arrange
      const formData = new FormData()
      formData.append('file', new File(['content'], '', { type: 'text/plain' }))

      // Act
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })

      // Assert
      expect(result).toEqual({
        file: '',
      })
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in keys', () => {
      // Arrange
      const formData = new FormData()
      formData.append('user-name', 'John')
      formData.append('user_email', 'john@example.com')
      formData.append('user.age', '30')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        'user-name': 'John',
        'user_email': 'john@example.com',
        'user.age': '30',
      })
    })

    it('should handle special characters in values', () => {
      // Arrange
      const formData = new FormData()
      formData.append('message', 'Hello, "World"! & <test>')
      formData.append('unicode', '🚀 Unicode test ñáéíóú')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        message: 'Hello, "World"! & <test>',
        unicode: '🚀 Unicode test ñáéíóú',
      })
    })

    it('should handle empty string values', () => {
      // Arrange
      const formData = new FormData()
      formData.append('empty', '')
      formData.append('name', 'John')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        empty: '',
        name: 'John',
      })
    })

    it('should handle whitespace-only values', () => {
      // Arrange
      const formData = new FormData()
      formData.append('spaces', '   ')
      formData.append('tabs', '\t\t')
      formData.append('newlines', '\n\n')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        spaces: '   ',
        tabs: '\t\t',
        newlines: '\n\n',
      })
    })

    it('should handle numeric-like string values', () => {
      // Arrange
      const formData = new FormData()
      formData.append('age', '30')
      formData.append('price', '19.99')
      formData.append('count', '0')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        age: '30',
        price: '19.99',
        count: '0',
      })
      // Values should remain as strings
      expect(typeof result.age).toBe('string')
      expect(typeof result.price).toBe('string')
      expect(typeof result.count).toBe('string')
    })
  })

  describe('mailgun-specific use cases', () => {
    it('should handle typical mailgun form data', () => {
      // Arrange
      const formData = new FormData()
      formData.append('from', 'sender@example.com')
      formData.append('to', 'recipient@example.com')
      formData.append('subject', 'Test Email')
      formData.append('html', '<p>HTML content</p>')
      formData.append('text', 'Text content')
      formData.append('v:email-id', 'batch-123')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>HTML content</p>',
        text: 'Text content',
        'v:email-id': 'batch-123',
      })
    })

    it('should handle multiple recipients', () => {
      // Arrange
      const formData = new FormData()
      formData.append('from', 'sender@example.com')
      formData.append('to', 'recipient1@example.com')
      formData.append('to', 'recipient2@example.com')
      formData.append('to', 'recipient3@example.com')
      formData.append('subject', 'Test Email')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        from: 'sender@example.com',
        to: ['recipient1@example.com', 'recipient2@example.com', 'recipient3@example.com'],
        subject: 'Test Email',
      })
    })

    it('should handle mailgun headers and variables', () => {
      // Arrange
      const formData = new FormData()
      formData.append('from', 'sender@example.com')
      formData.append('to', 'recipient@example.com')
      formData.append('h:Reply-To', 'reply@example.com')
      formData.append('v:custom-var', 'custom-value')
      formData.append('recipient-variables', '{"recipient@example.com": {"name": "John"}}')

      // Act
      const result = formDataToObject(formData)

      // Assert
      expect(result).toEqual({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        'h:Reply-To': 'reply@example.com',
        'v:custom-var': 'custom-value',
        'recipient-variables': '{"recipient@example.com": {"name": "John"}}',
      })
    })
  })
})