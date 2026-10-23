CREATE TABLE IF NOT EXISTS users
(
    id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    full_name     VARCHAR(255)        NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password      TEXT                NOT NULL,
    role          ENUM ('admin', 'employee') DEFAULT 'employee',
    api_token     VARCHAR(255) UNIQUE,
    work_start    TIME                       DEFAULT '06:00:00',
    daily_hours   TINYINT UNSIGNED           DEFAULT 8,
    vacation_days TINYINT UNSIGNED           DEFAULT 24,
    is_active     BOOL                       DEFAULT true,
    created_at    DATETIME                   DEFAULT CURRENT_TIMESTAMP
);

CREATE FULLTEXT INDEX idx_fulltext_full_name ON users (full_name);