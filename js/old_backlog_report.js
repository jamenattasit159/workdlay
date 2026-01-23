/**
 * Old Work Backlog Report Application
 * รายงานงานค้างเก่า (ตั้งแต่ 31 ธ.ค. 2568 ลงไป)
 */

window.backlogApp = {
    // Cache for loaded data
    cache: {},
    currentYear: null,
    isLoading: false,

    /**
     * Initialize the report page
     */
    init() {
        // Permission check
        const user = JSON.parse(localStorage.getItem('dol_user'));
        if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
            window.location.href = 'index.html';
            return;
        }

        // Initialize AOS animations
        AOS.init({
            duration: 600,
            once: true,
            offset: 50
        });

        // Set current date display
        this.updateDateDisplay();

        // Set default year (2026 = พ.ศ. 2569)
        const today = new Date();
        const defaultYear = today.getFullYear();
        document.getElementById('report-year').value = defaultYear;
        this.currentYear = defaultYear;

        // Load initial data
        this.loadReport(defaultYear);
    },

    /**
     * Update the date display in header
     */
    updateDateDisplay() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const now = new Date();
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            dateEl.textContent = now.toLocaleDateString('th-TH', options);
        }
    },

    /**
     * Update report based on selected year
     */
    updateReport() {
        const yearSelect = document.getElementById('report-year');
        const selectedYear = yearSelect.value;

        if (selectedYear === this.currentYear && this.cache[selectedYear]) {
            this.renderReport(this.cache[selectedYear]);
            return;
        }

        this.currentYear = selectedYear;
        this.loadReport(selectedYear);
    },

    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;
        document.getElementById('loading-skeleton').classList.remove('hidden');
        document.getElementById('report-data').classList.add('hidden');

        const btn = document.getElementById('btn-update');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> กำลังโหลด...';
        }
    },

    /**
     * Hide loading state
     */
    hideLoading() {
        this.isLoading = false;
        document.getElementById('loading-skeleton').classList.add('hidden');
        document.getElementById('report-data').classList.remove('hidden');

        const btn = document.getElementById('btn-update');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt mr-1.5"></i> อัปเดตข้อมูล';
        }
    },

    /**
     * Load report data from API
     */
    async loadReport(year) {
        if (this.cache[year]) {
            this.renderReport(this.cache[year]);
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`api/old_work_backlog.php?year=${year}`);
            if (!response.ok) throw new Error('Failed to load report data');

            const data = await response.json();

            // Cache the data
            this.cache[year] = data;

            // Update total old work display
            document.getElementById('total-old-work').textContent =
                (data.total_old_work || 0).toLocaleString();

            // Render report
            this.renderReport(data);
        } catch (error) {
            console.error('Error loading report:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถโหลดข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง',
                confirmButtonColor: '#f97316'
            });
            this.hideLoading();
        }
    },

    /**
     * Render the backlog report
     */
    renderReport(data) {
        const container = document.getElementById('report-data');
        const months = data.months || [];

        let html = '';

        // Iterate through months
        months.forEach((monthItem, index) => {
            const depts = Object.values(monthItem.departments || {});

            // Skip months with no data
            const hasData = depts.some(d => d.backlog_total > 0 || d.structure_work > 0);
            if (!hasData && index > 2) return; // Show at least first 3 months

            html += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden month-block">
                    <div class="month-header px-6 py-3">
                        <h4 class="font-black text-lg flex items-center">
                            <i class="fas fa-calendar-day mr-2"></i>
                            ${monthItem.month_label}
                        </h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="report-table">
                            <thead>
                                <tr>
                                    <th rowspan="2" class="w-12">ลำดับ</th>
                                    <th rowspan="2" class="min-w-[200px]">ภารกิจตามโครงสร้าง<br>อำนาจหน้าที่<sup>(1)</sup></th>
                                    <th rowspan="2" class="w-20">งานสุดขั้นตอน<sup>(2)</sup></th>
                                    <th rowspan="2" class="w-20">งานศาล<sup>(3)</sup></th>
                                    <th colspan="4" class="bg-amber-200/50">งานค้าง (เป้าหมาย 5% ตามแผนฯ)</th>
                                </tr>
                                <tr>
                                    <th class="w-20 bg-amber-100/50">จำนวน<sup>(4)</sup></th>
                                    <th colspan="2" class="bg-amber-100/50">ดำเนินการแล้วเสร็จ<br><span class="text-xs font-normal">(เรื่อง / ร้อยละ)</span></th>
                                    <th class="w-20 bg-amber-100/50">คงเหลือ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderDepartmentRows(depts)}
                                <tr class="bg-orange-50 font-bold">
                                    <td colspan="2" class="text-right">รวม</td>
                                    <td>${this.sumField(depts, 'final_step').toLocaleString()}</td>
                                    <td>${this.sumField(depts, 'court_work').toLocaleString()}</td>
                                    <td>${this.sumField(depts, 'backlog_total').toLocaleString()}</td>
                                    <td>${this.sumField(depts, 'completed_count').toLocaleString()}</td>
                                    <td>${this.calcAvgPercentage(depts)}%</td>
                                    <td class="text-red-600">${this.sumField(depts, 'remaining').toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="signature-line px-6 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                        <i class="fas fa-user-check mr-1"></i> การตรวจสอบและยืนยันจาก............................ เจ้าพนักงานที่ดิน
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.hideLoading();
    },

    /**
     * Render department rows
     */
    renderDepartmentRows(depts) {
        let html = '';
        let index = 1;

        // Sort by order
        depts.sort((a, b) => a.order - b.order);

        depts.forEach(dept => {
            const pct = dept.completed_percentage || 0;
            const pctClass = pct >= 80 ? 'text-green-600' : (pct >= 50 ? 'text-yellow-600' : 'text-red-600');

            html += `
                <tr>
                    <td>${index++}</td>
                    <td class="text-left font-medium">${dept.name}</td>
                    <td>${dept.final_step.toLocaleString()}</td>
                    <td>${dept.court_work.toLocaleString()}</td>
                    <td class="font-bold text-orange-700">${dept.backlog_total.toLocaleString()}</td>
                    <td class="font-bold text-blue-600">${dept.completed_count.toLocaleString()}</td>
                    <td class="${pctClass} font-bold">${pct}%</td>
                    <td class="font-bold ${dept.remaining > 0 ? 'text-red-600' : 'text-green-600'}">
                        ${dept.remaining.toLocaleString()}
                    </td>
                </tr>
            `;
        });

        return html;
    },

    /**
     * Sum a field across departments
     */
    sumField(depts, field) {
        return depts.reduce((sum, d) => sum + (d[field] || 0), 0);
    },

    /**
     * Calculate average percentage
     */
    calcAvgPercentage(depts) {
        const totalBacklog = this.sumField(depts, 'backlog_total');
        const totalCompleted = this.sumField(depts, 'completed_count');
        if (totalBacklog === 0) return 0;
        return ((totalCompleted / totalBacklog) * 100).toFixed(1);
    },

    /**
     * Export to Excel
     */
    exportToExcel() {
        const year = this.currentYear;
        const data = this.cache[year];

        if (!data || !data.months || data.months.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีข้อมูล',
                text: 'กรุณาโหลดข้อมูลรายงานก่อนส่งออก',
                confirmButtonColor: '#f97316'
            });
            return;
        }

        Swal.fire({
            title: 'กำลังสร้างไฟล์ Excel...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const wb = XLSX.utils.book_new();

            data.months.forEach(monthItem => {
                const depts = Object.values(monthItem.departments || {});
                if (depts.length === 0) return;

                const rows = [
                    [`รายงานงานค้างเก่า - ${monthItem.month_label}`],
                    [],
                    ['ลำดับ', 'ภารกิจตามโครงสร้างอำนาจหน้าที่', 'งานสุดขั้นตอน', 'งานศาล',
                        'งานค้าง จำนวน', 'แล้วเสร็จ เรื่อง', 'แล้วเสร็จ %', 'คงเหลือ']
                ];

                let index = 1;
                depts.sort((a, b) => a.order - b.order);
                depts.forEach(dept => {
                    rows.push([
                        index++,
                        dept.name,
                        dept.final_step,
                        dept.court_work,
                        dept.backlog_total,
                        dept.completed_count,
                        dept.completed_percentage + '%',
                        dept.remaining
                    ]);
                });

                // Total row
                rows.push([
                    '', 'รวม',
                    this.sumField(depts, 'final_step'),
                    this.sumField(depts, 'court_work'),
                    this.sumField(depts, 'backlog_total'),
                    this.sumField(depts, 'completed_count'),
                    this.calcAvgPercentage(depts) + '%',
                    this.sumField(depts, 'remaining')
                ]);

                const ws = XLSX.utils.aoa_to_sheet(rows);
                const sheetName = monthItem.month_label.slice(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            const filename = `OldBacklog_Report_${year}.xlsx`;
            XLSX.writeFile(wb, filename);

            Swal.fire({
                icon: 'success',
                title: 'ส่งออกสำเร็จ!',
                text: `ไฟล์ ${filename} ถูกดาวน์โหลดแล้ว`,
                confirmButtonColor: '#f97316'
            });
        } catch (error) {
            console.error('Excel export error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถสร้างไฟล์ Excel ได้',
                confirmButtonColor: '#f97316'
            });
        }
    },

    /**
     * Export to PDF using browser print
     */
    exportToPDF() {
        const year = this.currentYear;
        const data = this.cache[year];

        if (!data || !data.months || data.months.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีข้อมูล',
                text: 'กรุณาโหลดข้อมูลรายงานก่อนส่งออก',
                confirmButtonColor: '#f97316'
            });
            return;
        }

        Swal.fire({
            title: 'กำลังเตรียม PDF...',
            text: 'กรุณารอสักครู่ หน้าต่างพิมพ์จะเปิดขึ้น',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        setTimeout(() => {
            const printContent = document.getElementById('report-data').innerHTML;
            const printWindow = window.open('', '_blank');

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>รายงานงานค้างเก่า - ${year}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 5px; margin: 0; }
                        table { border-collapse: collapse; width: 100%; margin-bottom: 3px; }
                        th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; font-size: 11px; }
                        th { background: #fef3c7; font-weight: bold; }
                        h2 { margin: 0 0 3px 0; font-size: 14px; }
                        p { margin: 0 0 8px 0; font-size: 12px; }
                        h4 { margin: 5px 0; font-size: 12px; }
                        .month-header { background: #f97316; color: white; padding: 5px 10px; margin-bottom: 3px; font-size: 13px; }
                        .month-block { page-break-inside: avoid; margin-bottom: 10px; border: 1px solid #ddd; }
                        .signature-line { page-break-before: avoid; margin-top: 0; padding: 3px 10px; font-size: 11px; background: #f9f9f9; border-top: 1px solid #ddd; }
                        @media print { 
                            body { padding: 5px; }
                            .month-block { page-break-inside: avoid; }
                            .signature-line { page-break-before: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <h2>รายงานงานค้างเก่า สำนักงานที่ดินจังหวัดอ่างทอง</h2>
                    <p>ยอดยกมา ณ วันที่ 31 ธ.ค. 68 จำนวน ${data.total_old_work.toLocaleString()} เรื่อง</p>
                    ${printContent}
                </body>
                </html>
            `);

            printWindow.document.close();
            printWindow.onload = () => {
                Swal.close();
                printWindow.print();
            };
        }, 500);
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    backlogApp.init();
});
