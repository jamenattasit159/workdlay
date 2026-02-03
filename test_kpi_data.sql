INSERT INTO survey_works (
        applicant,
        survey_type,
        received_date,
        status_cause
    )
VALUES (
        'ทดสอบ งานค้างเก่า 1',
        'รังวัดแบ่งแยก',
        '2025-10-15',
        'รอดำเนินการ'
    ),
    (
        'ทดสอบ งานค้างเก่า 2',
        'รังวัดรวมโฉนด',
        '2025-11-20',
        'รอดำเนินการ'
    ),
    (
        'ทดสอบ งานค้างเก่า 3 (เสร็จแล้ว)',
        'รังวัดสอบเขต',
        '2025-05-10',
        'เสร็จสิ้น'
    );
UPDATE survey_works
SET completion_date = '2026-01-05'
WHERE applicant = 'ทดสอบ งานค้างเก่า 3 (เสร็จแล้ว)';
-- ฝ่ายทะเบียน
INSERT INTO registration_works (
        subject,
        related_person,
        received_date,
        status_cause
    )
VALUES (
        'โอนมรดก',
        'นายสมชาย ใจดี',
        '2025-12-01',
        'รอสอบสวน'
    ),
    (
        'จดทะเบียนจำนอง',
        'นางสาวสมศรี',
        '2025-11-15',
        'รอเอกสาร'
    );
-- 4. เพิ่มข้อมูลทดสอบ "งานเกิดใหม่" (ปี 2569)
-- ฝ่ายรังวัด (รับเดือน ม.ค. 69)
INSERT INTO survey_works (
        applicant,
        survey_type,
        received_date,
        status_cause
    )
VALUES (
        'นายธงชัย (เสร็จใน 30 วัน)',
        'รังวัดแบ่งแยก',
        '2026-01-02',
        'เสร็จสิ้น'
    ),
    (
        'นางมณี (เสร็จใน 30 วัน)',
        'รังวัดสอบเขต',
        '2026-01-05',
        'เสร็จสิ้น'
    ),
    (
        'นายวิชัย (ค้างอยู่)',
        'รังวัดรวมโฉนด',
        '2026-01-10',
        'รอดำเนินการ'
    );
UPDATE survey_works
SET completion_date = '2026-01-15'
WHERE applicant IN (
        'นายธงชัย (เสร็จใน 30 วัน)',
        'นางมณี (เสร็จใน 30 วัน)'
    );
-- ฝ่ายทะเบียน (รับเดือน ม.ค. 69)
INSERT INTO registration_works (
        subject,
        related_person,
        received_date,
        status_cause
    )
VALUES ('ขอใบแทน', 'นายสมนึก', '2026-01-05', 'เสร็จสิ้น'),
    ('แก้ชื่อ', 'นางวิภา', '2026-01-07', 'ส่งทะเบียน'),
    (
        'ตรวจหลักฐาน',
        'บริษัท กขค',
        '2026-01-15',
        'ปกติ'
    );
UPDATE registration_works
SET completion_date = '2026-01-10'
WHERE subject = 'ขอใบแทน';
UPDATE registration_works
SET completion_date = '2026-01-12'
WHERE subject = 'แก้ชื่อ';
-- 5. เพิ่มข้อมูล "งานเกิดเสร็จวันเดียว" (ผ่านตาราง KPI)
-- สมมติเดือน ม.ค. 2569
INSERT INTO monthly_kpi_reports (
        years_month,
        department,
        new_work_completed,
        completed_within_30,
        created_by
    )
VALUES ('2026-01', 'registration', 5, 5, 'System Test'),
    -- ฝ่ายทะเบียนมีงานเสร็จวันเดียว 5 เรื่อง
    ('2026-01', 'survey', 2, 2, 'System Test');
-- ฝ่ายรังวัดมีงานเสร็จวันเดียว 2 เรื่อง