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

    // Baseline date: 31 Dec 2025 (BE 2568) - งานที่รับเรื่องก่อน 1 ม.ค. 2569
    $baselineDate = '2025-12-31';

    // Get report year (fiscal year starting Oct, default current)
    $reportYear = $_GET['year'] ?? date('Y');

    // Department mapping (ใช้ 3 ฝ่ายที่มีในระบบ)
    $deptMap = [
        'survey' => ['table' => 'survey_works', 'name' => 'ฝ่ายรังวัด', 'order' => 4],
        'registration' => ['table' => 'registration_works', 'name' => 'ฝ่ายทะเบียน', 'order' => 3],
        'academic' => ['table' => 'academic_works', 'name' => 'กลุ่มงานวิชาการที่ดิน', 'order' => 2]
    ];

    // Get total old work count (baseline)
    $totalOldWork = 0;
    foreach ($deptMap as $deptKey => $deptInfo) {
        $table = $deptInfo['table'];
        $countSql = "SELECT COUNT(*) as cnt FROM $table WHERE received_date < '2026-01-01'";
        $stmt = $conn->query($countSql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalOldWork += (int) $row['cnt'];
    }

    // Generate monthly reports for the year (Jan to Dec)
    $months = [];

    // Track previous month's remaining for each department (for rolling calculation)
    $previousRemaining = [];

    for ($m = 1; $m <= 12; $m++) {
        $yearMonth = sprintf('%04d-%02d', $reportYear, $m);
        $monthStart = $yearMonth . '-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));

        $monthData = [
            'month' => $yearMonth,
            'month_label' => getThaiMonthName($m) . ' ' . ($reportYear + 543),
            'departments' => []
        ];

        foreach ($deptMap as $deptKey => $deptInfo) {
            $table = $deptInfo['table'];

            // Query for old work breakdown by progress_type
            // progress_type: 1=ปกติ, 2=สุดขั้นตอน, 3=ศาล, 4=งานค้าง
            $sql = "SELECT 
                progress_type,
                COUNT(*) as total,
                SUM(CASE WHEN completion_date IS NOT NULL 
                         AND completion_date != '0000-00-00' 
                         AND completion_date >= :month_start 
                         AND completion_date <= :month_end 
                    THEN 1 ELSE 0 END) as completed_this_month
            FROM $table
            WHERE received_date < '2026-01-01'
            GROUP BY progress_type";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                'month_start' => $monthStart,
                'month_end' => $monthEnd
            ]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Initialize counters
            $normalWork = 0;      // progress_type = 1 (ปกติ/งานตามโครงสร้าง)
            $finalStep = 0;       // progress_type = 2 (สุดขั้นตอน)
            $courtWork = 0;       // progress_type = 3 (งานศาล)
            $backlogWork = 0;     // progress_type = 4 (งานค้าง) - initial total
            $completedThisMonth = 0;
            $totalDept = 0;

            foreach ($rows as $row) {
                $type = (int) $row['progress_type'];
                $count = (int) $row['total'];
                $completed = (int) $row['completed_this_month'];

                $totalDept += $count;

                // Only count completed for progress_type = 4 (งานค้าง)
                if ($type == 4) {
                    $completedThisMonth = $completed;
                }

                switch ($type) {
                    case 1:
                        $normalWork = $count;
                        break;
                    case 2:
                        $finalStep = $count;
                        break;
                    case 3:
                        $courtWork = $count;
                        break;
                    case 4:
                        $backlogWork = $count;
                        break;
                }
            }

            // For first month: use initial backlog count
            // For subsequent months: use previous month's remaining
            if ($m == 1) {
                // First month: backlog_total = total งานค้าง (progress_type = 4)
                $backlogTotal = $backlogWork;
            } else {
                // Subsequent months: backlog_total = previous month's remaining
                $backlogTotal = isset($previousRemaining[$deptKey]) ? $previousRemaining[$deptKey] : $backlogWork;
            }

            // Calculate percentage completed
            $percentage = $backlogTotal > 0 ? round(($completedThisMonth / $backlogTotal) * 100, 1) : 0;

            // Calculate remaining
            $remaining = max(0, $backlogTotal - $completedThisMonth);

            // Store this month's remaining for next month's calculation
            $previousRemaining[$deptKey] = $remaining;

            // Calculate backlog target (5% of total)
            $backlogTarget = round($totalDept * 0.05);

            $monthData['departments'][$deptKey] = [
                'name' => $deptInfo['name'],
                'order' => $deptInfo['order'],
                'structure_work' => $normalWork + $finalStep + $courtWork, // งานตามโครงสร้างอำนาจหน้าที่
                'final_step' => $finalStep,          // งานสุดขั้นตอน
                'court_work' => $courtWork,          // งานศาล
                'backlog_total' => $backlogTotal,    // งานค้าง จำนวน (rolling from previous month)
                'backlog_target' => $backlogTarget,  // เป้าหมาย 5%
                'completed_count' => $completedThisMonth,   // ดำเนินการแล้วเสร็จ เรื่อง
                'completed_percentage' => $percentage,      // ดำเนินการแล้วเสร็จ ร้อยละ
                'remaining' => $remaining            // คงเหลือ
            ];
        }

        // Sort departments by order
        uasort($monthData['departments'], function ($a, $b) {
            return $a['order'] - $b['order'];
        });

        $months[] = $monthData;
    }

    echo json_encode([
        'status' => 'success',
        'baseline_date' => $baselineDate,
        'baseline_label' => 'ยอดยกมา ณ วันที่ 31 ธ.ค. 68',
        'total_old_work' => $totalOldWork,
        'report_year' => $reportYear,
        'months' => $months
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * Get Thai month name
 */
function getThaiMonthName($month)
{
    $thaiMonths = [
        1 => 'มกราคม',
        2 => 'กุมภาพันธ์',
        3 => 'มีนาคม',
        4 => 'เมษายน',
        5 => 'พฤษภาคม',
        6 => 'มิถุนายน',
        7 => 'กรกฎาคม',
        8 => 'สิงหาคม',
        9 => 'กันยายน',
        10 => 'ตุลาคม',
        11 => 'พฤศจิกายน',
        12 => 'ธันวาคม'
    ];
    return $thaiMonths[$month] ?? '';
}
?>