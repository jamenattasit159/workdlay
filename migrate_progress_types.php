<?php
/**
 * Migration Script: Add Progress Types and Status History
 * 
 * Progress Types:
 * 1 = งานปกติ (Normal)
 * 2 = งานสุดขั้นตอน (Final Stage)
 * 3 = งานศาล (Court Related)
 * 4 = งานค้าง (Backlog - imported before Jan 1, 2026)
 */

include_once 'api/db.php';

try {
    $results = [];

    // 1. Add progress_type column to registration_works
    try {
        $conn->exec("ALTER TABLE registration_works ADD COLUMN progress_type TINYINT DEFAULT 4 COMMENT '1=ปกติ, 2=สุดขั้นตอน, 3=ศาล, 4=งานค้าง'");
        $results[] = "✅ Added progress_type to registration_works";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            $results[] = "⚠️ progress_type already exists in registration_works";
        } else {
            throw $e;
        }
    }

    // 2. Add progress_type column to academic_works
    try {
        $conn->exec("ALTER TABLE academic_works ADD COLUMN progress_type TINYINT DEFAULT 4 COMMENT '1=ปกติ, 2=สุดขั้นตอน, 3=ศาล, 4=งานค้าง'");
        $results[] = "✅ Added progress_type to academic_works";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            $results[] = "⚠️ progress_type already exists in academic_works";
        } else {
            throw $e;
        }
    }

    // 3. Add progress_type column to survey_works
    try {
        $conn->exec("ALTER TABLE survey_works ADD COLUMN progress_type TINYINT DEFAULT 4 COMMENT '1=ปกติ, 2=สุดขั้นตอน, 3=ศาล, 4=งานค้าง'");
        $results[] = "✅ Added progress_type to survey_works";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate column') !== false) {
            $results[] = "⚠️ progress_type already exists in survey_works";
        } else {
            throw $e;
        }
    }

    // 4. Add completion_date column if not exists
    $tables = ['registration_works', 'academic_works', 'survey_works'];
    foreach ($tables as $table) {
        try {
            $conn->exec("ALTER TABLE {$table} ADD COLUMN completion_date DATE DEFAULT NULL COMMENT 'วันที่เสร็จงาน'");
            $results[] = "✅ Added completion_date to {$table}";
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate column') !== false) {
                $results[] = "⚠️ completion_date already exists in {$table}";
            }
        }
    }

    // 5. Create status_history table
    $sql = "CREATE TABLE IF NOT EXISTS status_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_type ENUM('survey', 'registration', 'academic') NOT NULL COMMENT 'ประเภทงาน',
        work_id INT NOT NULL COMMENT 'ID ของงานที่อ้างอิง',
        action_type VARCHAR(100) NOT NULL COMMENT 'ประเภทการดำเนินการ',
        old_value TEXT COMMENT 'ค่าเดิม',
        new_value TEXT COMMENT 'ค่าใหม่',
        note TEXT COMMENT 'หมายเหตุ/รายละเอียด',
        changed_by VARCHAR(100) COMMENT 'ผู้ดำเนินการ',
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่ดำเนินการ',
        INDEX idx_work (work_type, work_id),
        INDEX idx_date (changed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการอัปเดตสถานะงาน'";
    
    $conn->exec($sql);
    $results[] = "✅ Created status_history table";

    // 6. Set all existing records to progress_type = 4 (งานค้าง)
    $stmt = $conn->exec("UPDATE registration_works SET progress_type = 4 WHERE progress_type IS NULL OR progress_type = 0");
    $results[] = "✅ Set all registration_works to progress_type = 4 (งานค้าง)";

    $stmt = $conn->exec("UPDATE academic_works SET progress_type = 4 WHERE progress_type IS NULL OR progress_type = 0");
    $results[] = "✅ Set all academic_works to progress_type = 4 (งานค้าง)";

    $stmt = $conn->exec("UPDATE survey_works SET progress_type = 4 WHERE progress_type IS NULL OR progress_type = 0");
    $results[] = "✅ Set all survey_works to progress_type = 4 (งานค้าง)";

    // Output results
    echo "<html><head><meta charset='UTF-8'><title>Migration Results</title>";
    echo "<style>body{font-family:'Sarabun',sans-serif;max-width:800px;margin:50px auto;padding:20px;background:#f0fdf4;}";
    echo "h1{color:#059669;}.result{padding:10px;margin:5px 0;background:white;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}</style></head><body>";
    echo "<h1>🚀 Migration Complete!</h1>";
    foreach ($results as $r) {
        echo "<div class='result'>{$r}</div>";
    }
    echo "<br><a href='index.html' style='color:#059669;font-weight:bold;'>← กลับหน้าหลัก</a>";
    echo "</body></html>";

} catch (PDOException $e) {
    echo "<h1 style='color:red;'>❌ Migration Error</h1>";
    echo "<p>" . $e->getMessage() . "</p>";
}
?>
