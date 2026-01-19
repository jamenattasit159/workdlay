<?php
include_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // ดึงข้อมูลทั้งหมด
        $sql = "SELECT * FROM tasks ORDER BY received_date DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($tasks);
        break;

    case 'POST':
        // บันทึกงานใหม่
        $data = json_decode(file_get_contents("php://input"));
        
        if (!empty($data->department) && !empty($data->receivedDate) && !empty($data->subject)) {
            $sql = "INSERT INTO tasks (department, received_date, subject, details, responsible_person, status) VALUES (:dept, :rdate, :subj, :details, :resp, 'pending')";
            $stmt = $conn->prepare($sql);
            
            $stmt->bindParam(':dept', $data->department);
            $stmt->bindParam(':rdate', $data->receivedDate);
            $stmt->bindParam(':subj', $data->subject);
            $stmt->bindParam(':details', $data->details);
            $stmt->bindParam(':resp', $data->responsiblePerson); // ชื่อฟิลด์ใหม่ (camelCase รับจาก JS -> งูใน DB)
            
            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "id" => $conn->lastInsertId()]);
            } else {
                http_response_code(503);
                echo json_encode(["status" => "error", "message" => "Unable to create task."]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Incomplete data."]);
        }
        break;

    case 'PUT':
        // อัปเดตงาน (ใช้สำหรับเปลี่ยนสถานะ หรือ แก้ไขข้อมูลทั้งหมด)
        $data = json_decode(file_get_contents("php://input"));
        
        if (!empty($data->id)) {
            if (isset($data->subject)) {
                // Full Update (Edit)
                $sql = "UPDATE tasks SET 
                        department = :dept,
                        received_date = :rdate,
                        subject = :subj,
                        details = :details,
                        responsible_person = :resp
                        WHERE id = :id";
                        
                $stmt = $conn->prepare($sql);
                $stmt->bindParam(':dept', $data->department);
                $stmt->bindParam(':rdate', $data->receivedDate);
                $stmt->bindParam(':subj', $data->subject);
                $stmt->bindParam(':details', $data->details);
                $stmt->bindParam(':resp', $data->responsiblePerson);
                $stmt->bindParam(':id', $data->id);
                
            } else if (!empty($data->status)) {
                // Status Update only
                $sql = "UPDATE tasks SET status = :status WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->bindParam(':status', $data->status);
                $stmt->bindParam(':id', $data->id);
            }
            
            if ($stmt->execute()) {
                echo json_encode(["status" => "success"]);
            } else {
                http_response_code(503);
                echo json_encode(["status" => "error"]);
            }
        }
        break;

    case 'DELETE':
        // ลบงาน
        $data = json_decode(file_get_contents("php://input"));
        
        if (!empty($data->id)) {
            $sql = "DELETE FROM tasks WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':id', $data->id);
            
            if ($stmt->execute()) {
                echo json_encode(["status" => "success"]);
            } else {
                http_response_code(503);
                echo json_encode(["status" => "error"]);
            }
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Method not allowed"]);
        break;
}
?>
