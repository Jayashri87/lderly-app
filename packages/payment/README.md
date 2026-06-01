# @lderly/payment

Target package for payment provider contracts and reconciliation helpers.

Current runtime implementation remains in:

- `server/paymentProvider.ts`
- `server/financeProvider.ts`
- `app/api/payments/*`

Implemented shared helpers:

- INR amount parsing into paise
- Razorpay order/payment signature verification
- Razorpay payment status, currency, order, and amount validation
