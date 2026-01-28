CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    -- 'ADD', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'IMPORT'
    department VARCHAR(50) NOT NULL,
    -- 'survey', 'registration', 'academic', 'system'
    item_id VARCHAR(50) NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (created_at),
    INDEX (user_name),
    INDEX (action)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;