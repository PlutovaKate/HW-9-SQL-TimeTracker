ALTER TABLE users
ADD COLUMN token_expired_at DATETIME NULL AFTER api_token;