<?php
header('Content-Type: application/json; charset=utf-8');
include_once 'db.php';

try {
    $limit = 2000; // Fetch limit to prevent memory issues

    // Fetch activity_logs
    $stmt1 = $conn->prepare("SELECT 'ระบบ (Activity)' as log_type, id, user_name as user, action, department as module, item_id as ref_id, details, created_at as log_date FROM activity_logs ORDER BY created_at DESC LIMIT " . $limit);
    $stmt1->execute();
    $activities = $stmt1->fetchAll(PDO::FETCH_ASSOC);
    
    // Fetch status_history
    $stmt2 = $conn->prepare("SELECT 'ประวัติงาน (Status)' as log_type, id, changed_by as user, action_type as action, work_type as module, work_id as ref_id, 
        CONCAT(IFNULL(note, ''), ' | ', IFNULL(old_value, '-'), ' -> ', IFNULL(new_value, '-')) as details, changed_at as log_date 
        FROM status_history ORDER BY changed_at DESC LIMIT " . $limit);
    $stmt2->execute();
    $histories = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    
    // Clean up history details format
    foreach ($histories as &$h) {
        $h['details'] = trim(str_replace(' | - -> -', '', $h['details']));
        if ($h['details'] == '- -> -' || $h['details'] == '') {
            $h['details'] = 'การปรับปรุงข้อมูลประวัติ';
        }
    }
    
    // Combine logs
    $all_logs = array_merge($activities, $histories);
    
    // Sort combined logs by date descending
    usort($all_logs, function($a, $b) {
        return strtotime($b['log_date']) - strtotime($a['log_date']);
    });
    
    // Slice top N after sort
    $all_logs = array_slice($all_logs, 0, $limit);
    
    echo json_encode($all_logs);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
