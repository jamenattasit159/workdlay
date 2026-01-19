<?php
/**
 * Migration Script: Simplify survey_works table
 * ลบคอลัมน์ที่ไม่จำเป็นและเก็บแค่คอลัมน์หลักที่เหมือนกับฝ่ายอื่น
 */

include_once 'api/db.php';

echo "<h2>Survey Works Table Migration - Simplified Schema</h2>";
echo "<pre>";

try {
    // Check current columns
    $checkSql = "SHOW COLUMNS FROM survey_works";
    $stmt = $conn->prepare($checkSql);
    $stmt->execute();
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "คอลัมน์ปัจจุบัน: " . implode(", ", $columns) . "\n\n";
    
    $changes = [];
    
    // ===== เพิ่มคอลัมน์ใหม่ที่ต้องการ =====
    
    // Add 'summary' column if not exists
    if (!in_array('summary', $columns)) {
        $conn->exec("ALTER TABLE `survey_works` ADD COLUMN `summary` TEXT DEFAULT NULL COMMENT 'สรุปเรื่อง' AFTER `applicant`");
        $changes[] = '+ เพิ่ม summary';
    }
    
    // Add 'completion_date' column if not exists
    if (!in_array('completion_date', $columns)) {
        $conn->exec("ALTER TABLE `survey_works` ADD COLUMN `completion_date` DATE DEFAULT NULL COMMENT 'วันที่เสร็จ' AFTER `summary`");
        $changes[] = '+ เพิ่ม completion_date';
    }
    
    // Rename 'status' to 'status_cause' if needed
    if (in_array('status', $columns) && !in_array('status_cause', $columns)) {
        $conn->exec("ALTER TABLE `survey_works` CHANGE `status` `status_cause` VARCHAR(255) DEFAULT NULL COMMENT 'สาเหตุที่ค้าง'");
        $changes[] = '~ เปลี่ยนชื่อ status -> status_cause';
    } elseif (!in_array('status_cause', $columns) && !in_array('status', $columns)) {
        $conn->exec("ALTER TABLE `survey_works` ADD COLUMN `status_cause` VARCHAR(255) DEFAULT NULL COMMENT 'สาเหตุที่ค้าง' AFTER `completion_date`");
        $changes[] = '+ เพิ่ม status_cause';
    }
    
    // Add 'men' column if not exists
    if (!in_array('men', $columns)) {
        $conn->exec("ALTER TABLE `survey_works` ADD COLUMN `men` VARCHAR(100) DEFAULT NULL COMMENT 'คนคุมเรื่อง' AFTER `status_cause`");
        $changes[] = '+ เพิ่ม men (คนคุมเรื่อง)';
    }
    
    // ===== ลบคอลัมน์ที่ไม่ต้องการ =====
    $columnsToRemove = ['rw12_no', 'rw12_date', 'plot_no', 'doc_type', 'doc_no', 'surveyor', 'survey_date', 'registration_date', 'subject', 'related_person', 'responsible_person'];
    
    // Re-fetch columns after additions
    $stmt = $conn->prepare("SHOW COLUMNS FROM survey_works");
    $stmt->execute();
    $currentColumns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    foreach ($columnsToRemove as $col) {
        if (in_array($col, $currentColumns)) {
            $conn->exec("ALTER TABLE `survey_works` DROP COLUMN `$col`");
            $changes[] = "- ลบ $col";
        }
    }
    
    if (count($changes) > 0) {
        echo "✅ Migration เสร็จสิ้น!\n\n";
        echo "การเปลี่ยนแปลง:\n";
        foreach ($changes as $change) {
            echo "  $change\n";
        }
    } else {
        echo "ℹ️ โครงสร้างตารางถูกต้องแล้ว ไม่มีการเปลี่ยนแปลง\n";
    }
    
    // Show final table structure
    echo "\n--- โครงสร้างตารางใหม่ ---\n";
    $stmt = $conn->prepare("DESCRIBE survey_works");
    $stmt->execute();
    $structure = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($structure as $col) {
        $comment = isset($col['Comment']) ? $col['Comment'] : '';
        echo sprintf("%-20s %-30s %s\n", $col['Field'], $col['Type'], $comment);
    }
    
    echo "\n✅ โครงสร้างควรมี 11 คอลัมน์:\n";
    echo "   id, received_seq, received_date, survey_type, applicant, summary, completion_date, status_cause, men, created_at, updated_at\n";
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "</pre>";
echo "<p><a href='index.html'>กลับหน้าหลัก</a></p>";
?>
