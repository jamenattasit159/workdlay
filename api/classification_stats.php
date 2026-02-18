<?php
header('Content-Type: application/json; charset=utf-8');
include_once 'db.php';

if (php_sapi_name() === 'cli') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
}

try {
    $yearMonth = $_GET['year_month'] ?? date('Y-m');
    $startOfMonth = $yearMonth . '-01';
    $endOfMonth = date('Y-m-t', strtotime($startOfMonth));

    $results = [
        'survey' => [],
        'registration' => [],
        'academic' => [],
        'meta' => [
            'period' => $yearMonth,
            'generated_at' => date('Y-m-d H:i:s')
        ]
    ];

    // 1. Survey Classification (Using Survey Date for Intake as per logic_survey_department)
    $sqlSurvey = "SELECT 
        CASE 
            WHEN survey_type LIKE '%ออกโฉนด%' THEN '1. งานออกโฉนดที่ดินเฉพาะราย'
            WHEN survey_type LIKE '%แบ่ง%' OR survey_type LIKE '%สอบเขต%' OR survey_type LIKE '%รวมโฉนด%' THEN '2. งานแบ่งแยก/สอบเขต/รวมโฉนด'
            ELSE '3. งาน นสล./อื่นๆ'
        END as category,
        COUNT(DISTINCT id) as count
    FROM survey_works
    WHERE survey_date BETWEEN :start AND :end
    AND (
        status_cause LIKE '%นัดรังวัด%'
        OR (completion_date IS NOT NULL AND completion_date != '0000-00-00')
    )
    GROUP BY category
    ORDER BY category ASC";

    $stmt = $conn->prepare($sqlSurvey);
    $stmt->execute(['start' => $startOfMonth, 'end' => $endOfMonth]);
    $results['survey'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Registration Classification
    $sqlReg = "SELECT 
        CASE 
            WHEN subject LIKE '%สอบเขต%' OR subject LIKE '%แบ่ง%' OR subject LIKE '%รวมโฉนด%' THEN 'งานแบ่งแยก/สอบเขต/รวมโฉนด'
            WHEN subject LIKE '%มรดก%' OR summary LIKE '%มรดก%' THEN 'งานมรดก'
            WHEN subject LIKE '%โรงเรือน%' OR summary LIKE '%โรงเรือน%' THEN 'งานเกี่ยวกับโรงเรือน'
            WHEN subject LIKE '%ออกโฉนด%' OR subject LIKE '%ใบแทน%' THEN 'งานออกโฉนดและใบแทน'
            ELSE 'งานอื่นๆ'
        END as category,
        COUNT(*) as count
    FROM registration_works
    WHERE received_date BETWEEN :start AND :end
    GROUP BY category
    ORDER BY count DESC";

    $stmt = $conn->prepare($sqlReg);
    $stmt->execute(['start' => $startOfMonth, 'end' => $endOfMonth]);
    $results['registration'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Academic Classification
    $sqlAcademic = "SELECT 
        CASE 
            WHEN subject LIKE '%เพิกถอน%' OR subject LIKE '%แก้ไข%' THEN '1. งานเพิกถอน/แก้ไข'
            WHEN subject LIKE '%ขอใช้%' OR subject LIKE '%ถอนสภาพ%' THEN '2. งานขอใช้/ขอถอนสภาพ'
            WHEN subject LIKE '%มาตรา 84%' OR subject LIKE '%ม.84%' THEN '3. ขอได้มาซึ่งที่ดินตามมาตรา 84'
            WHEN subject LIKE '%ร้องเรียน%' OR subject LIKE '%ร้องทุกข์%' THEN '4. งานร้องเรียน/ร้องทุกข์'
            ELSE '5. งานอื่น ๆ'
        END as category,
        COUNT(*) as count
    FROM academic_works
    WHERE received_date BETWEEN :start AND :end
    GROUP BY category
    ORDER BY category ASC";

    $stmt = $conn->prepare($sqlAcademic);
    $stmt->execute(['start' => $startOfMonth, 'end' => $endOfMonth]);
    $results['academic'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>