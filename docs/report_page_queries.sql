-- ============================================================
-- SQL Queries: report.html
-- Sources: api/abm_report.php, api/abm_details.php
-- ============================================================
-- Tables used:
--   survey_works, registration_works, academic_works,
--   administration_works, monthly_kpi_reports,
--   sameday_completion_logs
-- ============================================================


-- ============================================================
-- FILE: api/abm_report.php  (METHOD: GET)
-- ============================================================

-- Q1: ดึงข้อมูล KPI ที่บันทึกแล้ว ต่อฝ่าย ต่อเดือน
--     (ใน getDepartmentStats function)
SELECT
    SUM(old_work_baseline)     AS old_work_baseline,
    SUM(new_work_received)     AS new_work_received,
    SUM(new_work_completed)    AS new_work_completed,
    SUM(completed_within_30)   AS completed_within_30,
    SUM(completed_within_60)   AS completed_within_60,
    SUM(completed_over_60)     AS completed_over_60,
    SUM(survey_received_from_reg) AS survey_reg,
    MAX(notes)                 AS notes
FROM monthly_kpi_reports
WHERE years_month = :years_month
  AND department  = :department
GROUP BY years_month, department;


-- Q2: สถิติงานใหม่รายเดือน (รับ/เสร็จ/ค้าง) — ต่อตาราง {table}
--     ใช้กับ: survey_works | registration_works | academic_works
--     (เรียกในลูป $tableMap ยกเว้น admin)
SELECT
    DATE_FORMAT(received_date, '%Y-%m') AS month,
    COUNT(*) AS current_received,

    -- comp30: รับและเสร็จภายในเดือนเดียวกัน
    SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00'
                  AND completion_date <= CURDATE()
                  AND DATE_FORMAT(completion_date,'%Y-%m') = DATE_FORMAT(received_date,'%Y-%m')
             THEN 1 ELSE 0 END) AS comp30,

    -- pending: ยังไม่เสร็จภายในเดือนที่รับ
    SUM(CASE WHEN (completion_date IS NULL OR completion_date = '0000-00-00')
                  OR completion_date > CURDATE()
                  OR DATE_FORMAT(completion_date,'%Y-%m') != DATE_FORMAT(received_date,'%Y-%m')
             THEN 1 ELSE 0 END) AS pending,

    -- pending แยกตาม progress_type
    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                    OR completion_date > CURDATE()
                    OR DATE_FORMAT(completion_date,'%Y-%m') != DATE_FORMAT(received_date,'%Y-%m'))
                  AND progress_type = 2 THEN 1 ELSE 0 END) AS pending_type2,

    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                    OR completion_date > CURDATE()
                    OR DATE_FORMAT(completion_date,'%Y-%m') != DATE_FORMAT(received_date,'%Y-%m'))
                  AND progress_type = 3 THEN 1 ELSE 0 END) AS pending_type3,

    SUM(CASE WHEN ((completion_date IS NULL OR completion_date = '0000-00-00')
                    OR completion_date > CURDATE()
                    OR DATE_FORMAT(completion_date,'%Y-%m') != DATE_FORMAT(received_date,'%Y-%m'))
                  AND progress_type = 4 THEN 1 ELSE 0 END) AS pending_type4

FROM {table}  -- survey_works | registration_works | academic_works
WHERE received_date BETWEEN :start_year AND :end_year
GROUP BY DATE_FORMAT(received_date, '%Y-%m')
ORDER BY month;


-- Q3: comp60 ยึดตามเดือนที่เสร็จ (งานเดือนก่อนเสร็จเดือนนี้) — ต่อตาราง
SELECT
    DATE_FORMAT(completion_date, '%Y-%m') AS comp_month,
    COUNT(*) AS comp60
FROM {table}
WHERE received_date BETWEEN :start_year AND :end_year
  AND completion_date IS NOT NULL
  AND completion_date != '0000-00-00'
  AND completion_date <= CURDATE()
  AND DATE_FORMAT(completion_date,'%Y-%m') != DATE_FORMAT(received_date,'%Y-%m')
  AND DATE_FORMAT(completion_date,'%Y-%m') = DATE_FORMAT(DATE_ADD(received_date, INTERVAL 1 MONTH),'%Y-%m')
GROUP BY DATE_FORMAT(completion_date, '%Y-%m');


-- Q4: ดึงข้อมูล KPI ที่บันทึกแล้วทั้งปี (batch pre-fetch)
SELECT
    years_month,
    department,
    SUM(completed_within_30)      AS completed_within_30,
    SUM(completed_within_60)      AS completed_within_60,
    SUM(survey_received_from_reg) AS survey_reg,
    MAX(notes)                    AS notes
FROM monthly_kpi_reports
WHERE years_month LIKE :year_pattern   -- e.g. '2026-%'
  AND department IN ('survey','registration','academic')
GROUP BY years_month, department;


-- Q5: นับงานฝ่ายอำนวยการ (เกิดเสร็จวันเดียว) รายเดือน
SELECT
    DATE_FORMAT(record_date, '%Y-%m') AS month,
    SUM(count)                        AS total
FROM sameday_completion_logs
WHERE department = 'admin'
  AND record_date BETWEEN :start_year AND :end_year
GROUP BY DATE_FORMAT(record_date, '%Y-%m');


-- Q6: นับงานรังวัดที่รับจากทะเบียน รายเดือน (ยึด received_date)
SELECT
    DATE_FORMAT(received_date, '%Y-%m') AS month,
    COUNT(*) AS received_count
FROM survey_works
WHERE received_date >= '2026-01-01'
  AND received_date BETWEEN :start_year AND :end_year
GROUP BY DATE_FORMAT(received_date, '%Y-%m');


-- Q7: นับ Intake ฝ่ายรังวัด (ยึดตาม received_date สำหรับ >= 2026-01-01)
SELECT
    DATE_FORMAT(survey_date, '%Y-%m') AS month,
    COUNT(id)                AS intake_count
FROM survey_works
WHERE received_date >= '2026-01-01'
  AND survey_date BETWEEN :start_year AND :end_year
GROUP BY DATE_FORMAT(survey_date, '%Y-%m');


-- Q8: นับงานรังวัดที่เสร็จ แยก comp30/comp60 ยึดตามเดือนที่เสร็จ
SELECT
    DATE_FORMAT(completion_date, '%Y-%m') AS month,
    SUM(CASE WHEN DATE_FORMAT(received_date,'%Y-%m') =  DATE_FORMAT(completion_date,'%Y-%m') THEN 1 ELSE 0 END) AS comp30,
    SUM(CASE WHEN DATE_FORMAT(received_date,'%Y-%m') <> DATE_FORMAT(completion_date,'%Y-%m') THEN 1 ELSE 0 END) AS comp60
FROM survey_works
WHERE received_date >= '2026-01-01'
  AND completion_date IS NOT NULL
  AND completion_date != '0000-00-00'
  AND completion_date BETWEEN :start_year AND :end_year
GROUP BY DATE_FORMAT(completion_date, '%Y-%m');


-- Q9: งานเก่า (ก่อน 2026-01-01) แยก progress_type และเดือนที่เสร็จ — ต่อตาราง
SELECT
    progress_type,
    DATE_FORMAT(completion_date, '%Y-%m') AS comp_month,
    COUNT(*) AS cnt
FROM {table}
WHERE received_date < '2026-01-01'
GROUP BY progress_type, DATE_FORMAT(completion_date, '%Y-%m');


-- Q10: ดึง KPI 'all' department ที่บันทึกไว้
SELECT *
FROM monthly_kpi_reports
WHERE years_month = :years_month
  AND department  = 'all';


-- Q11: รวมยอดงานเก่าทั้งหมด (Global Old Work — UNION ALL 4 ตาราง)
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN completion_date IS NOT NULL AND completion_date != '0000-00-00'
             THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN completion_date IS NULL OR completion_date = '0000-00-00'
             THEN 1 ELSE 0 END) AS pending
FROM (
    SELECT id, received_date, completion_date FROM survey_works        WHERE received_date < :baseline
    UNION ALL
    SELECT id, received_date, completion_date FROM registration_works  WHERE received_date < :baseline
    UNION ALL
    SELECT id, received_date, completion_date FROM academic_works      WHERE received_date < :baseline
    UNION ALL
    SELECT id, received_date, completion_date FROM administration_works WHERE received_date < :baseline
) AS old_work;


-- Q12: งานเก่าที่เสร็จรายเดือน (Global — UNION ALL 4 ตาราง)
SELECT
    DATE_FORMAT(completion_date, '%Y-%m') AS month,
    COUNT(*) AS completed
FROM (
    SELECT completion_date FROM survey_works
        WHERE received_date < :baseline AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= :baseline
    UNION ALL
    SELECT completion_date FROM registration_works
        WHERE received_date < :baseline AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= :baseline
    UNION ALL
    SELECT completion_date FROM academic_works
        WHERE received_date < :baseline AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= :baseline
    UNION ALL
    SELECT completion_date FROM administration_works
        WHERE received_date < :baseline AND completion_date IS NOT NULL AND completion_date != '0000-00-00' AND completion_date >= :baseline
) AS monthly_completed
GROUP BY DATE_FORMAT(completion_date, '%Y-%m')
ORDER BY month ASC;


-- ============================================================
-- FILE: api/abm_report.php  (METHOD: POST / PUT)
-- ============================================================

-- Q13: บันทึก/อัปเดตข้อมูล KPI รายเดือน (INSERT ... ON DUPLICATE KEY UPDATE)
INSERT INTO monthly_kpi_reports (
    years_month, department,
    -- optional fields (ขึ้นกับว่า client ส่งมาอะไรบ้าง):
    old_work_baseline, new_work_received,
    new_work_completed, completed_within_30,
    completed_within_60, completed_over_60, notes, created_by
)
VALUES (
    :years_month, :department,
    :old_work_baseline, :new_work_received,
    :new_work_completed, :completed_within_30,
    :completed_within_60, :completed_over_60, :notes, :created_by
)
ON DUPLICATE KEY UPDATE
    old_work_baseline    = VALUES(old_work_baseline),
    new_work_received    = VALUES(new_work_received),
    new_work_completed   = VALUES(new_work_completed),
    completed_within_30  = VALUES(completed_within_30),
    completed_within_60  = VALUES(completed_within_60),
    completed_over_60    = VALUES(completed_over_60),
    notes                = VALUES(notes),
    created_by           = VALUES(created_by),
    updated_at           = CURRENT_TIMESTAMP;


-- ============================================================
-- FILE: api/abm_details.php  (METHOD: GET — Drill-down)
-- ============================================================

-- Q14-A: งานค้างสะสม — ฝ่ายรังวัด (type=pending)
SELECT
    id, received_date, survey_date,
    applicant  AS applicant_name,
    survey_type AS work_name,
    status_cause, completion_date, progress_type,
    id AS seq_no
FROM survey_works
WHERE survey_date >= '2026-01-01'
  AND survey_date <= :end_date
  AND (
      status_cause LIKE '%นัดรังวัด%'
      OR (completion_date IS NOT NULL AND completion_date != '0000-00-00')
  )
  AND (
      completion_date IS NULL
      OR completion_date = '0000-00-00'
      OR completion_date > :end_date
  )
ORDER BY survey_date DESC;


-- Q14-B: งานค้าง — ฝ่ายทะเบียน / กลุ่มงานวิชาการ (type=pending)
SELECT
    id, received_date,
    related_person AS applicant_name,
    subject        AS work_name,
    status_cause, completion_date, progress_type, seq_no
FROM {table}  -- registration_works | academic_works
WHERE received_date >= :start_date  -- '2026-01-01'
  AND (completion_date IS NULL OR completion_date = '0000-00-00')
ORDER BY received_date DESC;


-- Q15-A: งานเสร็จภายใน 30 วัน — ฝ่ายรังวัด (type=comp30)
SELECT
    id, received_date, survey_date,
    applicant  AS applicant_name,
    survey_type AS work_name,
    completion_date, progress_type, id AS seq_no
FROM survey_works
WHERE received_date >= :new_work_start  -- '2026-01-01'
  AND completion_date BETWEEN :start_day_month AND :end_date
  AND completion_date IS NOT NULL AND completion_date != '0000-00-00'
ORDER BY completion_date DESC;


-- Q15-B: งานเสร็จภายใน 30 วัน — ฝ่ายทะเบียน / กลุ่มงานวิชาการ (type=comp30)
SELECT
    id, received_date,
    related_person AS applicant_name,
    subject        AS work_name,
    completion_date, progress_type, seq_no
FROM {table}
WHERE received_date BETWEEN :start_day_month AND :end_date
  AND completion_date IS NOT NULL AND completion_date != '0000-00-00'
  AND DATEDIFF(completion_date, received_date) <= 30
ORDER BY received_date DESC;


-- Q16: งานเสร็จภายใน 31-60 วัน (type=comp60) — ทุกฝ่ายยกเว้นรังวัด
SELECT
    id, received_date,
    related_person AS applicant_name,
    subject        AS work_name,
    completion_date, progress_type, seq_no
FROM {table}
WHERE received_date BETWEEN :start_day_month AND :end_date
  AND completion_date IS NOT NULL AND completion_date != '0000-00-00'
  AND DATEDIFF(completion_date, received_date) >  30
  AND DATEDIFF(completion_date, received_date) <= 60
ORDER BY received_date DESC;


-- Q17-A: รายการงานทั้งหมดในเดือน — ฝ่ายรังวัด (type=all)
SELECT
    id, received_date, survey_date,
    applicant  AS applicant_name,
    survey_type AS work_name,
    completion_date, progress_type, id AS seq_no
FROM survey_works
WHERE survey_date BETWEEN :start_date AND :end_date
ORDER BY survey_date DESC;


-- Q17-B: รายการงานทั้งหมดในเดือน — ฝ่ายทะเบียน / กลุ่มงานวิชาการ (type=all)
SELECT
    id, received_date,
    related_person AS applicant_name,
    subject        AS work_name,
    completion_date, progress_type, seq_no
FROM {table}
WHERE received_date BETWEEN :start_day_month AND :end_date
ORDER BY received_date DESC;


-- ============================================================
-- สรุปตารางที่ใช้ในหน้า report.html
-- ============================================================
-- monthly_kpi_reports       : เก็บข้อมูล KPI ที่กรอกมือ (บันทึก/แก้ไขได้)
-- sameday_completion_logs   : งานฝ่ายอำนวยการ (เกิดเสร็จวันเดียว)
-- survey_works              : งานฝ่ายรังวัด
-- registration_works        : งานฝ่ายทะเบียน
-- academic_works            : งานกลุ่มงานวิชาการ
-- administration_works      : งานฝ่ายอำนวยการ
-- ============================================================
