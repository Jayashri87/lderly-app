-- LDERLY relational target schema.
-- Current production source of truth remains Firebase Realtime Database.
-- This migration is for future Postgres/Supabase reporting and scale architecture.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('customer', 'caretaker', 'admin', 'superadmin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM (
      'requested',
      'searching',
      'assigned',
      'accepted',
      'en_route',
      'arrived',
      'in_progress',
      'completed',
      'payment_settled',
      'report_generated',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'paid', 'refunded', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20),
  role user_role NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR phone_number IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_pincode ON customers(pincode);

CREATE TABLE IF NOT EXISTS care_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  relationship VARCHAR(80) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  age INT,
  phone VARCHAR(20),
  address TEXT,
  mobility_status VARCHAR(80),
  medical_notes TEXT,
  allergies TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_recipients_customer ON care_recipients(customer_id);

CREATE TABLE IF NOT EXISTS caretakers (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
  total_bookings INT NOT NULL DEFAULT 0,
  languages TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  years_experience INT,
  available BOOLEAN NOT NULL DEFAULT FALSE,
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretakers_city ON caretakers(city);
CREATE INDEX IF NOT EXISTS idx_caretakers_verification ON caretakers(verification_status);
CREATE INDEX IF NOT EXISTS idx_caretakers_available ON caretakers(available);
CREATE INDEX IF NOT EXISTS idx_caretakers_rating ON caretakers(rating DESC);

CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  base_amount_paise INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_active ON service_catalog(active, category);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  care_recipient_id UUID REFERENCES care_recipients(id),
  caretaker_id UUID REFERENCES caretakers(id),
  service_id UUID REFERENCES service_catalog(id),
  service_name VARCHAR(180) NOT NULL,
  status booking_status NOT NULL DEFAULT 'requested',
  requested_date TIMESTAMPTZ NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INT,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  location_address TEXT,
  notes TEXT,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_amount_paise INT,
  payment_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_caretaker ON bookings(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_requested_date ON bookings(requested_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

CREATE TABLE IF NOT EXISTS dispatch_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  caretaker_id UUID NOT NULL REFERENCES caretakers(id),
  score INT NOT NULL DEFAULT 0,
  distance_km DECIMAL(8, 2),
  eta_minutes INT,
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (booking_id, caretaker_id)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_offers_booking ON dispatch_offers(booking_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_caretaker ON dispatch_offers(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_status ON dispatch_offers(status);

CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  caretaker_id UUID NOT NULL REFERENCES caretakers(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status booking_status NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  distance_km DECIMAL(8, 2),
  duration_minutes INT,
  eta_minutes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journeys_booking ON journeys(booking_id);
CREATE INDEX IF NOT EXISTS idx_journeys_caretaker ON journeys(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_journeys_customer ON journeys(customer_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status);

CREATE TABLE IF NOT EXISTS location_history (
  id UUID DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  caretaker_id UUID NOT NULL REFERENCES caretakers(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy_meters INT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE IF NOT EXISTS location_history_default PARTITION OF location_history DEFAULT;

CREATE INDEX IF NOT EXISTS idx_location_journey ON location_history(journey_id);
CREATE INDEX IF NOT EXISTS idx_location_caretaker ON location_history(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_location_recorded_at ON location_history(recorded_at DESC);

CREATE TABLE IF NOT EXISTS payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount_paise INT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  idempotency_key UUID UNIQUE NOT NULL,
  reconciliation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_booking ON payment_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_customer ON payment_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_sessions_razorpay_payment
  ON payment_sessions(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  type VARCHAR(50),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  caretaker_id UUID NOT NULL REFERENCES caretakers(id),
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_booking ON ratings(booking_id);
CREATE INDEX IF NOT EXISTS idx_ratings_caretaker ON ratings(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_ratings_customer ON ratings(customer_id);
