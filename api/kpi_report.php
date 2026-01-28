<?php
/**
 * KPI Report API
 * Handles monthly KPI report data for old work and new work tracking
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
            // Get KPI report data
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

                // New Work Stats with accurate DATEDIFF logic
                $sql = "SELECT 
                    -- Intake of Requested Month
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m THEN 1 ELSE 0 END) as current_received,
                    
                    -- (7) Completed within 30 days
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                             AND DATEDIFF(completion_date, received_date) <= 30 THEN 1 ELSE 0 END) as current_completed_30,
                    
                    -- (8) Completed within 60 days (specifically 31-60 as per requirement)
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                             AND DATEDIFF(completion_date, received_date) > 30 
                             AND DATEDIFF(completion_date, received_date) <= 60 THEN 1 ELSE 0 END) as current_completed_60,
                    
                    -- (9) Pending beyond 60 days or still incomplete
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND (completion_date IS NULL OR completion_date = '0000-00-00' 
                                  OR DATEDIFF(completion_date, received_date) > 60) THEN 1 ELSE 0 END) as count_pending,

                    -- Breakdown of Pending (Month's Intake)
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND ((completion_date IS NULL OR completion_date = '0000-00-00' 
                                  OR DATEDIFF(completion_date, received_date) > 60))
                             AND progress_type = 2 THEN 1 ELSE 0 END) as pending_type2,
                             
                    SUM(CASE WHEN received_date BETWEEN :start_m AND :end_m 
                             AND ((completion_date IS NULL OR completion_date = '0000-00-00' 
                                  OR DATEDIFF(completion_date, received_date) > 60))
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
            $requestedYear = $yearMonth ? date('Y', strtotime($yearMonth . '-01')) : date('Y');
            $requestedMonth = $yearMonth ? (int) date('n', strtotime($yearMonth . '-01')) : (int) date('n');
            $currentYear = date('Y');
            $currentMonth = (int) date('n');

            // Determine max month to show
            if ($requestedYear < $currentYear) {
                $maxMonth = 12;
            } elseif ($requestedYear == $currentYear) {
                $maxMonth = max($currentMonth, $requestedMonth);
            } else {
                $maxMonth = $requestedMonth;
            }

            // Pre-fetch all saved manual KPI data for the year in one query (Aggregated)
            $savedDataByMonthDept = [];
            $savedStmt = $conn->prepare("
                SELECT 
                    years_month, 
                    department,
                    SUM(completed_within_30) as completed_within_30,
                    SUM(completed_within_60) as completed_within_60,
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
                // Fix: Add validation that completion_date <= CURDATE() and ensure logical time constraints
                $sql = "SELECT 
                    DATE_FORMAT(received_date, '%Y-%m') as month,
                    COUNT(*) as current_received,
                    SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                             AND completion_date <= CURDATE()
                             AND DATEDIFF(completion_date, received_date) >= 0
                             AND DATEDIFF(completion_date, received_date) <= 30 THEN 1 ELSE 0 END) as comp30,
                    SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00' 
                             AND completion_date <= CURDATE()
                             AND DATEDIFF(CURDATE(), received_date) > 30
                             AND DATEDIFF(completion_date, received_date) > 30 
                             AND DATEDIFF(completion_date, received_date) <= 60 THEN 1 ELSE 0 END) as comp60,
                    SUM(CASE WHEN (completion_date IS NULL OR completion_date = '0000-00-00')
                             OR (completion_date > CURDATE())
                             OR (DATEDIFF(completion_date, received_date) > 60) THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                                 OR (completion_date > CURDATE())
                                 OR (DATEDIFF(completion_date, received_date) > 60))
                             AND progress_type = 2 THEN 1 ELSE 0 END) as pending_type2,
                    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                                 OR (completion_date > CURDATE())
                                 OR (DATEDIFF(completion_date, received_date) > 60))
                             AND progress_type = 4 THEN 1 ELSE 0 END) as pending_type4
                FROM $tableName 
                WHERE received_date BETWEEN ? AND ?
                GROUP BY DATE_FORMAT(received_date, '%Y-%m')
                ORDER BY month";

                $stmt = $conn->prepare($sql);
                $stmt->execute([$startYear, $endYear]);
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $workStatsByMonthDept[$row['month']][$deptKey] = $row;
                }
            }

            // Build trend array efficiently
            for ($m = 1; $m <= $maxMonth; $m++) {
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

                    $monthStats['depts'][$dept] = [
                        'intake' => (int) $workData['current_received'] + $manual30 + $manual60,
                        'comp30' => (int) $workData['comp30'] + $manual30,
                        'comp60' => (int) $workData['comp60'] + $manual60,
                        'pending' => (int) $workData['pending'],
                        'pending_type2' => (int) ($workData['pending_type2'] ?? 0),
                        'pending_type4' => (int) ($workData['pending_type4'] ?? 0),
                        'notes' => $savedData['notes'] ?? ''
                    ];
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
                'savedData' => $savedAll,
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

                    // For numeric fields, ADD to existing value
                    if (in_array($field, $numericFields)) {
                        $updateFields[] = "$field = $field + VALUES($field)";
                    } else {
                        // For text/other fields, REPLACE
                        $updateFields[] = "$field = VALUES($field)";
                    }
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
                'message' => 'บันทึกข้อมูล KPI สำเร็จ'
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