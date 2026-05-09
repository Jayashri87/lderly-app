# LDERLY Master Product Vision

LDERLY is a premium elderly care operating system for India. It is not a generic healthcare app, a caretaker listing marketplace, or an admin dashboard with a nicer skin. The product exists to reduce family anxiety in real time.

Every screen should answer one question:

> Is my parent okay right now?

## Product Positioning

LDERLY combines:

- Apple Health style calm and accessibility
- Uber style live logistics and dispatch confidence
- Practo style healthcare coordination
- WhatsApp style family familiarity
- Google style clarity, speed, and predictive assistance

The experience should feel warm, intelligent, premium, reliable, and operationally alive.

## Primary Users

- NRI families monitoring parents remotely
- Working professionals coordinating care for parents
- Seniors who need support, companionship, health coordination, or urgent help

## Experience Principles

- Realtime first
- Trust first
- One primary action per screen
- Status before features
- Emotional reassurance before data density
- Invisible operational complexity
- Mobile-first, accessibility-first design
- Calm microcopy, no healthcare ERP language

## Customer Experience North Star

The Home screen is family mission control, not a feature catalog.

It should prioritize:

- Parent wellbeing now
- Caregiver live status
- Medicine and vitals state
- Upcoming visit
- Emergency shortcut after subscription
- AI insight
- Family notifications
- Live alerts

First-time users should see only the guided care funnel. Subscription customers should see the live status and reassurance system.

## Trust Layer

Trust is more important than features. The platform must keep improving:

- Verified caregiver badges
- Police verification indicators
- Caregiver check-in/check-out
- Photo and voice-note proof
- Caregiver repeat-visit memory
- Ratings, punctuality, and reliability signals
- Emergency escalation and audit logs
- Secure profile verification

## India-First Communications

Do not depend primarily on Twilio.

Preferred communication stack:

- WhatsApp Business for customer reassurance and family updates
- MSG91 for OTP/SMS fallback
- Exotel for emergency voice calling
- Firebase notifications for realtime app updates
- Slack only for internal ops alerts

Early stage WhatsApp can stay manual or semi-manual. Human trust matters more than premature automation.

## AI Layer

AI should feel invisible and supportive, not flashy.

AI-ready modules:

- Medicine adherence insight
- Loneliness and mood pattern detection
- Caregiver quality scoring
- Fall-risk and anomaly prediction placeholders
- Smart escalation recommendations
- Daily wellbeing summaries
- NRI monthly care reports

## Operations Moat

The long-term moat is operations:

- Dispatch engine
- Caregiver attendance and workforce management
- SLA timers and late-checkin alerts
- Emergency routing
- Incident management
- Auto reassignment
- Supervisor dashboard
- City-level analytics

## Current Implementation Direction

The current build preserves Firebase and adds production functionality incrementally:

- Customer app, partner app, and ops app
- Signed session cookies and protected APIs
- Booking lifecycle and live care tracking
- Razorpay order and verification scaffolding
- Voice-note upload scaffolding
- Geocoding and live map support
- Firebase security rules
- KYC upload and admin review scaffolding
- PWA, legal placeholders, observability placeholders
- India-first communication provider scaffolding
- Internal ops alert route for SLA/emergency escalation

## Next Priorities

- Enforce Firebase App Check
- Add real WhatsApp Business / MSG91 / Exotel credentials
- Add Slack ops webhook
- Add caregiver attendance and shift history
- Add family member scoped access to reports
- Add push notification tokens and delivery receipts
- Add AI summary generation after visit reports
- Add monthly PDF report generation
- Add real monitoring keys and alerting
