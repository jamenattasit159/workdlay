<?php
/**
 * KPI Details API
 * แสดงรายการงานตามเงื่อนไข KPI (Drill-down)
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

include_once 'db.php';

try {
    $department = $_GET['department'] ?? null;
    $yearMonth = $_GET['year_month'] ?? null; // Format: YYYY-MM
    $type = $_GET['type'] ?? 'pending';

    if (!$department || !$yearMonth) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required parameters']);
        exit;
    }

    $tableMap = [
        'survey' => 'survey_works',
        'registration' => 'registration_works',
        'academic' => 'academic_works'
    ];

    if (!isset($tableMap[$department])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid department']);
        exit;
    }

    $table = $tableMap[$department];

    // Column mapping based on table
    $applicantCol = 'related_person';
    $workNameCol = 'subject';

    if ($department === 'survey') {
        $applicantCol = 'applicant';
        $workNameCol = 'survey_type';
    }

    // Calculate end of the selected month
    $endDate = date('Y-m-t', strtotime($yearMonth . '-01'));
    // The report usually starts from the beginning of the year or a baseline
    // But based on js/report.js logic, it starts from the first month in the trend array (typically Jan)
    $startDate = date('Y-01-01', strtotime($yearMonth . '-01'));

    $sql = "";
    if ($type === 'pending') {
        // Condition for "Pending" as defined in kpi_report.php
        // These are items received up to the end of the clicked month that are currently pending 
        // OR were completed after 60 days
        $sql = "SELECT id, received_date, $applicantCol AS applicant_name, $workNameCol AS work_name, completion_date, progress_type 
                FROM $table 
                WHERE received_date BETWEEN :start_date AND :end_date
                AND (
                    (completion_date IS NULL OR completion_date = '0000-00-00')
                    OR (completion_date > CURDATE())
                    OR (DATEDIFF(completion_date, received_date) > 60)
                )
                ORDER BY received_date DESC";
    } else if ($type === 'comp30') {
        $sql = "SELECT id, received_date, $applicantCol AS applicant_name, $workNameCol AS work_name, completion_date, progress_type 
                FROM $table 
                WHERE received_date BETWEEN :start_day_month AND :end_date
                AND completion_date IS NOT NULL AND completion_date != '0000-00-00'
                AND DATEDIFF(completion_date, received_date) <= 30
                ORDER BY received_date DESC";
        // Override start date for non-cumulative comps if needed, 
        // but currentComp is usually month-specific in the UI.
        $startDayMonth = $yearMonth . '-01';
        $params = ['start_day_month' => $startDayMonth, 'end_date' => $endDate];
    }

    if (!$sql) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        exit;
    }

    $stmt = $conn->prepare($sql);
    if ($type === 'pending') {
        $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
    } else {
        $stmt->execute($params);
    }

    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'count' => count($results),
        'data' => $results,
        'meta' => [
            'department' => $department,
            'year_month' => $yearMonth,
            'type' => $type,
            'start_date' => ($type === 'pending' ? $startDate : $startDayMonth),
            'end_date' => $endDate
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
