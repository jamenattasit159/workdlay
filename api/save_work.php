<?php
include_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

$type = $_POST['type'] ?? '';
$isCompleted = isset($_POST['is_completed']) && $_POST['is_completed'] === '1';

try {
    if ($type === 'survey') {
        // Survey Work
        // Auto-increment logic
        $year = date('Y') + 543; // Thai Year
        $currentDate = $_POST['received_date'] ?? date('Y-m-d');

        // Find Max ID to increment
        $maxSql = "SELECT MAX(CAST(received_seq AS UNSIGNED)) as max_seq FROM survey_works";
        $maxStmt = $conn->prepare($maxSql);
        $maxStmt->execute();
        $row = $maxStmt->fetch(PDO::FETCH_ASSOC);
        $nextSeq = ($row['max_seq'] ?? 0) + 1;

        // ถ้าเป็นงานเสร็จ ให้ใส่ completion_date และ progress_type
        if ($isCompleted) {
            $sql = "INSERT INTO survey_works 
                    (received_seq, received_date, rw12_no, rw12_date, survey_type, plot_no, applicant, doc_type, doc_no, surveyor, survey_date, status, completion_date, progress_type, created_at, updated_at) 
                    VALUES 
                    (:received_seq, :received_date, :rw12_no, :rw12_date, :survey_type, :plot_no, :applicant, :doc_type, :doc_no, :surveyor, :survey_date, :status, :completion_date, :progress_type, NOW(), NOW())";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':received_seq' => $nextSeq,
                ':received_date' => $_POST['received_date'],
                ':rw12_no' => $_POST['rw12_no'] ?? '',
                ':rw12_date' => $_POST['rw12_date'] ?? null,
                ':survey_type' => $_POST['survey_type'] ?? '',
                ':plot_no' => $_POST['plot_no'] ?? '',
                ':applicant' => $_POST['applicant'],
                ':doc_type' => $_POST['doc_type'] ?? 'โฉนดที่ดิน',
                ':doc_no' => $_POST['doc_no'] ?? '',
                ':surveyor' => $_POST['surveyor'] ?? '',
                ':survey_date' => $_POST['survey_date'] ?? null,
                ':status' => 'เสร็จสิ้น',
                ':completion_date' => $_POST['received_date'], // ใช้วันที่รับเรื่องเป็นวันเสร็จ
                ':progress_type' => $_POST['progress_type'] ?? 1 // ประเภทงานที่เลือกมา (ปกติ/สุดขั้นตอน/ศาล)
            ]);
        } else {
            $sql = "INSERT INTO survey_works 
                    (received_seq, received_date, rw12_no, rw12_date, survey_type, plot_no, applicant, doc_type, doc_no, surveyor, survey_date, status, progress_type, created_at, updated_at) 
                    VALUES 
                    (:received_seq, :received_date, :rw12_no, :rw12_date, :survey_type, :plot_no, :applicant, :doc_type, :doc_no, :surveyor, :survey_date, :status, :progress_type, NOW(), NOW())";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':received_seq' => $nextSeq,
                ':received_date' => $_POST['received_date'],
                ':rw12_no' => $_POST['rw12_no'] ?? '',
                ':rw12_date' => $_POST['rw12_date'] ?? null,
                ':survey_type' => $_POST['survey_type'] ?? '',
                ':plot_no' => $_POST['plot_no'] ?? '',
                ':applicant' => $_POST['applicant'],
                ':doc_type' => $_POST['doc_type'] ?? 'โฉนดที่ดิน',
                ':doc_no' => $_POST['doc_no'] ?? '',
                ':surveyor' => $_POST['surveyor'] ?? '',
                ':survey_date' => $_POST['survey_date'] ?? null,
                ':status' => $_POST['status'] ?? 'pending',
                ':progress_type' => $_POST['progress_type'] ?? null // ส่งค่าประเภทงานมาด้วย (ถ้ามี)
            ]);
        }

    } elseif ($type === 'registration') {
        // Registration Work

        // Auto-increment
        $maxSql = "SELECT MAX(CAST(seq_no AS UNSIGNED)) as max_seq FROM registration_works";
        $maxStmt = $conn->prepare($maxSql);
        $maxStmt->execute();
        $row = $maxStmt->fetch(PDO::FETCH_ASSOC);
        $nextSeq = ($row['max_seq'] ?? 0) + 1;

        if ($isCompleted) {
            $sql = "INSERT INTO registration_works 
                    (seq_no, received_date, subject, related_person, summary, responsible_person, status_cause, completion_date, progress_type, created_at, updated_at) 
                    VALUES 
                    (:seq_no, :received_date, :subject, :related_person, :summary, :responsible_person, :status_cause, :completion_date, :progress_type, NOW(), NOW())";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':seq_no' => $nextSeq,
                ':received_date' => $_POST['received_date'],
                ':subject' => $_POST['subject'],
                ':related_person' => $_POST['related_person'] ?? '',
                ':summary' => $_POST['summary'] ?? '',
                ':responsible_person' => $_POST['responsible_person'] ?? '',
                ':status_cause' => 'เสร็จสิ้น',
                ':completion_date' => $_POST['received_date'], // ใช้วันที่รับเรื่องเป็นวันเสร็จ
                ':progress_type' => $_POST['progress_type'] ?? 1 // ประเภทงานที่เลือกมา (ปกติ/สุดขั้นตอน/ศาล)
            ]);
        } else {
            $sql = "INSERT INTO registration_works 
                    (seq_no, received_date, subject, related_person, summary, responsible_person, status_cause, progress_type, created_at, updated_at) 
                    VALUES 
                    (:seq_no, :received_date, :subject, :related_person, :summary, :responsible_person, :status_cause, :progress_type, NOW(), NOW())";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':seq_no' => $nextSeq,
                ':received_date' => $_POST['received_date'],
                ':subject' => $_POST['subject'],
                ':related_person' => $_POST['related_person'] ?? '',
                ':summary' => $_POST['summary'] ?? '',
                ':responsible_person' => $_POST['responsible_person'] ?? '',
                ':status_cause' => $_POST['status_cause'] ?? 'pending',
                ':progress_type' => $_POST['progress_type'] ?? null
            ]);
        }

    } elseif ($type === 'academic') {
        // Academic Work
        // Auto-increment
        $maxSql = "SELECT MAX(CAST(seq_no AS UNSIGNED)) as max_seq FROM academic_works";
        $maxStmt = $conn->prepare($maxSql);
        $maxStmt->execute();
        $row = $maxStmt->fetch(PDO::FETCH_ASSOC);
        $nextSeq = ($row['max_seq'] ?? 0) + 1;

        if ($isCompleted) {
            $sql = "INSERT INTO academic_works 
                (seq_no, received_date, subject, related_person, summary, responsible_person, status_cause, completion_date, progress_type, created_at, updated_at) 
                VALUES 
                (:seq_no, :received_date, :subject, :related_person, :summary, :responsible_person, :status_cause, :completion_date, :progress_type, NOW(), NOW())";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':seq_no' => $nextSeq,
                ':received_date' => $_POST['received_date'],
                ':subject' => $_POST['subject'],
                ':related_person' => $_POST['related_person'] ?? '',
                ':summary' => $_POST['summary'] ?? '',
                ':responsible_person' => $_POST['responsible_person'] ?? '',
                ':status_cause' => 'เสร็จสิ้น',
                ':completion_date' => $_POST['received_date'], // ใช้วันที่รับเรื่องเป็นวันเสร็จ
                ':progress_type' => $_POST['progress_type'] ?? 1 // ประเภทงานที่เลือกมา (ปกติ/สุดขั้นตอน/ศาล)
            ]);
        } else {
            $sql = "INSERT INTO academic_works 
                (seq_no, received_date, subject, related_person, summary, responsible_person, status_cause, progress_type, created_at, updated_at) 
                VALUES 
                (:seq_no, :received_date, :subject, :related_person, :summary, :responsible_person, :status_cause, :progress_type, NOW(), NOW())";

            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':seq_no' => $nextSeq,
                ':received_date' => $_POST['received_date'],
                ':subject' => $_POST['subject'],
                ':related_person' => $_POST['related_person'] ?? '',
                ':summary' => $_POST['summary'] ?? '',
                ':responsible_person' => $_POST['responsible_person'] ?? '',
                ':status_cause' => $_POST['status_cause'] ?? 'pending',
                ':progress_type' => $_POST['progress_type'] ?? null
            ]);
        }

    } else {
        throw new Exception("Invalid work type: $type");
    }

    echo json_encode(['status' => 'success']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database Error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>