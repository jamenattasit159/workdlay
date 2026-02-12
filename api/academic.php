<?php
include_once 'db.php';
require_once 'utils/lockdown.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        try {
            $sql = "SELECT * FROM academic_works ORDER BY received_date DESC, seq_no DESC";
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

            $sql = "INSERT INTO academic_works (
                seq_no, received_date, subject, related_person, 
                summary, status_cause, responsible_person, completion_date
            ) VALUES (
                :seq_no, :received_date, :subject, :related_person, 
                :summary, :status_cause, :responsible_person, :completion_date
            )";

            $stmt = $conn->prepare($sql);

            $stmt->bindParam(':seq_no', $data->seq_no);
            $stmt->bindParam(':received_date', $data->received_date);
            $stmt->bindParam(':subject', $data->subject);
            $stmt->bindParam(':related_person', $data->related_person);
            $stmt->bindParam(':summary', $data->summary);
            $stmt->bindParam(':status_cause', $data->status_cause);
            $stmt->bindParam(':responsible_person', $data->responsible_person);
            $stmt->bindParam(':completion_date', $data->completion_date);

            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "id" => $conn->lastInsertId()]);
            } else {
                http_response_code(503);
                echo json_encode(["status" => "error", "message" => "Unable to create academic work."]);
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

                if (isset($data->subject)) {
                    // Full Update
                    $sql = "UPDATE academic_works SET 
                            seq_no = :seq_no,
                            received_date = :received_date,
                            subject = :subject,
                            related_person = :related_person,
                            summary = :summary,
                            status_cause = :status_cause,
                            responsible_person = :responsible_person,
                            completion_date = :completion_date
                            WHERE id = :id";

                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(':seq_no', $data->seq_no ?? null);
                    $stmt->bindValue(':received_date', $data->received_date ?? null);
                    $stmt->bindValue(':subject', $data->subject ?? null);
                    $stmt->bindValue(':related_person', $data->related_person ?? null);
                    $stmt->bindValue(':summary', $data->summary ?? null);
                    $stmt->bindValue(':status_cause', $data->status_cause ?? null);
                    $stmt->bindValue(':responsible_person', $data->responsible_person ?? null);
                    $stmt->bindValue(':completion_date', (!empty($data->completion_date)) ? $data->completion_date : null);
                    $stmt->bindValue(':id', $data->id);
                } else if (isset($data->progress_type)) {
                    // Progress Type Update - Block setting TO type 2/3 (only allow removing FROM 2/3)
                    $pType = (int) $data->progress_type;
                    if (in_array($pType, [2, 3])) {
                        http_response_code(403);
                        echo json_encode(["status" => "error", "message" => "ไม่สามารถเปลี่ยนเป็นงานสุดขั้นตอนหรืองานศาลได้ (สามารถลดออกได้เท่านั้น)"]);
                        exit;
                    }
                    $sql = "UPDATE academic_works SET progress_type = :progress_type WHERE id = :id";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(':progress_type', $pType, PDO::PARAM_INT);
                    $stmt->bindValue(':id', $data->id);
                } else {
                    // Partial Update (Status & Completion Date)
                    $sql = "UPDATE academic_works SET 
                            status_cause = :status_cause, 
                            completion_date = :completion_date 
                            WHERE id = :id";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(':status_cause', $data->status_cause ?? null);
                    $stmt->bindValue(':completion_date', (!empty($data->completion_date)) ? $data->completion_date : null);
                    $stmt->bindValue(':id', $data->id);
                }

                if ($stmt->execute()) {
                    echo json_encode(["status" => "success"]);
                } else {
                    http_response_code(503);
                    echo json_encode(["status" => "error", "message" => "Execute failed"]);
                }
            } else {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "ID missing"]);
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
                $sql = "DELETE FROM academic_works WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->bindParam(':id', $data->id);

                if ($stmt->execute()) {
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
?>