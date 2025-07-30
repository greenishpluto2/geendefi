-- Migration to add hashlock support to existing escrow table
-- Run this against your SQLite database before starting the updated API

ALTER TABLE Escrow ADD COLUMN isHashlock BOOLEAN DEFAULT 0;
ALTER TABLE Escrow ADD COLUMN hashCommitment TEXT;
ALTER TABLE Escrow ADD COLUMN timeoutMs TEXT;
ALTER TABLE Escrow ADD COLUMN secretRevealed TEXT;

-- Create index for hashlock filtering
CREATE INDEX IF NOT EXISTS idx_escrow_isHashlock ON Escrow(isHashlock);

-- Update existing records to be non-hashlock by default
UPDATE Escrow SET isHashlock = 0 WHERE isHashlock IS NULL; 