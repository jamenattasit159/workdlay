<?php
/**
 * Old Work Backlog Report API
 * รายงานงานค้างเก่า (ตั้งแต่ 31 ธ.ค. 2568 ลงไป)
 * แยกตามฝ่ายและประเภทงาน (สุดขั้นตอน/งานศาล/งานค้าง)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include_once 'db.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    // Baseline date: 31 Dec 2025 (BE 2568)
    $baselineDate = '2025-12-31';
    
    // Get year-month filter (optional, for monthly breakdown)
    $yearMonth = $_GET['year_month'] ?? null;
    $startMonth = null;
    $endMonth = null;
    
    if ($yearMonth) {
        $startMonth = $yearMonth . '-01';
        $endMonth = date('Y-m-t', strtotime($startMonth));
    }

    // Department mapping
    $deptMap = [
        'survey' => ['table' => 'survey_works', 'name' => 'ฝ่ายรังวัด'],
        'registration' => ['table' => 'registration_works', 'name' => 'ฝ่ายทะเบียน'],
        'academic' => ['table' => 'academic_works', 'name' => 'กลุ่มงานวิชาการ']
    ];

    $result = [];

    foreach ($deptMap as $deptKey => $deptInfo) {
        $table = $deptInfo['table'];
        
        // Query for old work (received_date < 2026-01-01)
        // แยกตาม progress_type: 2=สุดขั้นตอน, 3=งานศาล, 4=งานค้าง
        $sql = "SELECT 
            progress_type,
            COUNT(*) as total,
            SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                     AND completion_date >= :start_month THEN 1 ELSE 0 END) as completed_this_month,
            SUM(CASE WHEN completion_date IS NULL OR completion_date = '0000-00-00' THEN 1 ELSE 0 END) as pending
        FROM $table
        WHERE received_date < :baseline
        GROUP BY progress_type";

        $params = [
            'baseline' => '2026-01-01',
            'start_month' => $startMonth ? $startMonth : '2026-01-01'
        ];

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Initialize counters
        $finalStep = 0;      // progress_type = 2
        $courtWork = 0;      // progress_type = 3
        $backlog = 0;        // progress_type = 4
        $completedThisMonth = 0;
        $pendingTotal = 0;

        foreach ($rows as $row) {
            $type = (int)$row['progress_type'];
            $count = (int)$row['total'];
            $completed = (int)$row['completed_this_month'];
            $pending = (int)$row['pending'];

            if ($type === 2) {
                $finalStep = $count;
            } elseif ($type === 3) {
                $courtWork = $count;
            } elseif ($type === 4) {
                $backlog = $count;
            }
            
            $completedThisMonth += $completed;
            $pendingTotal += $pending;
        }

        // Calculate remaining (คงเหลือ)
        // คงเหลือ = งานค้างทั้งหมด - ดำเนินการแล้วเสร็จในเดือนนี้
        $remaining = max(0, $backlog - $completedThisMonth);

        // Calculate percentage (ร้อยละ)
        $percentage = $backlog > 0 ? round(($completedThisMonth / $backlog) * 100, 1) : 0;

        $result[$deptKey] = [
            'department_name' => $deptInfo['name'],
            'final_step' => $finalStep,           // งานสุดขั้นตอน
            'court_work' => $courtWork,           // งานศาล
            'backlog_total' => $backlog,          // งานค้าง จำนวน
            'completed_count' => $completedThisMonth,  // ดำเนินการแล้วเสร็จ เรื่อง
            'completed_percentage' => $percentage,     // ดำเนินการแล้วเสร็จ ร้อยละ
            'remaining' => $remaining             // คงเหลือ
        ];
    }

    // Calculate total across all departments
    $totalBacklog = array_sum(array_column($result, 'backlog_total'));
    $totalCompleted = array_sum(array_column($result, 'completed_count'));
    $totalRemaining = array_sum(array_column($result, 'remaining'));

    echo json_encode([
        'status' => 'success',
        'baseline_date' => $baselineDate,
        'year_month' => $yearMonth,
        'departments' => $result,
        'summary' => [
            'total_backlog' => $totalBacklog,
            'total_completed' => $totalCompleted,
            'total_remaining' => $totalRemaining
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
