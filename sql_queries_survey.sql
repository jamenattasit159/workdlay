-- 1. ช่อง "รับใหม่" (New Intake)
-- เกณฑ์: นับตามเดือนของ Survey Date
SELECT DATE_FORMAT(survey_date, '%Y-%m') as month,
    COUNT(DISTINCT id) as intake_count
FROM survey_works
WHERE survey_date >= '2026-01-01'
    AND survey_date BETWEEN '2026-01-01' AND '2026-12-31'
    AND (
        status_cause LIKE '%นัดรังวัด%'
        OR (
            completion_date IS NOT NULL
            AND completion_date != '0000-00-00'
        )
    )
GROUP BY DATE_FORMAT(survey_date, '%Y-%m');
-- 2. & 3. ช่อง "งานเสร็จภายใน 30 วัน" และ "60 วัน"
-- 30 วัน: เดือนที่รับ = เดือนที่เสร็จ (เสร็จในเดือนเดียวกับที่รับ)
-- 60 วัน: เดือนที่รับ ≠ เดือนที่เสร็จ (รับเดือนก่อน มาเสร็จเดือนนี้)
SELECT DATE_FORMAT(completion_date, '%Y-%m') AS month,
    SUM(
        CASE
            WHEN DATE_FORMAT(received_date, '%Y-%m') = DATE_FORMAT(completion_date, '%Y-%m') THEN 1
            ELSE 0
        END
    ) AS comp30,
    SUM(
        CASE
            WHEN DATE_FORMAT(received_date, '%Y-%m') <> DATE_FORMAT(completion_date, '%Y-%m') THEN 1
            ELSE 0
        END
    ) AS comp60
FROM survey_works
WHERE completion_date IS NOT NULL
    AND completion_date != '0000-00-00'
    AND completion_date BETWEEN '2026-01-01' AND '2026-12-31'
    AND received_date >= '2026-01-01'
GROUP BY DATE_FORMAT(completion_date, '%Y-%m')
ORDER BY month;
-- 4. ช่อง "งานคงค้างเดือนนี้" (Pending This Month)
-- คำนวณ: รับใหม่เดือนนี้ - comp30 เดือนนี้
-- (ไม่หัก comp60 เพราะเป็นงานเดือนก่อน ไม่เกี่ยวกับยอดรับใหม่เดือนนี้)
-- Front-end จะสะสม (accumulate) ค่า pending ของแต่ละเดือนเพื่อคำนวณ "รวมทั้งหมด"
-- 5. ช่อง "งานรับเรื่องจากทะเบียน"
-- เกณฑ์: นับตามเดือนของ Received Date
SELECT DATE_FORMAT(received_date, '%Y-%m') as month,
    COUNT(*) as received_count
FROM survey_works
WHERE received_date >= '2026-01-01'
    AND received_date BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY DATE_FORMAT(received_date, '%Y-%m');