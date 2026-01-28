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

    // Base condition for "Old Work" as of baseline date
    $oldWorkCondition = "received_date < '2026-01-01'";

    // Total Old Work (Type 4 only, as requested: "จำนวนความต้องการจริงเอาแค่ (4) พอ")
    $totalOldWork = 0;
    foreach ($deptMap as $deptKey => $deptInfo) {
        $table = $deptInfo['table'];
        $countSql = "SELECT COUNT(*) as cnt FROM $table WHERE $oldWorkCondition AND progress_type = 4 AND (completion_date IS NULL OR completion_date = '0000-00-00' OR completion_date >= '2026-01-01')";
        $stmt = $conn->query($countSql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalOldWork += (int) $row['cnt'];
    }

    // Generate monthly reports for the year (Jan to Dec)
    $months = [];

    // Track state for Type 4 rolling balance
    $type4Rolling = []; // [$deptKey => balance]

    // Initialize state with baseline values
    foreach ($deptMap as $deptKey => $deptInfo) {
        $table = $deptInfo['table'];
        $sql = "SELECT COUNT(*) as total FROM $table WHERE $oldWorkCondition AND progress_type = 4 AND (completion_date IS NULL OR completion_date = '0000-00-00' OR completion_date >= '2026-01-01')";
        $stmt = $conn->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $type4Rolling[$deptKey] = (int) $row['total'];
    }

    // For year 2026 (BE 2569), add December 2568 (BE) as starting point
    if ($reportYear == 2026) {
        $startingMonth = [
            'month' => '2025-12',
            'month_label' => 'ธันวาคม 2568 (ยอดยกมา)',
            'departments' => []
        ];

        foreach ($deptMap as $deptKey => $deptInfo) {
            $table = $deptInfo['table'];

            // Get outstanding counts for type 2 and 3 at start of 2569
            $sql = "SELECT progress_type, COUNT(*) as total FROM $table 
                    WHERE $oldWorkCondition 
                    AND progress_type IN (2, 3) 
                    AND (completion_date IS NULL OR completion_date = '0000-00-00' OR completion_date >= '2026-01-01') 
                    GROUP BY progress_type";
            $stmt = $conn->query($sql);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $counts = [2 => 0, 3 => 0];
            foreach ($rows as $row) {
                $counts[(int) $row['progress_type']] = (int) $row['total'];
            }

            $currentT4 = $type4Rolling[$deptKey];

            $startingMonth['departments'][$deptKey] = [
                'name' => $deptInfo['name'],
                'order' => $deptInfo['order'],
                'final_step' => $counts[2],  // (2)
                'court_work' => $counts[3],  // (3)
                'backlog_total' => $currentT4, // (4)
                'backlog_target' => round($currentT4 * 0.05),
                'completed_count' => 0,
                'completed_percentage' => 0,
                'remaining' => $currentT4
            ];
        }

        uasort($startingMonth['departments'], function ($a, $b) {
            return $a['order'] - $b['order'];
        });

        $months[] = $startingMonth;
    }

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

            // Query current outstanding T2 and T3 (those not completed by end of month)
            $sqlT23 = "SELECT progress_type, COUNT(*) as total FROM $table 
                       WHERE $oldWorkCondition 
                       AND progress_type IN (2, 3) 
                       AND (completion_date IS NULL OR completion_date = '0000-00-00' OR completion_date > :month_end) 
                       GROUP BY progress_type";
            $stmtT23 = $conn->prepare($sqlT23);
            $stmtT23->execute(['month_end' => $monthEnd]);
            $rowsT23 = $stmtT23->fetchAll(PDO::FETCH_ASSOC);
            $countsT23 = [2 => 0, 3 => 0];
            foreach ($rowsT23 as $row) {
                $countsT23[(int) $row['progress_type']] = (int) $row['total'];
            }

            // Query T4 completions for this month
            $sqlT4Comp = "SELECT COUNT(*) as completed FROM $table 
                          WHERE $oldWorkCondition 
                          AND progress_type = 4 
                          AND completion_date >= :month_start AND completion_date <= :month_end";
            $stmtT4Comp = $conn->prepare($sqlT4Comp);
            $stmtT4Comp->execute(['month_start' => $monthStart, 'month_end' => $monthEnd]);
            $rowT4Comp = $stmtT4Comp->fetch(PDO::FETCH_ASSOC);
            $completedT4 = (int) $rowT4Comp['completed'];

            $openingT4 = $type4Rolling[$deptKey];
            $remainingT4 = max(0, $openingT4 - $completedT4);

            // Calculate percentage for T4
            $percentageT4 = $openingT4 > 0 ? round(($completedT4 / $openingT4) * 100, 1) : 0;

            // Update rolling state for next month
            $type4Rolling[$deptKey] = $remainingT4;

            $monthData['departments'][$deptKey] = [
                'name' => $deptInfo['name'],
                'order' => $deptInfo['order'],
                'final_step' => $countsT23[2],  // (2) Simple outstanding count
                'court_work' => $countsT23[3],  // (3) Simple outstanding count
                'backlog_total' => $openingT4, // (4) Rolling balance
                'backlog_target' => round($openingT4 * 0.05),
                'completed_count' => $completedT4,
                'completed_percentage' => $percentageT4,
                'remaining' => $remainingT4
            ];
        }

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