<?php
include_once 'api/db.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS academic_works (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seq_no VARCHAR(50) COMMENT 'ที่',
        received_date DATE NOT NULL COMMENT 'วันที่รับเรื่อง',
        subject VARCHAR(255) NOT NULL COMMENT 'เรื่อง',
        related_person VARCHAR(255) COMMENT 'ผู้ที่เกี่ยวข้อง (คู่กรณี)',
        summary TEXT COMMENT 'ความสำคัญของเรื่อง (โดยสรุป)',
        status_cause VARCHAR(255) COMMENT 'สาเหตุที่ค้าง',
        responsible_person VARCHAR(100) COMMENT 'ผู้รับผิดชอบ',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;";
    
    $conn->exec($sql);
    echo "Table 'academic_works' created successfully.";
} catch(PDOException $e) {
    echo "Error creating table: " . $e->getMessage();
}
?>
