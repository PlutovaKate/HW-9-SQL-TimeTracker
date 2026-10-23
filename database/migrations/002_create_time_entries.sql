CREATE TABLE IF NOT EXISTS time_entries
(
    id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id    INT UNSIGNED           NOT NULL,
    type       ENUM ('work', 'lunch') NOT NULL,
    started_at DATETIME               NOT NULL,
    ended_at   DATETIME,
    note       VARCHAR(255),
    created_by INT UNSIGNED           NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE INDEX idx_user_id_started_at ON time_entries (user_id, started_at);