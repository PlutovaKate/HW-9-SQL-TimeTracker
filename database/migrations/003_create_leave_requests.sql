CREATE TABLE IF NOT EXISTS leave_requests
(
    id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id     INT UNSIGNED                                               NOT NULL,
    type        ENUM ('vacation', 'sick', 'day_off')                       NOT NULL,
    date_from   DATE                                                       NOT NULL,
    date_to     DATE                                                       NOT NULL,
    status      ENUM ('pending', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
    comment     VARCHAR(255),
    reviewed_by INT UNSIGNED,
    reviewed_at DATETIME,
    created_at  DATETIME                                 DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
);

CREATE INDEX idx_user_id_date_from_date_to ON leave_requests (user_id, date_from, date_to);