# LDERLY Startup Architecture

This plan keeps the current Next.js, Vercel, and Firebase architecture intact while preparing LDERLY for low-cost growth and AWS Activate scaling.

## Current Low-Cost Stack

- Next.js on Vercel for customer, partner, and ops apps.
- Firebase Realtime Database for live care state.
- Firebase Admin SDK for trusted server writes.
- Firebase Cloud Messaging-ready push token and dispatch records.
- Razorpay-ready payment flow.
- Source-owned shadcn-style primitives for consistent UI.
- TanStack Query provider for cache, refresh, and optimistic UI foundations.
- PostHog and Microsoft Clarity adapters that activate only when keys are configured.
- Deterministic free AI placeholder APIs for care reassurance and report summaries.

## AWS Activate Future Path

- S3 for voice notes, reports, prescriptions, and KYC files.
- CloudFront for low-latency report and media delivery.
- Lambda + API Gateway for async care workflows and webhook handlers.
- SQS for dispatch, escalation, notification, and report-generation queues.
- SNS for emergency fan-out and ops alerts.
- DynamoDB for high-volume event timelines and caregiver location snapshots.
- RDS or Aurora Serverless for finance reconciliation and partner marketplace records.
- CloudWatch for logs, metrics, alarms, and SLA dashboards.
- Bedrock for future AI summaries, anomaly detection, and family reassurance generation.

## Scaling Principle

Keep Firebase as the realtime care-state layer while gradually moving heavy asynchronous workflows into event-driven queues. This lets the product stay fast for families and operationally reliable for ops without increasing early-stage infrastructure cost.
