import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('SYSTEM_FROM_ADDRESS', 'system@example.com')
vi.stubEnv('TRANSACTIONAL_CONFIGURATION_SET_NAME', 'test-config-set')
vi.stubEnv('NEWSLETTER_CONFIGURATION_SET_NAME', 'newsletter-config-set')
vi.stubEnv('NODE_ENV', 'test')

// Mock AWS SDK
vi.mock('@aws-sdk/client-sesv2', () => ({
  SendEmailCommand: vi.fn(),
}))

vi.mock('@aws-sdk/client-sqs', () => ({
  SendMessageCommand: vi.fn(),
  DeleteMessageCommand: vi.fn(),
}))

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    systemMails: {
      create: vi.fn(),
    },
    newsletterMessages: {
      count: vi.fn(),
    },
    newsletterBatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    newsletterNotifications: {
      create: vi.fn(),
    },
    newsletterErrors: {
      create: vi.fn(),
    },
  },
  createNewsletterBatchEntry: vi.fn(),
  createNewsletterEntry: vi.fn(),
  createNewsletterErrorEntry: vi.fn(),
  getNewsletterContent: vi.fn(),
}))

// Mock AWS helpers
vi.mock('@/lib/awsHelper', () => ({
  sesSystemClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  sesNewsletterClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  sqsClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  QUEUE_URL: {
    NEWSLETTER: 'https://sqs.us-east-1.amazonaws.com/123456789/newsletter-queue',
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock services
vi.mock('@/service/newsletter-service', () => ({
  newsletterService: {
    addToQueue: vi.fn(),
    validateAndProcessBatch: vi.fn(),
  },
  // backward-compat shims for tests that destructure these
  addNewsletterToQueue: vi.fn(),
  validateAndSend: vi.fn(),
}))

vi.mock('@/service/transaction-email-service', () => ({
  sendSystemMail: vi.fn(),
}))

vi.mock('@/service/email-service', () => ({
  emailService: {
    handleNewsletterEvent: vi.fn(),
    parseEventQuery: vi.fn(),
    getEvents: vi.fn(),
    getUsage: vi.fn(),
  },
  // backward-compat shims
  getNewsletterUsage: vi.fn(),
}))