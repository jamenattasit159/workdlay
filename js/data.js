const DataManager = {

    /**
     * ตรวจสอบว่างานถือว่าเสร็จหรือไม่
     * ใช้ Logic เดียวกันทั้งระบบ - ตรวจสอบจาก completion_date เป็นหลัก
     * @param {Object} item - รายการงาน
     * @returns {boolean} - true ถ้างานเสร็จแล้ว
     */
    isCompleted(item) {
        const cd = item.completion_date;
        // ถ้ามี completion_date ที่ valid ถือว่าเสร็จ
        if (cd && cd !== '0000-00-00' && cd !== '0000-00-00 00:00:00' && cd !== null && cd !== '') {
            return true;
        }
        return false;
    },

    /**
     * ตรวจสอบว่างานยังค้างอยู่หรือไม่
     * @param {Object} item - รายการงาน
     * @returns {boolean} - true ถ้างานยังค้าง
     */
    isPending(item) {
        return !this.isCompleted(item);
    },

    // --- Cache Storage ---
    _cache: {
        lastStats: null,
        lastStatsTime: 0,
        surveyItems: null,
        surveyItemsTime: 0,
        regItems: null,
        regItemsTime: 0,
        acadItems: null,
        acadItemsTime: 0,
        ttl: 30000 // 30 seconds TTL
    },

    async getStats() {
        const now = Date.now();
        // Check cache
        if (this._cache.lastStats && (now - this._cache.lastStatsTime < this._cache.ttl)) {
            console.log('Using cached stats');
            return this._cache.lastStats;
        }

        try {
            const response = await fetch('api/stats.php');
            if (!response.ok) throw new Error('Stats API failed');
            const stats = await response.json();

            // Update cache
            this._cache.lastStats = stats;
            this._cache.lastStatsTime = now;

            return stats;
        } catch (error) {
            console.error('Stats API error, falling back to manual calculation:', error);
            // Fallback to manual calculation if API fails
            return this.getStatsManual();
        }
    },

    async getStatsManual() {
        const [surveyItems, regItems, acadItems] = await Promise.all([
            this.getSurveyItems(),
            this.getRegistrationItems(),
            this.getAcademicItems()
        ]);

        const allItems = [
            ...surveyItems.map(i => ({ ...i, source: 'survey', department: 'ฝ่ายรังวัด' })),
            ...regItems.map(i => ({ ...i, source: 'registration', department: 'ฝ่ายทะเบียน' })),
            ...acadItems.map(i => ({ ...i, source: 'academic', department: 'กลุ่มงานวิชาการ' }))
        ];

        const total = allItems.length;
        // ใช้ helper function isPending() เพื่อให้ Logic ตรงกันทั้งระบบ
        const pending = allItems.filter(i => this.isPending(i)).length;
        // ใช้ helper function isCompleted() เพื่อให้ Logic ตรงกันทั้งระบบ
        const completed = allItems.filter(i => this.isCompleted(i)).length;

        const now = new Date();
        let over30 = 0;
        let over60 = 0;
        let type2 = 0;
        let type3 = 0;
        let type4 = 0;

        allItems.forEach(item => {
            // ใช้ helper function isCompleted() แทน logic เดิม
            if (this.isCompleted(item)) return;

            // Increment progress type counters
            const pType = parseInt(item.progress_type);
            if (pType === 2) type2++;
            else if (pType === 3) type3++;
            else if (pType === 4) type4++;

            const receivedDate = this.getSafeDate(item.received_date);
            if (!receivedDate) return;

            const diffTime = Math.abs(now - receivedDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 60) over60++;
            else if (diffDays > 30) over30++;
        });

        const pendingByDept = {};
        const pendingBreakdown = {};
        allItems.forEach(item => {
            // ใช้ helper function isCompleted() แทน logic เดิม
            if (this.isCompleted(item)) return;

            const dept = item.department;
            pendingByDept[dept] = (pendingByDept[dept] || 0) + 1;

            if (!pendingBreakdown[dept]) {
                pendingBreakdown[dept] = { type2: 0, type3: 0, type4: 0, other: 0 };
            }
            const pType = parseInt(item.progress_type);
            if (pType === 2) pendingBreakdown[dept].type2++;
            else if (pType === 3) pendingBreakdown[dept].type3++;
            else if (pType === 4) pendingBreakdown[dept].type4++;
            else pendingBreakdown[dept].other++;
        });

        // Add monthly reduction KPI (Old Work)
        const oldWorkBaselineDate = new Date('2025-12-31');
        const oldWorkItems = allItems.filter(i => {
            const d = this.getSafeDate(i.received_date);
            return d && d <= oldWorkBaselineDate;
        });
        // ใช้ helper functions เพื่อให้ Logic ตรงกัน
        const oldWorkPending = oldWorkItems.filter(i => this.isPending(i)).length;
        const oldWorkCompleted = oldWorkItems.filter(i => this.isCompleted(i)).length;
        const totalOldWork = oldWorkItems.length;
        const reductionPercent = totalOldWork > 0 ? (oldWorkCompleted / totalOldWork) * 100 : 0;

        // Add New Work KPI (From 2026)
        const newWorkStartDate = new Date('2026-01-01');
        const newWorkItems = allItems.filter(i => {
            const d = this.getSafeDate(i.received_date);
            return d && d >= newWorkStartDate;
        });
        const totalNewWork = newWorkItems.length;

        let completedWithin30 = 0;
        let completedWithin60 = 0;

        newWorkItems.forEach(i => {
            // ใช้ helper function isCompleted() แทน
            if (this.isCompleted(i)) {
                const start = this.getSafeDate(i.received_date);
                const end = this.getSafeDate(i.completion_date);
                if (!start || !end) return;

                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 30) completedWithin30++;
                if (diffDays <= 60) completedWithin60++;
            }
        });

        const kpi30Percent = totalNewWork > 0 ? (completedWithin30 / totalNewWork) * 100 : 0;
        const kpi60Percent = totalNewWork > 0 ? (completedWithin60 / totalNewWork) * 100 : 0;

        return {
            total, pending, completed, over30, over60, type2, type3, type4, pendingByDept, pendingBreakdown,
            kpi: {
                oldWork: { total: totalOldWork, pending: oldWorkPending, completed: oldWorkCompleted, percent: reductionPercent },
                newWork: { total: totalNewWork, within30: kpi30Percent, within60: kpi60Percent }
            }
        };
    },

    // KPI Report with Date Selection
    async getKPIReport(reportDateStr) {
        const [surveyItems, regItems, acadItems] = await Promise.all([
            this.getSurveyItems(),
            this.getRegistrationItems(),
            this.getAcademicItems()
        ]);

        const allItems = [
            ...surveyItems.map(i => ({ ...i, source: 'survey', department: 'ฝ่ายรังวัด' })),
            ...regItems.map(i => ({ ...i, source: 'registration', department: 'ฝ่ายทะเบียน' })),
            ...acadItems.map(i => ({ ...i, source: 'academic', department: 'กลุ่มงานวิชาการ' }))
        ];

        // Parse report date (default to today)
        const reportDate = reportDateStr ? new Date(reportDateStr) : new Date();
        reportDate.setHours(23, 59, 59, 999);

        // Baseline date: 31 Dec 2025 (BE 2568)
        const baselineDate = new Date('2025-12-31');
        baselineDate.setHours(23, 59, 59, 999);

        // New work start date: 1 Jan 2026 (BE 2569)
        const newWorkStartDate = new Date('2026-01-01');
        newWorkStartDate.setHours(0, 0, 0, 0);

        // === OLD WORK CALCULATION ===
        // งานเก่า = งานที่รับก่อนหรือเท่ากับ 31 ธ.ค. 2568
        // รวมงานที่มีวันที่ไม่ถูกต้อง (null, 0000-00-00) หรือวันที่อนาคต (ลงผิด) เข้าไปด้วย
        const oldWorkItems = allItems.filter(i => {
            const d = this.getSafeDate(i.received_date);
            // ถ้าวันที่ไม่ถูกต้อง (null) หรือ วันที่ ≤ baseline หรือ วันที่อนาคต (> reportDate) → นับเป็นงานเก่า
            if (!d) return true; // วันที่ไม่ถูกต้อง → รวมในงานเก่า
            if (d > reportDate) return true; // วันที่อนาคต (ลงผิด) → รวมในงานเก่า
            return d <= baselineDate; // วันที่ปกติ ≤ baseline
        });

        const totalOldWork = oldWorkItems.length;

        // Calculate monthly breakdown with rolling backlog
        const monthlyData = [];
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

        // Start from Jan 2026 (month 0 = Jan, year 2026)
        let currentMonth = new Date('2026-01-01');
        let backlogAtStartOfMonth = totalOldWork; // งานค้างตั้งต้น = baseline
        let totalCompletedSoFar = 0;

        while (currentMonth <= reportDate) {
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);

            // Don't go beyond report date
            const effectiveEnd = monthEnd > reportDate ? reportDate : monthEnd;

            // Get items completed in this month
            const itemsCompletedInMonth = oldWorkItems.filter(i => {
                // ใช้ helper function isCompleted() แทน logic เดิม
                if (!this.isCompleted(i)) return false;
                const cd = this.getSafeDate(i.completion_date);
                if (!cd) return false;

                return cd >= monthStart && cd <= effectiveEnd;
            });

            const completedThisMonth = itemsCompletedInMonth.length;

            // Calculate percentage from backlog at start of this month
            const percentThisMonth = backlogAtStartOfMonth > 0
                ? (completedThisMonth / backlogAtStartOfMonth) * 100
                : 0;

            const monthIndex = currentMonth.getMonth();
            const targetPercent = 5; // เป้าหมาย 5% ต่อเดือน (จากงานค้างต้นเดือน)

            // Update cumulative total
            totalCompletedSoFar += completedThisMonth;

            // Calculate cumulative % from original baseline
            const cumulativePercent = totalOldWork > 0
                ? (totalCompletedSoFar / totalOldWork) * 100
                : 0;

            monthlyData.push({
                month: thaiMonths[monthIndex],
                monthNum: monthIndex + 1,
                year: currentMonth.getFullYear() + 543, // Convert to BE
                yearAD: currentMonth.getFullYear(),
                backlogStart: backlogAtStartOfMonth,    // งานค้างต้นเดือน
                completedThisMonth: completedThisMonth, // เสร็จในเดือน
                totalCompletedCumulative: totalCompletedSoFar, // เสร็จสะสม
                percentThisMonth: percentThisMonth,     // % จากงานค้างต้นเดือน
                cumulativePercent: cumulativePercent,   // % สะสมจาก baseline
                target: targetPercent,                  // เป้าหมาย 5%
                achieved: percentThisMonth >= targetPercent,
                backlogEnd: backlogAtStartOfMonth - completedThisMonth, // งานค้างสิ้นเดือน
                items: itemsCompletedInMonth
            });

            // Update backlog for next month
            backlogAtStartOfMonth = backlogAtStartOfMonth - completedThisMonth;

            // Move to next month
            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }

        // === NEW WORK CALCULATION ===
        // งานใหม่ = งานที่รับตั้งแต่ 1 ม.ค. 2569
        const newWorkItems = allItems.filter(i => {
            const d = this.getSafeDate(i.received_date);
            return d && d >= newWorkStartDate && d <= reportDate;
        });

        const totalNewWork = newWorkItems.length;

        // Completed new work - ใช้ helper function isCompleted() แทน logic เดิม
        const completedNewWork = newWorkItems.filter(i => this.isCompleted(i));

        let within30Days = 0;
        let within60Days = 0;
        let over60Days = 0;

        // Build completed items list with days calculation
        const completedItemsList = [];

        completedNewWork.forEach(i => {
            const start = this.getSafeDate(i.received_date);
            const end = this.getSafeDate(i.completion_date);
            if (!start || !end) return;

            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Add to completed items list with formatted dates
            completedItemsList.push({
                ...i,
                received_date: start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
                completion_date: end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
                daysToComplete: diffDays
            });

            if (diffDays <= 30) {
                within30Days++;
            } else if (diffDays <= 60) {
                within60Days++;
            } else {
                over60Days++;
            }
        });

        const totalCompleted = completedNewWork.length;
        const percent30 = totalCompleted > 0 ? (within30Days / totalCompleted) * 100 : 0;
        const percent60 = totalCompleted > 0 ? (within60Days / totalCompleted) * 100 : 0;

        return {
            reportDate: reportDate.toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
            oldWork: {
                baseline: {
                    date: '31 ธันวาคม 2568',
                    total: totalOldWork
                },
                monthlyProgress: monthlyData,
                summary: {
                    totalCompleted: monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].totalCompletedCumulative : 0,
                    remaining: monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].backlogEnd : totalOldWork,
                    currentPercent: monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].cumulativePercent : 0
                }
            },
            newWork: {
                total: totalNewWork,
                completed: totalCompleted,
                pending: totalNewWork - totalCompleted,
                completedItems: completedItemsList,
                breakdown: {
                    within30Days: within30Days,
                    within60Days: within60Days,
                    over60Days: over60Days
                },
                percentages: {
                    within30: percent30,
                    within60: percent60,
                    target30: 80,
                    target60: 100,
                    achieved30: percent30 >= 80,
                    achieved60: percent60 >= 100
                }
            }
        };
    },

    getSafeDate(dateString) {
        if (!dateString) return null;
        let date = new Date(dateString);
        if (isNaN(date.getTime())) return null;

        let year = date.getFullYear();
        if (year < 100) {
            year += 2000;
            date.setFullYear(year);
        }

        // Handle Buddhist Years (if year > 2200, assume it's BE and subtract 543)
        while (year > 2200) {
            year -= 543;
            date.setFullYear(year);
        }

        return date;
    },

    // --- Survey Department API ---
    surveyApiUrl: 'api/survey.php',

    async getSurveyItems() {
        const now = Date.now();
        if (this._cache.surveyItems && (now - this._cache.surveyItemsTime < this._cache.ttl)) {
            return this._cache.surveyItems;
        }

        try {
            const response = await fetch(this.surveyApiUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            this._cache.surveyItems = data;
            this._cache.surveyItemsTime = now;
            return data;
        } catch (error) {
            console.error('Fetch survey error:', error);
            return [];
        }
    },

    async saveSurveyItem(item) {
        this.clearCache();
        if (window.app?.currentUser) item.user_name = window.app.currentUser.name;
        try {
            const response = await fetch(this.surveyApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            return await response.json();
        } catch (error) {
            console.error('Save survey error:', error);
            alert('บันทึกข้อมูลไม่สำเร็จ');
        }
    },

    async updateSurveyItem(item) {
        this.clearCache();
        if (window.app?.currentUser) item.user_name = window.app.currentUser.name;
        try {
            const response = await fetch(this.surveyApiUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Server responded with ' + response.status);
            }
            return await response.json();
        } catch (error) {
            console.error('Update survey error:', error);
            throw error;
        }
    },

    async deleteSurveyItem(id) {
        this.clearCache();
        const userName = window.app?.currentUser?.name || 'System';
        try {
            await fetch(this.surveyApiUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, user_name: userName })
            });
        } catch (error) {
            console.error('Delete survey error:', error);
        }
    },

    // --- Registration Department API ---
    registrationApiUrl: 'api/registration.php',

    async getRegistrationItems() {
        const now = Date.now();
        if (this._cache.regItems && (now - this._cache.regItemsTime < this._cache.ttl)) {
            return this._cache.regItems;
        }

        try {
            const response = await fetch(this.registrationApiUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            this._cache.regItems = data;
            this._cache.regItemsTime = now;
            return data;
        } catch (error) {
            console.warn('Fetch registration error (using mock data):', error);
            // ... mock data logic ...
            return [
                { id: 1, seq_no: '1', received_date: '2023-02-02', subject: 'ใบแทน', related_person: 'นางสาววันทนา รักดี', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'ส่งช่าง', responsible_person: 'นายจีระเดช ฤทธิรัตน์' },
                { id: 2, seq_no: '2', received_date: '2023-02-27', subject: 'ใบแทน', related_person: 'นางสมนึก ฉุนชื่นจิตร', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นายจีระเดช ฤทธิรัตน์' },
                { id: 3, seq_no: '3', received_date: '2023-05-01', subject: 'ใบแทน', related_person: 'นายเลิศศักดิ์ สุวรรณภาศรี', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นายจีระเดช ฤทธิรัตน์' },
                { id: 4, seq_no: '4', received_date: '2023-06-13', subject: 'ใบแทน', related_person: 'นางสาวปวริศา ศุภสิทธิ์', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'แจ้งผู้ขอ', responsible_person: 'นายทรงพล แสงศร' },
                { id: 5, seq_no: '5', received_date: '2023-06-28', subject: 'ใบแทน', related_person: 'นางสาวอาษา ทองคำ', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นายจีระเดช ฤทธิรัตน์' },
                { id: 6, seq_no: '6', received_date: '2023-08-29', subject: 'ใบแทน', related_person: 'นางน้องหน่อย แจ้งประจักษ์', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นายจีระเดช ฤทธิรัตน์' },
                { id: 7, seq_no: '7', received_date: '2023-11-29', subject: 'ใบแทน', related_person: 'นายสุริยฉัตร ตราชู', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นางสาวนวพร นพรัตน์' },
                { id: 8, seq_no: '8', received_date: '2023-11-29', subject: 'ใบแทน', related_person: 'นายสุริยฉัตร ตราชู', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นางสาวนวพร นพรัตน์' },
                { id: 9, seq_no: '9', received_date: '2024-01-10', subject: 'ใบแทน', related_person: 'นางสาวสุดาทิพย์ มาประดิษฐ์', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นางบังอร ศรีลัง' },
                { id: 10, seq_no: '10', received_date: '2024-03-22', subject: 'ใบแทน', related_person: 'นายศิริ เพ็ชรมณี', summary: 'โฉนดที่ดินสูญหาย', status_cause: 'รอแจก', responsible_person: 'นายทรงพล แสงศร' }
            ];
        }
    },

    async saveRegistrationItem(item) {
        this.clearCache();
        try {
            const response = await fetch(this.registrationApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            return await response.json();
        } catch (error) {
            console.error('Save registration error:', error);
            alert('บันทึกข้อมูลไม่สำเร็จ (Demo Mode)');
        }
    },

    async updateRegistrationItem(item) {
        this.clearCache();
        try {
            const response = await fetch(this.registrationApiUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Server responded with ' + response.status);
            }
            return await response.json();
        } catch (error) {
            console.error('Update registration error:', error);
            throw error;
        }
    },

    async deleteRegistrationItem(id) {
        this.clearCache();
        try {
            await fetch(this.registrationApiUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
        } catch (error) {
            console.error('Delete registration error:', error);
        }
    },

    // --- Academic Department API ---
    academicApiUrl: 'api/academic.php',

    async getAcademicItems() {
        const now = Date.now();
        if (this._cache.acadItems && (now - this._cache.acadItemsTime < this._cache.ttl)) {
            return this._cache.acadItems;
        }

        try {
            const response = await fetch(this.academicApiUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            this._cache.acadItems = data;
            this._cache.acadItemsTime = now;
            return data;
        } catch (error) {
            console.error('Fetch academic error:', error);
            return [];
        }
    },

    async saveAcademicItem(item) {
        this.clearCache();
        try {
            const response = await fetch(this.academicApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            return await response.json();
        } catch (error) {
            console.error('Save academic error:', error);
            throw error;
        }
    },

    async updateAcademicItem(item) {
        this.clearCache();
        try {
            const response = await fetch(this.academicApiUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Server responded with ' + response.status);
            }
            return await response.json();
        } catch (error) {
            console.error('Update academic error:', error);
            throw error;
        }
    },

    async deleteAcademicItem(id) {
        this.clearCache();
        try {
            await fetch(this.academicApiUrl, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
        } catch (error) {
            console.error('Delete academic error:', error);
        }
    },

    clearCache() {
        console.log('Clearing DataManager cache');
        this._cache.lastStats = null;
        this._cache.surveyItems = null;
        this._cache.regItems = null;
        this._cache.acadItems = null;
    }
};

