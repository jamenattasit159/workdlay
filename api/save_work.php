<?php
include_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed']);
    exit;
}

$type = $_POST['type'] ?? '';

try {
    if ($type === 'survey') {
        // Survey Work
        // Auto-increment logic
        $year = date('Y') + 543; // Thai Year
        $currentDate = $_POST['received_date'] ?? date('Y-m-d');
        
        // Find Max ID to increment (Simplistic approach, preferably would filter by year if table structure supported it clearly)
        // Since original seq was user input, we'll try to find the max received_seq and add 1
        // Note: received_seq is likely a VARCHAR, need to be careful.
        // If it's pure number, we can cast. If it has "/" (e.g. 1/2569), we need to parse.
        // Assuming simple integer for now as per user request "sequence from base".

        $maxSql = "SELECT MAX(CAST(received_seq AS UNSIGNED)) as max_seq FROM survey_works";
        $maxStmt = $conn->prepare($maxSql);
        $maxStmt->execute();
        $row = $maxStmt->fetch(PDO::FETCH_ASSOC);
        $nextSeq = ($row['max_seq'] ?? 0) + 1;


        $sql = "INSERT INTO survey_works 
                (received_seq, received_date, rw12_no, rw12_date, survey_type, plot_no, applicant, doc_type, doc_no, surveyor, survey_date, status, created_at, updated_at) 
                VALUES 
                (:received_seq, :received_date, :rw12_no, :rw12_date, :survey_type, :plot_no, :applicant, :doc_type, :doc_no, :surveyor, :survey_date, :status, NOW(), NOW())";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':received_seq' => $nextSeq,
            ':received_date' => $_POST['received_date'],
            ':rw12_no' => $_POST['rw12_no'],
            ':rw12_date' => $_POST['rw12_date'],
            ':survey_type' => $_POST['survey_type'],
            ':plot_no' => $_POST['plot_no'],
            ':applicant' => $_POST['applicant'],
            ':doc_type' => $_POST['doc_type'],
            ':doc_no' => $_POST['doc_no'],
            ':surveyor' => $_POST['surveyor'],
            ':survey_date' => $_POST['survey_date'],
            ':status' => $_POST['status'] ?? 'pending' 
        ]);

    } elseif ($type === 'registration') {
        // Registration Work
        
        // Auto-increment
         $maxSql = "SELECT MAX(CAST(seq_no AS UNSIGNED)) as max_seq FROM registration_works";
         $maxStmt = $conn->prepare($maxSql);
         $maxStmt->execute();
         $row = $maxStmt->fetch(PDO::FETCH_ASSOC);
         $nextSeq = ($row['max_seq'] ?? 0) + 1;

        $sql = "INSERT INTO registration_works 
                (seq_no, received_date, subject, related_person, summary, responsible_person, status_cause, created_at, updated_at) 
                VALUES 
                (:seq_no, :received_date, :subject, :related_person, :summary, :responsible_person, :status_cause, NOW(), NOW())";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':seq_no' => $nextSeq,
            ':received_date' => $_POST['received_date'],
            ':subject' => $_POST['subject'],
            ':related_person' => $_POST['related_person'],
            ':summary' => $_POST['summary'],
            ':responsible_person' => $_POST['responsible_person'],
            ':status_cause' => $_POST['status_cause'] ?? 'pending'
        ]);

    } elseif ($type === 'academic') {
        // Academic Work
         // Auto-increment
         $maxSql = "SELECT MAX(CAST(seq_no AS UNSIGNED)) as max_seq FROM academic_works";
         $maxStmt = $conn->prepare($maxSql);
         $maxStmt->execute();
         $row = $maxStmt->fetch(PDO::FETCH_ASSOC);
         $nextSeq = ($row['max_seq'] ?? 0) + 1;

        $sql = "INSERT INTO academic_works 
            (seq_no, received_date, subject, related_person, summary, responsible_person, status_cause, created_at, updated_at) 
            VALUES 
            (:seq_no, :received_date, :subject, :related_person, :summary, :responsible_person, :status_cause, NOW(), NOW())";
    
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            ':seq_no' => $nextSeq,
            ':received_date' => $_POST['received_date'],
            ':subject' => $_POST['subject'],
            ':related_person' => $_POST['related_person'],
            ':summary' => $_POST['summary'],
            ':responsible_person' => $_POST['responsible_person'],
            ':status_cause' => $_POST['status_cause'] ?? 'pending'
        ]);

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
