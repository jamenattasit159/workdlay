<?php
/**
 * Backup System Configuration
 * ระบบ Backup อัตโนมัติสำหรับ Emerald Solstice
 */

// Database Configuration (ใช้ค่าเดียวกับ api/db.php)
define('DB_HOST', 'localhost');
define('DB_NAME', 'dol_management');
define('DB_USER', 'root');
define('DB_PASS', '');

// Discord Webhook Configuration
// *** สำคัญ: ใส่ Webhook URL ของคุณที่นี่ หรือตั้งค่าผ่านหน้า Admin ***
define('DISCORD_WEBHOOK_URL', '');

// Backup Settings
define('BACKUP_DIR', __DIR__ . '/files/');
define('BACKUP_RETENTION_DAYS', 30); // ลบไฟล์ backup ที่เก่ากว่า X วัน
define('MAX_BACKUP_FILES', 50); // จำนวนไฟล์ backup สูงสุดที่เก็บ

// Config file path สำหรับเก็บ settings ที่ตั้งค่าผ่าน UI
define('SETTINGS_FILE', __DIR__ . '/settings.json');

/**
 * โหลด settings จากไฟล์ JSON
 */
function loadSettings() {
    if (file_exists(SETTINGS_FILE)) {
        $json = file_get_contents(SETTINGS_FILE);
        return json_decode($json, true) ?: [];
    }
    return [];
}

/**
 * บันทึก settings ลงไฟล์ JSON
 */
function saveSettings($settings) {
    return file_put_contents(SETTINGS_FILE, json_encode($settings, JSON_PRETTY_PRINT));
}

/**
 * ดึง Webhook URL (จาก settings หรือ constant)
 */
function getWebhookUrl() {
    $settings = loadSettings();
    return $settings['webhook_url'] ?? DISCORD_WEBHOOK_URL;
}
?>
