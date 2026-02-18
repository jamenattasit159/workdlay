<?php
include_once 'db.php';
require_once 'utils/logger.php';
require_once 'utils/lockdown.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        try {
            // Cache control - allow browser to cache for 30 seconds
            header('Cache-Control: private, max-age=30');
            $sql = "SELECT id, received_seq, received_date, survey_type, applicant,  summary, 
                           status_cause, completion_date, men, rv_12, survey_date, progress_type, created_at 
                    FROM survey_works ORDER BY created_at DESC";
            $stmt = $conn->prepare($sql);
            $stmt->execute();
            $works = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($works);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
        }
        break;

    case 'POST':
        try {
            $data = json_decode(file_get_contents("php://input"));

            $sql = "INSERT INTO survey_works (
                received_seq, received_date, survey_type, applicant, summary, status_cause, men, rv_12, survey_date
            ) VALUES (
                :received_seq, :received_date, :survey_type, :applicant, :summary, :status_cause, :men, :rv_12, :survey_date
            )";

            $stmt = $conn->prepare($sql);

            $stmt->bindValue(':received_seq', $data->received_seq ?? null);
            $stmt->bindValue(':received_date', $data->received_date ?? null);
            $stmt->bindValue(':survey_type', $data->survey_type ?? null);
            $stmt->bindValue(':applicant', $data->applicant ?? null);
            $stmt->bindValue(':summary', $data->summary ?? null);
            $stmt->bindValue(':status_cause', $data->status_cause ?? 'pending');
            $stmt->bindValue(':men', $data->men ?? '');
            $stmt->bindValue(':rv_12', $data->rv_12 ?? null);
            $stmt->bindValue(':survey_date', (!empty($data->survey_date)) ? $data->survey_date : null);

            if ($stmt->execute()) {
                logAction('ADD', $data);
                echo json_encode(["status" => "success", "id" => $conn->lastInsertId()]);
            } else {
                http_response_code(503);
                echo json_encode(["status" => "error", "message" => "Unable to create survey work."]);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
        }
        break;

    case 'PUT':
        try {
            $data = json_decode(file_get_contents("php://input"));

            if (!empty($data->id)) {
                // Lockdown Check
                if (!empty($data->completion_date) && isLockdownActive($data->completion_date)) {
                    http_response_code(403);
                    echo json_encode(["status" => "error", "message" => "ระบบล็อคการบันทึกงานย้อนหลังเดือนก่อนหน้าแล้ว"]);
                    exit;
                }

                if (isset($data->applicant)) {
                    // Full Update
                    $sql = "UPDATE survey_works SET 
                            received_seq = :received_seq,
                            received_date = :received_date,
                            survey_type = :survey_type,
                            applicant = :applicant,
                            summary = :summary,
                            completion_date = :completion_date,
                            status_cause = :status_cause,
                            men = :men,
                            rv_12 = :rv_12,
                            survey_date = :survey_date
                            WHERE id = :id";

                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(':received_seq', $data->received_seq ?? null);
                    $stmt->bindValue(':received_date', $data->received_date ?? null);
                    $stmt->bindValue(':survey_type', $data->survey_type ?? null);
                    $stmt->bindValue(':applicant', $data->applicant ?? null);
                    $stmt->bindValue(':summary', $data->summary ?? null);
                    $stmt->bindValue(':completion_date', (!empty($data->completion_date)) ? $data->completion_date : null);
                    $stmt->bindValue(':status_cause', $data->status_cause ?? null);
                    $stmt->bindValue(':men', $data->men ?? null);
                    $stmt->bindValue(':rv_12', $data->rv_12 ?? null);
                    $stmt->bindValue(':survey_date', (!empty($data->survey_date)) ? $data->survey_date : null);
                    $stmt->bindValue(':id', $data->id);

                } else if (isset($data->status_cause) || isset($data->status) || isset($data->rv_12) || isset($data->survey_date)) {
                    // Status, Completion Date, RV_12 & Survey Date Update
                    $statusValue = $data->status_cause ?? $data->status ?? null;
                    $sql = "UPDATE survey_works 
                            SET status_cause = :status_cause, 
                                completion_date = :completion_date,
                                rv_12 = :rv_12,
                                survey_date = :survey_date
                            WHERE id = :id";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(':status_cause', $statusValue);
                    $stmt->bindValue(':completion_date', (!empty($data->completion_date)) ? $data->completion_date : null);
                    $stmt->bindValue(':rv_12', $data->rv_12 ?? null);
                    $stmt->bindValue(':survey_date', (!empty($data->survey_date)) ? $data->survey_date : null);
                    $stmt->bindValue(':id', $data->id);
                } else if (isset($data->progress_type)) {
                    // Progress Type Update - Block setting TO type 2/3 (only allow removing FROM 2/3)
                    $pType = (int) $data->progress_type;
                    if (in_array($pType, [2, 3])) {
                        http_response_code(403);
                        echo json_encode(["status" => "error", "message" => "ไม่สามารถเปลี่ยนเป็นงานสุดขั้นตอนหรืองานศาลได้ (สามารถลดออกได้เท่านั้น)"]);
                        exit;
                    }
                    $sql = "UPDATE survey_works SET progress_type = :progress_type WHERE id = :id";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(':progress_type', $pType, PDO::PARAM_INT);
                    $stmt->bindValue(':id', $data->id);
                }

                if (isset($stmt) && $stmt->execute()) {
                    logAction('UPDATE', $data);
                    echo json_encode(["status" => "success"]);
                } else {
                    http_response_code(503);
                    echo json_encode(["status" => "error", "message" => "Execute failed or no fields to update"]);
                }
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        try {
            $data = json_decode(file_get_contents("php://input"));

            if (!empty($data->id)) {
                $sql = "DELETE FROM survey_works WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->bindParam(':id', $data->id);

                if ($stmt->execute()) {
                    logAction('DELETE', $data);
                    echo json_encode(["status" => "success"]);
                } else {
                    http_response_code(503);
                    echo json_encode(["status" => "error"]);
                }
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Method not allowed"]);
        break;
}

// Helper function for logging
function logAction($action, $data)
{
    // require_once 'utils/logger.php'; // Moved to the top of the file
    $userName = $data->user_name ?? 'System';
    $itemId = $data->id ?? $data->received_seq ?? null;
    $details = "";

    if ($action === 'ADD') {
        $details = "เพิ่มงานรังวัดใหม่: " . ($data->applicant ?? 'N/A');
    } elseif ($action === 'UPDATE') {
        if (isset($data->status_cause)) {
            $details = "อัปเดตสถานะงานรังวัด (ID: $itemId) เป็น: " . $data->status_cause;
        } else {
            $details = "แก้ไขข้อมูลงานรังวัด (ID: $itemId)";
        }
    } elseif ($action === 'DELETE') {
        $details = "ลบงานรังวัด (ID: $itemId)";
    }

    Logger::log($userName, $action, 'survey', $itemId, $details);
}

// Call logging after successful Switch operations if needed, 
// but it's cleaner to call inside the switch. 
// Refactoring to call inside switch instead for better control.
?>