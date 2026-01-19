<?php
include_once 'api/db.php';

try {
    $conn->exec("DROP TABLE IF EXISTS survey_works");
    
    $sql = "CREATE TABLE survey_works (
        id INT AUTO_INCREMENT PRIMARY KEY,
        received_seq VARCHAR(50) COMMENT 'ลำดับที่รับเรื่อง',
        received_date DATE COMMENT 'วันที่รับเรื่อง',
        rw12_no VARCHAR(50) COMMENT 'เลขที่ ร.ว.12',
        rw12_date DATE COMMENT 'วันที่ ร.ว.12',
        survey_type VARCHAR(100) COMMENT 'ประเภทการรังวัด',
        plot_no VARCHAR(50) COMMENT 'แปลง',
        applicant VARCHAR(255) COMMENT 'ผู้ขอรังวัด',
        doc_type VARCHAR(100) COMMENT 'ประเภทเอกสารสิทธิ์',
        doc_no VARCHAR(50) COMMENT 'เลขที่เอกสารสิทธิ์',
        surveyor VARCHAR(255) COMMENT 'นายช่างรังวัด',
        survey_date DATE COMMENT 'วันที่นัดรังวัด',
        registration_date DATE COMMENT 'วันที่ส่งทะเบียน',
        status VARCHAR(50) DEFAULT 'pending' COMMENT 'สถานะ',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $conn->exec($sql);
    echo "Table 'survey_works' created successfully.";
} catch(PDOException $e) {
    echo "Error creating table: " . $e->getMessage();
}
?>
