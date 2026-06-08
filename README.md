# Ghost CMS ⇔ AWS SES Proxy (Mailgun Alternative)

[![Build Status](https://img.shields.io/badge/Build-OK-green)](#)
![Version](https://img.shields.io/github/package-json/v/typetale-app/mailgun-ses-proxy)
![License](https://img.shields.io/github/license/typetale-app/mailgun-ses-proxy)
[![Sponsor](https://img.shields.io/badge/Sponsor-typetale.app-purple)]([https://typetale.app?utm=mailgun-proxy](https://typetale.app?utm=mailgun-proxy))

**Save up to 90% on Ghost CMS email costs.** This API server acts as a high-performance proxy, allowing you to use **Amazon SES** for newsletters while mimicking the **Mailgun v3 API**.

## Why use this Proxy?

Ghost CMS natively requires Mailgun for bulk newsletters, which can become expensive as your subscriber base grows. This proxy allows you to:
* **Drop-in Replacement**: No changes to Ghost core; just update your config.
* **Massive Cost Savings**: Leverage Amazon SES pricing ($0.10 per 1,000 emails).
* **Production Ready**: Includes queueing (SQS), event tracking (delivery/bounce), and analytics.

---

## Key Features

* **Mailgun v3 Compatibility**: Fully mimics `/messages` endpoints used by Ghost.
* **Reliable Delivery**: Uses **AWS SQS** for robust queue management and retries.
* **Event Tracking**: Captures Bounces, Complaints, and Deliveries via SNS → SQS.
* **Analytics Logging**: Stores every batch and event in **MySQL** for auditing.
* **Docker Optimized**: Simple deployment with `docker-compose`.

---

## Architecture Overview

The system bridges the gap between Ghost's Mailgun requests and AWS's infrastructure:
1.  **Next.js API**: Receives emails from Ghost.
2.  **AWS SQS**: Buffers emails to prevent timeouts and handle rate limiting.
3.  **AWS SES**: Executes the final email delivery.
4.  **MySQL**: Logs metadata, message status, and health metrics.

---

## Prerequisites

* **Node.js** v18+ or **Docker**
* **AWS Account**: Access to SES (Production mode recommended) and SQS.
* **MySQL**: For logging and persistence.

---

## AWS Setup (Essential)

### 1. SES & SQS Configuration
You must create three SQS queues to handle the traffic flow:
* `newsletter-buffer-queue`: For incoming newsletters.
* `newsletter-events-queue`: For tracking SES notifications.
* `system-events-queue`: For transactional email tracking.

### 2. Connect SNS to SQS
To track bounces and complaints, point your SES SNS topics to the SQS queues created above.
> **Detailed Guide:** [How to orchestrate SES event pipelines](https://typetale.ontypetale.com/from-sent-to-sqs-orchestrating-ses-event-pipelines/)

### 3. IAM Permissions
Ensure your AWS user has the following policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail", "ses:SendRawEmail",
                "sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## Installation

### Option 1: Docker (Recommended)
```bash
docker run -it -p 3000:3000 --env-file .env mailgun-ses-proxy
```

### Option 2: Manual Setup
```bash
git clone https://github.com/tilak999/mailgun-ses-proxy
npm install
npm run db:generate
npm run db:migrate:dev
npm run build
npm start
```

---

## Configuration

### 1. Proxy Setup (`.env`)
Fill in your `AWS_ACCESS_KEY_ID`, `DATABASE_URL`, and queue URLs. (See `.env.dev` for full details).

### 2. Ghost CMS Integration
Update your Ghost `config.production.json` or Environment Variables:

```bash
# Mailgun API URL (Point to your proxy)
bulkEmail__mailgun__baseUrl="http://your-proxy-ip:3000/v3"
bulkEmail__mailgun__apiKey="your-secure-api-key"
bulkEmail__mailgun__domain="your-verified-ses-domain.com"

# General Email
mail__from="noreply@your-verified-ses-domain.com"
```

---

## Monitoring & API

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/v3/{siteId}/messages` | `POST` | The Mailgun-compatible mailer. |
| `/healthcheck` | `GET` | Returns system status. |
| `/stats/{action}` | `GET` | Retrieve delivery/bounce analytics. |

---

## Security & Performance
* **Rate Limits**: The proxy respects AWS SES sending quotas.
* **Persistence**: Setting `PERSIST_NEWSLETTER_FORMATTED_CONTENTS=true` allows full HTML auditing but increases DB usage.
* **Authentication**: Secure your proxy using the `API_KEY` defined in your `.env`.

---

## Contributing & License
Currently in production at [typetale.app](https://typetale.app).

**License**: AGPL-3

AGPL-3
