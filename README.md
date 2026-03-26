# Mailgun-to-SES Proxy

![build](https://img.shields.io/badge/Build-OK-green)
![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftilak999%2Fmailgun-ses-proxy%2Frefs%2Fheads%2Fmain%2Fpackage.json&query=%24.version&label=version)
![GitHub License](https://img.shields.io/github/license/tilak999/mailgun-ses-proxy)
[![typetale.app](https://img.shields.io/badge/Sponsor-typetale.app-purple)](https://typetale.app?utm=mailgun-proxy)
![visitor count](https://visitor-badge.laobi.icu/badge?page_id=tilak999.id)

> API server that acts as Mailgun server to proxy emails to SES

This API server acts as a proxy to enable sending newsletter emails from Ghost using Amazon SES (Simple Email Service) instead of Mailgun. It mimics the Mailgun API endpoints while routing the actual email-sending logic through SES on the backend.

## Purpose

Ghost natively integrates with Mailgun for sending newsletters. This proxy allows you to continue using Ghost's Mailgun integration while leveraging the cost-effectiveness and reliability of Amazon SES.

## Features

-   **Mailgun API Compatibility**: Mimics Mailgun's v3 API endpoints for seamless Ghost integration
-   **Amazon SES Backend**: Routes all email sending through AWS SES for better deliverability and cost-effectiveness
-   **Queue-based Processing**: Uses AWS SQS for reliable email queue management
-   **Event Tracking**: Comprehensive email event tracking (delivery, bounce, complaint, etc.)
-   **Database Logging**: Stores email batches, messages, and events in MySQL database
-   **Health Monitoring**: Built-in health check endpoints for monitoring
-   **Docker Support**: Containerized deployment with Docker Compose

## Architecture

The system consists of several components:

1. **Next.js API Server**: Handles incoming requests from Ghost
2. **AWS SES**: Sends the actual emails
3. **AWS SQS**: Manages email queues and event notifications
4. **MySQL Database**: Stores email batches, messages, and delivery events
5. **Background Processors**: Process email queues and handle SES events

## Prerequisites

Before setting up the server, ensure you have:

-   **Node.js** (v18 or higher)
-   **MySQL** database
-   **AWS Account** with SES and SQS access
-   **Docker** (optional, for containerized deployment)

## AWS Configuration

### 1. Amazon SES Setup

1. **Verify your sending domain** in AWS SES console
2. **Create Configuration Sets** for tracking:
    - `newsletter-configuration-set` (for newsletter emails)
    - `system-configuration-set` (for transactional emails)
3. **Set up SNS topics** for event notifications (optional but recommended)
4. **Request production access** if sending to unverified email addresses

### 2. AWS SQS Setup

Create the following SQS queues:

-   `newsletter-queue` - For processing newsletter emails
-   `newsletter-notification-queue` - For SES event notifications
-   `system-notification-queue` - For transactional email notifications

### 3. IAM Permissions

Your AWS credentials need the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail",
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes"
            ],
            "Resource": "*"
        }
    ]
}
```

## Environment Configuration

Create a `.env` file in the project root with the following variables:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/mailgun_ses_db"

# SES Configuration
SES_REGION="us-east-1"
SES_TRANSACTIONAL_REGION="us-east-1"
TRANSACTIONAL_CONFIGURATION_SET_NAME=system-configuration-set
NEWSLETTER_CONFIGURATION_SET_NAME=newsletter-configuration-set

# SQS Configuration
SQS_REGION="us-east-1"
NEWSLETTER_QUEUE="https://sqs.us-east-1.amazonaws.com/123456789012/newsletter-queue"
NEWSLETTER_NOTIFICATION_QUEUE="https://sqs.us-east-1.amazonaws.com/123456789012/newsletter-notification-queue"
TRANSACTIONAL_NOTIFICATION_QUEUE="https://sqs.us-east-1.amazonaws.com/123456789012/system-notification-queue"

# Email Configuration
SYSTEM_FROM_ADDRESS="Your App <noreply@yourdomain.com>"

# API Security
API_KEY="your-secure-api-key-here"

# Server Configuration (optional)
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Newsletter persistence behavior (optional)
PERSIST_NEWSLETTER_FORMATTED_CONTENTS=false
```

## Installation & Setup

### Option 1: Local Development

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd mailgun-to-ses-proxy
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Set up the database**

    ```bash
    # Generate Prisma client
    npm run db:generate

    # Run database migrations
    npm run db:migrate:dev
    ```

4. **Start the development server**
    ```bash
    npm run dev
    ```

### Option 2: Docker Deployment

1. **Using Docker Compose** (includes MySQL)

    ```bash
    docker-compose up -d
    ```

2. **Using standalone Docker**

    ```bash
    # Build the image
    docker build -t mailgun-ses-proxy .

    # Run the container
    docker run -p 3000:3000 --env-file .env mailgun-ses-proxy
    ```

### Option 3: Production Deployment

1. **Build the application**

    ```bash
    npm run build
    ```

2. **Start the production server**
    ```bash
    npm start
    ```

## Ghost Configuration

Configure Ghost to use the proxy by setting these environment variables in your Ghost installation:

```bash
# Mailgun Configuration (point to your proxy)
bulkEmail__mailgun__baseUrl=http://your-proxy-server:3000/v3
bulkEmail__mailgun__apiKey=your-secure-api-key-here
bulkEmail__mailgun__domain=your-verified-ses-domain.com

# Email Settings
hostSettings__managedEmail__sendingDomain=your-verified-ses-domain.com
mail__from=noreply@your-verified-ses-domain.com
```

## API Endpoints

### Newsletter Endpoints

-   `POST /v3/{siteId}/messages` - Send newsletter emails (Mailgun compatible)
-   `GET /healthcheck` - Health check endpoint
-   `GET /stats/{action}` - Email statistics and analytics

### Supported Mailgun Parameters

The proxy supports the following Mailgun parameters:

-   `from` - Sender email address
-   `to` - Recipient email address(es)
-   `subject` - Email subject
-   `html` - HTML email content
-   `text` - Plain text email content
-   `v:email-id` - Batch ID for tracking

## Monitoring & Logging

### Health Checks

Monitor your deployment using the health check endpoint:

```bash
curl http://your-server:3000/healthcheck
```

### Logs

The application uses structured logging with Pino. Logs include:

-   Email sending events
-   Queue processing status
-   Error tracking
-   Performance metrics

Available log levels can be configured with `LOG_LEVEL`:

-   `fatal`
-   `error`
-   `warn`
-   `info`
-   `debug`
-   `trace`
-   `silent`

### Database Monitoring

Monitor email delivery through the database tables:

-   `NewsletterBatch` - Email batch information
-   `NewsletterMessages` - Individual email messages
-   `NewsletterErrors` - Failed email attempts
-   `NewsletterNotifications` - SES delivery events

### Newsletter HTML Persistence

By default, newsletter messages store recipient substitution data in `recipientData` and rely on `NewsletterBatch.contents` as the source HTML/template.

If you need the legacy behavior that persists the fully rendered SES payload for each newsletter message and error row, enable:

```bash
PERSIST_NEWSLETTER_FORMATTED_CONTENTS=true
```

When enabled, the application stores the rendered `SendEmailRequest` JSON in `NewsletterMessages.formatedContents` and `NewsletterErrors.formatedContents`.

This legacy mode can consume a large amount of database storage on high-volume newsletter sends, because the full rendered HTML payload is duplicated for every recipient and every error row. Keep `PERSIST_NEWSLETTER_FORMATTED_CONTENTS=false` unless you explicitly need per-message payload persistence for auditing or debugging.

## Troubleshooting

### Common Issues

1. **SES Sandbox Mode**

    - Ensure you've requested production access in AWS SES
    - Verify all recipient domains in sandbox mode

2. **Queue Processing Issues**

    - Check SQS queue visibility timeout settings
    - Verify AWS credentials and permissions
    - Monitor dead letter queues for failed messages

3. **Database Connection**

    - Ensure MySQL is running and accessible
    - Verify DATABASE_URL format and credentials
    - Check if migrations have been applied

4. **Ghost Integration**
    - Verify the proxy URL is accessible from Ghost
    - Check API key matches between Ghost and proxy
    - Ensure the domain is verified in SES

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

### Testing Email Delivery

Test the proxy directly:

```bash
curl -X POST http://localhost:3000/v3/your-site-id/messages \
  -H "Authorization: Bearer your-api-key" \
  -F "from=test@yourdomain.com" \
  -F "to=recipient@example.com" \
  -F "subject=Test Email" \
  -F "html=<h1>Test Message</h1>"
```

## Performance Considerations

-   **Queue Processing**: The system processes emails asynchronously through SQS
-   **Rate Limits**: Respects AWS SES sending limits automatically
-   **Batch Processing**: Handles large newsletter batches efficiently
-   **Error Handling**: Implements retry logic for failed deliveries

## Security

-   Use strong API keys for authentication
-   Implement proper IAM roles with minimal required permissions
-   Keep AWS credentials secure and rotate regularly
-   Use HTTPS in production deployments
-   Regularly update dependencies for security patches

## Adopted by
The Mailgun-to-SES proxy is currently being used in production at [typetale.app](https://typetale.app) for sending both newsletter and transactional emails. It has proven to be a stable and scalable solution that meets all the service requirements.
 
## License
AGPL-3 
