-- Add registration_number column to users table
-- This migration adds a UNIQUE registration number for students

ALTER TABLE users 
ADD COLUMN registration_number VARCHAR(20) UNIQUE;

-- Add index for faster lookups
CREATE INDEX idx_users_registration_number ON users(registration_number);

-- Add comment
COMMENT ON COLUMN users.registration_number IS 'Unique student registration number in format REGYYYYNNNN';
