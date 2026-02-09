<?php
/**
 * ABM Report API
 * Handles monthly ABM report data for old work and new work tracking
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include_once 'db.php';

// Enable Emulate Prepares to allow duplicate named parameters in queries
$conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get ABM report data
            $yearMonth = $_GET['years_month'] ?? null;
            $department = $_GET['department'] ?? 'all';

            // 1. Get saved user input data (Completed Work from monthly_kpi_reports)

            // Define departments
            $departments = ['survey', 'registration', 'academic', 'admin'];

            // Helper function to get stats for a specific department
            function getDepartmentStats($conn, $dept, $baselineDateCE, $yearMonth)
            {
                // Define Month Range
                $startMonth = $yearMonth . '-01';
                $endMonth = date('Y-m-t', strtotime($startMonth));

                // Get Saved Data (Aggregated if duplicates exist)
                $saved = [
                    'old_work_baseline' => 0,
                    'new_work_received' => 0,
                    'new_work_completed' => 0,
                    'completed_within_30' => 0,
                    'completed_within_60' => 0,
                    'completed_over_60' => 0,
                    'notes' => ''
                ];
                if ($yearMonth) {
                    $stmt = $conn->prepare("
                        SELECT 
                            SUM(old_work_baseline) as old_work_baseline,
                            SUM(new_work_received) as new_work_received,
                            SUM(new_work_completed) as new_work_completed,
                            SUM(completed_within_30) as completed_within_30,
                            SUM(completed_within_60) as completed_within_60,
                            SUM(completed_over_60) as completed_over_60,
                            SUM(survey_received_from_reg) as survey_reg,
                            MAX(notes) as notes
                        FROM monthly_kpi_reports 
                        WHERE years_month = ? AND department = ?
                        GROUP BY years_month, department
                    ");
                    $stmt->execute([$yearMonth, $dept]);
                    $fetched = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($fetched) {
                        $saved = $fetched;
                    }
                }

                $tableMap = [
                    'survey' => 'survey_works',
                    'registration' => 'registration_works',
                    'academic' => 'academic_works'
                ];

                $table = $tableMap[$dept] ?? null;

                if (!$table) {
                    return [
                        'saved' => $saved,
                        'current_received' => 0,
                        'current_completed' => 0,
                        'current_pending' => 0,
                        'prev_resolved' => 0,
                        'prev_pending' => 0,
                        'old_pending' => 0
                    ];
                }

                // New Work Stats with same-month logic
                // comp30 = received AND completed in the SAME month
                // pending = received this month AND not completed within the same month
                $sql = "SELECT 
                    -- Intake of Requested Month
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m THEN 1 ELSE 0 END) as current_received,
                    
                    -- (7) Completed within the same month as received (เสร็จภายในเดือนที่รับ)
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                             AND DATE_FORMAT(completion_date, '%Y-%m') = DATE_FORMAT(received_date, '%Y-%m') THEN 1 ELSE 0 END) as current_completed_30,
                    
                    -- (8) comp60 will be calculated separately (งานเดือนก่อนเสร็จเดือนนี้)
                    0 as current_completed_60,
                    
                    -- (9) Pending: not completed within the same month (งานค้างยกไปเดือนหน้า)
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND (completion_date IS NULL OR completion_date = '0000-00-00' 
                                  OR DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')) THEN 1 ELSE 0 END) as count_pending,

                    -- Breakdown of Pending (Month's Intake)
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND ((completion_date IS NULL OR completion_date = '0000-00-00' 
                                  OR DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')))
                             AND progress_type = 2 THEN 1 ELSE 0 END) as pending_type2,
                             
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND ((completion_date IS NULL OR completion_date = '0000-00-00' 
                                  OR DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')))
                             AND progress_type = 4 THEN 1 ELSE 0 END) as pending_type4
                FROM $table WHERE received_date BETWEEN :start_m AND :end_m";

                $stmt = $conn->prepare($sql);
                $stmt->execute([
                    'start_m' => $startMonth,
                    'end_m' => $endMonth
                ]);
                $stats = $stmt->fetch(PDO::FETCH_ASSOC);

                // Old Work Stats (Baseline) - Keep for main view if needed
                $oldPendingSQL = "SELECT COUNT(*) as pending FROM $table WHERE received_date < :baseline AND (completion_date IS NULL OR completion_date = '0000-00-00' OR completion_date >= :start_m)";
                $stmt = $conn->prepare($oldPendingSQL);
                $stmt->execute(['baseline' => $baselineDateCE, 'start_m' => $startMonth]);
                $oldPending = $stmt->fetch(PDO::FETCH_ASSOC)['pending'];

                if ($dept === 'survey') {
                    return [
                        'saved' => $saved,
                        'current_received' => 0,
                        'current_completed_30' => 0,
                        'current_completed_60' => 0,
                        'current_pending' => 0,
                        'pending_type2' => 0,
                        'pending_type4' => 0,
                        'old_pending' => 0
                    ];
                }

                return [
                    'saved' => $saved,
                    'current_received' => (int) ($stats['current_received'] ?? 0),
                    'current_completed_30' => (int) ($stats['current_completed_30'] ?? 0),
                    'current_completed_60' => (int) ($stats['current_completed_60'] ?? 0),
                    'current_pending' => (int) ($stats['count_pending'] ?? 0),
                    'pending_type2' => (int) ($stats['pending_type2'] ?? 0),
                    'pending_type4' => (int) ($stats['pending_type4'] ?? 0),
                    'old_pending' => (int) $oldPending
                ];
            }

            $baselineDateCE = '2026-01-01';

            $breakdown = [];
            foreach ($departments as $dept) {
                if ($dept === 'admin')
                    continue;
                $breakdown[$dept] = getDepartmentStats($conn, $dept, $baselineDateCE, $yearMonth);
            }

            // Calculate Monthly Trend Breakdown by Department - OPTIMIZED VERSION
            $trend = [];
            $reportType = isset($_GET['report_type']) ? trim($_GET['report_type']) : 'yearly'; // 'monthly' or 'yearly'
            $requestedYear = $yearMonth ? date('Y', strtotime($yearMonth . '-01')) : date('Y');
            $requestedMonth = $yearMonth ? (int) date('n', strtotime($yearMonth . '-01')) : (int) date('n');
            $currentYear = date('Y');
            $currentMonth = (int) date('n');

            // Determine months to show
            if ($reportType === 'monthly') {
                $startMonthIdx = $requestedMonth;
                $maxMonthIdx = $requestedMonth;
            } elseif ($reportType === 'range') {
                $startMonthIdx = $requestedMonth;
                $endMonth = $_GET['end_month'] ?? $yearMonth;
                $maxMonthIdx = (int) date('n', strtotime($endMonth . '-01'));

                // Ensure max >= start and prevent year overflow if not handled
                if ($maxMonthIdx < $startMonthIdx)
                    $maxMonthIdx = $startMonthIdx;
            } else {
                $startMonthIdx = 1;
                // Determine max month to show for yearly view
                if ($requestedYear < $currentYear) {
                    $maxMonthIdx = 12;
                } elseif ($requestedYear == $currentYear) {
                    $maxMonthIdx = max($currentMonth, $requestedMonth);
                } else {
                    $maxMonthIdx = $requestedMonth;
                }
            }

            // Pre-fetch all saved manual KPI data for the year in one query (Aggregated)
            $savedDataByMonthDept = [];
            $savedStmt = $conn->prepare("
                SELECT 
                    years_month, 
                    department,
                    SUM(completed_within_30) as completed_within_30,
                    SUM(completed_within_60) as completed_within_60,
                    SUM(survey_received_from_reg) as survey_reg,
                    MAX(notes) as notes
                FROM monthly_kpi_reports 
                WHERE years_month LIKE ? AND department IN ('survey', 'registration', 'academic')
                GROUP BY years_month, department
            ");
            $savedStmt->execute([$requestedYear . '-%']);
            while ($row = $savedStmt->fetch(PDO::FETCH_ASSOC)) {
                $savedDataByMonthDept[$row['years_month']][$row['department']] = $row;
            }

            // Pre-fetch all work stats for all months in ONE query per table
            $tableMap = [
                'survey' => 'survey_works',
                'registration' => 'registration_works',
                'academic' => 'academic_works'
            ];

            $startYear = $requestedYear . '-01-01';
            $endYear = $requestedYear . '-12-31';

            $workStatsByMonthDept = [];
            foreach ($tableMap as $deptKey => $tableName) {
                // Updated logic:
                // comp30 = Received AND completed in the SAME month (เสร็จภายในเดือนที่รับ)
                // comp60 = Received in PREVIOUS month AND completed in THIS month (งานเดือนก่อนเสร็จเดือนนี้)
                // pending = Received this month AND not completed by end of this month (งานค้างยกไปเดือนหน้า)

                // Query 1: Get stats by received month
                $sql = "SELECT 
                    DATE_FORMAT(received_date, '%Y-%m') as month,
                    COUNT(*) as current_received,
                    
                    -- comp30: Received AND completed in the SAME month (เสร็จภายในเดือนที่รับ)
                    SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                             AND completion_date <= CURDATE()
                             AND DATE_FORMAT(completion_date, '%Y-%m') = DATE_FORMAT(received_date, '%Y-%m') THEN 1 ELSE 0 END) as comp30,
                    
                    -- pending: Received this month AND not completed within the same month (งานค้างยกไปเดือนหน้า)
                    SUM(CASE WHEN (completion_date IS NULL OR completion_date = '0000-00-00')
                             OR (completion_date > CURDATE())
                             OR (DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')) THEN 1 ELSE 0 END) as pending,
                    
                    -- pending breakdown by progress_type
                    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                                 OR (completion_date > CURDATE())
                                 OR (DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')))
                             AND progress_type = 2 THEN 1 ELSE 0 END) as pending_type2,
                    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                                 OR (completion_date > CURDATE())
                                 OR (DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')))
                             AND progress_type = 3 THEN 1 ELSE 0 END) as pending_type3,
                    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                                 OR (completion_date > CURDATE())
                                 OR (DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')))
                             AND progress_type = 4 THEN 1 ELSE 0 END) as pending_type4
                FROM $tableName 
                WHERE received_date BETWEEN ? AND ?
                GROUP BY DATE_FORMAT(received_date, '%Y-%m')
                ORDER BY month";

                $stmt = $conn->prepare($sql);
                $stmt->execute([$startYear, $endYear]);
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $workStatsByMonthDept[$row['month']][$deptKey] = $row;
                    $workStatsByMonthDept[$row['month']][$deptKey]['comp60'] = 0; // Will be calculated separately
                }

                // Query 2: Get comp60 by COMPLETION month (งานเดือนก่อนที่เสร็จเดือนนี้)
                $sqlComp60 = "SELECT 
                    DATE_FORMAT(completion_date, '%Y-%m') as comp_month,
                    COUNT(*) as comp60
                FROM $tableName 
                WHERE received_date BETWEEN ? AND ?
                  AND completion_date IS NOT NULL 
                  AND completion_date != '0000-00-00'
                  AND completion_date <= CURDATE()
                  AND DATE_FORMAT(completion_date, '%Y-%m') != DATE_FORMAT(received_date, '%Y-%m')
                  AND DATE_FORMAT(completion_date, '%Y-%m') = DATE_FORMAT(DATE_ADD(received_date, INTERVAL 1 MONTH), '%Y-%m')
                GROUP BY DATE_FORMAT(completion_date, '%Y-%m')";

                $stmt = $conn->prepare($sqlComp60);
                $stmt->execute([$startYear, $endYear]);
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $compMonth = $row['comp_month'];
                    if (!isset($workStatsByMonthDept[$compMonth][$deptKey])) {
                        $workStatsByMonthDept[$compMonth][$deptKey] = [
                            'current_received' => 0,
                            'comp30' => 0,
                            'comp60' => 0,
                            'pending' => 0,
                            'pending_type2' => 0,
                            'pending_type4' => 0
                        ];
                    }
                    $workStatsByMonthDept[$compMonth][$deptKey]['comp60'] = (int) $row['comp60'];
                }
            }

            // Query for Survey: งานรับใหม่, งานเสร็จ, และงานรับจากทะเบียน
            // งานใหม่ = received_date >= 2026-01-01
            $surveyIntakeByMonth = [];
            $surveyCompletedByMonth = [];
            $surveyReceivedByMonth = []; // งานรับจากทะเบียน (นับจาก received_date)

            // Query 0: นับงานรับจากทะเบียน (นับทุกงานที่เข้ามาในเดือนนั้น)
            $sqlSurveyReceived = "SELECT 
                DATE_FORMAT(received_date, '%Y-%m') as month,
                COUNT(*) as received_count
            FROM survey_works 
            WHERE received_date >= '2026-01-01'
              AND received_date BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(received_date, '%Y-%m')";

            $stmt = $conn->prepare($sqlSurveyReceived);
            $stmt->execute([$startYear, $endYear]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $surveyReceivedByMonth[$row['month']] = (int) $row['received_count'];
            }

            // Query 1: นับงานรับใหม่ (Intake) - unique jobs ที่มี (status_cause = นัดรังวัด OR completion_date IS NOT NULL)
            // ถ้างานมีทั้งสองอย่าง = นับเป็น 1 งาน
            // Group by received_date month
            $sqlSurveyIntake = "SELECT 
                DATE_FORMAT(received_date, '%Y-%m') as month,
                COUNT(DISTINCT id) as intake_count
            FROM survey_works 
            WHERE received_date >= '2026-01-01'
              AND received_date BETWEEN ? AND ?
              AND (
                  status_cause LIKE '%นัดรังวัด%' 
                  OR (completion_date IS NOT NULL AND completion_date != '0000-00-00')
              )
            GROUP BY DATE_FORMAT(received_date, '%Y-%m')";

            $stmt = $conn->prepare($sqlSurveyIntake);
            $stmt->execute([$startYear, $endYear]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $surveyIntakeByMonth[$row['month']] = (int) $row['intake_count'];
            }

            // Query 2: นับงานรังวัดใหม่ที่เสร็จในแต่ละเดือน (by completion_date)
            $sqlSurveyCompleted = "SELECT 
                DATE_FORMAT(completion_date, '%Y-%m') as month,
                COUNT(*) as completed_count
            FROM survey_works 
            WHERE received_date >= '2026-01-01'
              AND completion_date IS NOT NULL 
              AND completion_date != '0000-00-00'
              AND completion_date BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(completion_date, '%Y-%m')";

            $stmt = $conn->prepare($sqlSurveyCompleted);
            $stmt->execute([$startYear, $endYear]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $surveyCompletedByMonth[$row['month']] = (int) $row['completed_count'];
            }

            // --- Pre-fetch Old Work (Before 2026) for cumulative totals ---
            $oldWorkStats = [];
            foreach ($tableMap as $deptKey => $tableName) {
                // Get totals for each type
                $sqlOld = "SELECT 
                            progress_type,
                            DATE_FORMAT(completion_date, '%Y-%m') as comp_month,
                            COUNT(*) as cnt
                          FROM $tableName 
                          WHERE received_date < '2026-01-01'
                          GROUP BY progress_type, DATE_FORMAT(completion_date, '%Y-%m')";

                $stmt = $conn->query($sqlOld);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $oldWorkStats[$deptKey] = [
                    'type2_total' => 0,
                    'type3_total' => 0,
                    'type4_total' => 0,
                    'type2_comps' => [],
                    'type3_comps' => [],
                    'type4_comps' => []
                ];

                foreach ($rows as $row) {
                    $pt = (int) $row['progress_type'];
                    $cm = $row['comp_month'] ?: 'none';
                    $cnt = (int) $row['cnt'];
                    if ($pt == 2) {
                        $oldWorkStats[$deptKey]['type2_total'] += $cnt;
                        if ($cm !== 'none')
                            $oldWorkStats[$deptKey]['type2_comps'][$cm] = ($oldWorkStats[$deptKey]['type2_comps'][$cm] ?? 0) + $cnt;
                    } else if ($pt == 3) {
                        $oldWorkStats[$deptKey]['type3_total'] += $cnt;
                        if ($cm !== 'none')
                            $oldWorkStats[$deptKey]['type3_comps'][$cm] = ($oldWorkStats[$deptKey]['type3_comps'][$cm] ?? 0) + $cnt;
                    } else if ($pt == 4) {
                        $oldWorkStats[$deptKey]['type4_total'] += $cnt;
                        if ($cm !== 'none')
                            $oldWorkStats[$deptKey]['type4_comps'][$cm] = ($oldWorkStats[$deptKey]['type4_comps'][$cm] ?? 0) + $cnt;
                    }
                }
            }
            // -------------------------------------------------------------

            // Build trend array efficiently
            for ($m = $startMonthIdx; $m <= $maxMonthIdx; $m++) {
                $loopMonth = $requestedYear . '-' . str_pad($m, 2, '0', STR_PAD_LEFT);
                $monthStats = [
                    'month' => $loopMonth,
                    'depts' => []
                ];

                foreach (['survey', 'registration', 'academic'] as $dept) {
                    $workData = $workStatsByMonthDept[$loopMonth][$dept] ?? ['current_received' => 0, 'comp30' => 0, 'comp60' => 0, 'pending' => 0];
                    $savedData = $savedDataByMonthDept[$loopMonth][$dept] ?? [];

                    $manual30 = (int) ($savedData['completed_within_30'] ?? 0);
                    $manual60 = (int) ($savedData['completed_within_60'] ?? 0);
                    $surveyReg = ($dept === 'survey') ? (int) ($savedData['survey_reg'] ?? 0) : 0;

                    // Calculate remaining Old Work (Before 2026) at this point in time
                    $cumOldComp2 = 0;
                    $cumOldComp3 = 0;
                    $cumOldComp4 = 0;
                    for ($cm = 1; $cm <= $m; $cm++) {
                        $cmKey = $requestedYear . '-' . str_pad($cm, 2, '0', STR_PAD_LEFT);
                        $cumOldComp2 += $oldWorkStats[$dept]['type2_comps'][$cmKey] ?? 0;
                        $cumOldComp3 += $oldWorkStats[$dept]['type3_comps'][$cmKey] ?? 0;
                        $cumOldComp4 += $oldWorkStats[$dept]['type4_comps'][$cmKey] ?? 0;
                    }
                    $remOld2 = max(0, $oldWorkStats[$dept]['type2_total'] - $cumOldComp2);
                    $remOld3 = max(0, $oldWorkStats[$dept]['type3_total'] - $cumOldComp3);
                    $remOld4 = max(0, $oldWorkStats[$dept]['type4_total'] - $cumOldComp4);

                    if ($dept === 'survey') {
                        $surveyReceived = $surveyReceivedByMonth[$loopMonth] ?? 0;
                        $surveyIntake = $surveyIntakeByMonth[$loopMonth] ?? 0;
                        $surveyCompleted = $surveyCompletedByMonth[$loopMonth] ?? 0;

                        $intake = $surveyIntake;
                        $comp30 = $surveyCompleted;
                        $compPercent = ($intake > 0) ? round(($comp30 / $intake) * 100, 2) : 0;

                        $monthStats['depts'][$dept] = [
                            'intake' => $intake,
                            'comp30' => $comp30,
                            'comp60' => 0,
                            'pending' => max(0, $intake - $comp30),
                            'pending_type2' => (int) ($workData['pending_type2'] ?? 0) + $remOld2,
                            'pending_type3' => (int) ($workData['pending_type3'] ?? 0) + $remOld3,
                            'pending_type4' => (int) ($workData['pending_type4'] ?? 0) + $remOld4,
                            'survey_reg' => $surveyReceived,
                            'survey_completed' => $surveyCompleted,
                            'comp_percent' => $compPercent,
                            'notes' => $savedData['notes'] ?? ''
                        ];
                    } else {
                        $intake = (int) $workData['current_received'] + $manual30 + $manual60 + $surveyReg;
                        $monthStats['depts'][$dept] = [
                            'intake' => $intake,
                            'comp30' => (int) $workData['comp30'] + $manual30,
                            'comp60' => (int) $workData['comp60'] + $manual60,
                            'pending' => (int) $workData['pending'],
                            'pending_type2' => (int) ($workData['pending_type2'] ?? 0) + $remOld2,
                            'pending_type3' => (int) ($workData['pending_type3'] ?? 0) + $remOld3,
                            'pending_type4' => (int) ($workData['pending_type4'] ?? 0) + $remOld4,
                            'survey_reg' => $surveyReg,
                            'notes' => $savedData['notes'] ?? ''
                        ];
                    }
                }
                $trend[] = $monthStats;
            }

            // Calculate totals for 'all'
            $totalNewPending = 0;
            foreach ($breakdown as $deptData) {
                $totalNewPending += ($deptData['current_pending'] ?? 0) + ($deptData['prev_pending'] ?? 0);
            }

            // Get Combined Saved Data for 'all' (if exists, or sum up)
            $savedAll = [];
            if ($yearMonth) {
                $stmt = $conn->prepare("SELECT * FROM monthly_kpi_reports WHERE years_month = ? AND department = 'all'");
                $stmt->execute([$yearMonth]);
                $savedAll = $stmt->fetch(PDO::FETCH_ASSOC);
            }

            // Re-use logic for Old Work Baseline/Total (Global)
            // ... (Keep existing Old Work Logic for overall baseline if needed, or breakdown)

            // Fetch Global Old Work Data (Keep existing logic for backward compatibility or overview)
            // Count old work (received before 2026-01-01)
            $oldWorkSQL = "
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN (completion_date IS NULL OR completion_date = '0000-00-00') THEN 1 ELSE 0 END) as pending
                FROM (
                    SELECT id, received_date, completion_date FROM survey_works WHERE received_date < ?
                    UNION ALL
                    SELECT id, received_date, completion_date FROM registration_works WHERE received_date < ?
                    UNION ALL
                    SELECT id, received_date, completion_date FROM academic_works WHERE received_date < ?
                ) AS old_work
            ";
            $stmt = $conn->prepare($oldWorkSQL);
            $stmt->execute([$baselineDateCE, $baselineDateCE, $baselineDateCE]);
            $oldWork = $stmt->fetch(PDO::FETCH_ASSOC);

            // Monthly Old Work Completed
            $monthlyOldWorkSQL = "
                SELECT 
                    DATE_FORMAT(completion_date, '%Y-%m') as month,
                    COUNT(*) as completed
                FROM (
                    SELECT completion_date FROM survey_works WHERE received_date < ? AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= ?
                    UNION ALL
                    SELECT completion_date FROM registration_works WHERE received_date < ? AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= ?
                    UNION ALL
                    SELECT completion_date FROM academic_works WHERE received_date < ? AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= ?
                ) AS monthly_completed
                GROUP BY DATE_FORMAT(completion_date, '%Y-%m')
                ORDER BY month ASC
            ";
            $stmt = $conn->prepare($monthlyOldWorkSQL);
            $stmt->execute([$baselineDateCE, $baselineDateCE, $baselineDateCE, $baselineDateCE, $baselineDateCE, $baselineDateCE]);
            $monthlyOldWork = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $baselineCount = $oldWork['total'];

            echo json_encode([
                'status' => 'success',
                'requested_params' => [
                    'years_month' => $yearMonth,
                    'report_type' => $reportType,
                    'startMonth' => $startMonthIdx,
                    'maxMonth' => $maxMonthIdx
                ],
                'savedAll' => $savedAll,
                'breakdown' => $breakdown,
                'trend' => $trend,
                'autoData' => [
                    'oldWork' => [
                        'baseline' => (int) $baselineCount,
                        'total' => (int) $oldWork['total'],
                        'completed' => (int) $oldWork['completed'],
                        'pending' => (int) $oldWork['pending'],
                        'monthlyCompleted' => $monthlyOldWork
                    ],
                    'newWork' => [
                        'pending' => $totalNewPending // Use summed pending
                    ]
                ]
            ]);
            break;

        case 'POST':
        case 'PUT':
            // Save or update KPI report data
            $data = json_decode(file_get_contents('php://input'), true);

            $yearMonth = $data['years_month'] ?? null;
            $department = $data['department'] ?? 'all';

            if (!$yearMonth) {
                http_response_code(400);
                echo json_encode(['error' => 'years_month is required']);
                exit;
            }

            // Define allowable fields for mass assignment
            // Numeric fields that should ADD to existing values
            $numericFields = [
                'new_work_completed',
                'completed_within_30',
                'completed_within_60',
                'completed_over_60'
            ];

            // Fields that should REPLACE existing values
            $replaceFields = [
                'old_work_baseline',
                'new_work_received',
                'notes',
                'created_by'
            ];

            $allFields = array_merge($numericFields, $replaceFields);

            $updateFields = [];
            $insertCols = ['years_month', 'department'];
            $insertPlaceholders = ['?', '?'];
            $params = [$yearMonth, $department];

            foreach ($allFields as $field) {
                if (isset($data[$field])) {
                    $insertCols[] = $field;
                    $insertPlaceholders[] = '?';
                    $params[] = $data[$field];

                    // For all fields, replace the value
                    $updateFields[] = "$field = VALUES($field)";
                }
            }

            if (empty($updateFields)) {
                echo json_encode(['status' => 'success', 'message' => 'No fields to update']);
                exit;
            }

            $sql = "INSERT INTO monthly_kpi_reports (" . implode(', ', $insertCols) . ")
                    VALUES (" . implode(', ', $insertPlaceholders) . ")
                    ON DUPLICATE KEY UPDATE " . implode(', ', $updateFields) . ", updated_at = CURRENT_TIMESTAMP";

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            echo json_encode([
                'status' => 'success',
                'message' => 'บันทึกข้อมูล ABM สำเร็จ'
            ]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>