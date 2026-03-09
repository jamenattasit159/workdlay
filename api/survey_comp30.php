<?php
/**
 * API: ฝ่ายรังวัด — งานเสร็จภายใน 30 วัน (comp30)
 * เงื่อนไข: survey_date และ completion_date อยู่ในเดือนเดียวกัน
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS')
    exit(0);

include_once 'db.php';

try {
    // รับ param
    $yearMonth = $_GET['year_month'] ?? null; // รูปแบบ YYYY-MM (ค้นทั้งเดือน)
    $startDate = $_GET['start_date'] ?? null; // รูปแบบ YYYY-MM-DD (ค้นช่วงวัน)
    $endDate = $_GET['end_date'] ?? null;
    $search = $_GET['search'] ?? null; // ค้นหาชื่อผู้ขอ

    // กำหนดช่วงวันที่จาก year_month หรือ start/end date
    if ($yearMonth) {
        $start = $yearMonth . '-01';
        $end = date('Y-m-t', strtotime($start));
    } elseif ($startDate && $endDate) {
        $start = $startDate;
        $end = $endDate;
    } else {
        // Default: เดือนปัจจุบัน
        $start = date('Y-m-01');
        $end = date('Y-m-t');
    }

    $params = ['start' => $start, 'end' => $end];

    $sql = "SELECT
                id,
                received_date,
                survey_date,
                applicant       AS applicant_name,
                survey_type     AS work_name,
                completion_date,
                DATEDIFF(completion_date, survey_date) AS days_used,
                progress_type,
                status_cause
            FROM survey_works
            WHERE received_date >= '2026-01-01'
              AND survey_date IS NOT NULL
              AND survey_date != '0000-00-00'
              AND completion_date IS NOT NULL
              AND completion_date != '0000-00-00'
              AND completion_date BETWEEN :start AND :end
              AND DATE_FORMAT(survey_date, '%Y-%m') = DATE_FORMAT(completion_date, '%Y-%m')";

    // ค้นหาชื่อถ้ามี
    if ($search) {
        $sql .= " AND applicant LIKE :search";
        $params['search'] = '%' . $search . '%';
    }

    $sql .= " ORDER BY completion_date DESC";

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'success',
        'period' => ['start' => $start, 'end' => $end],
        'total' => count($rows),
        'data' => $rows
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>