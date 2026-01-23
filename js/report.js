/**
 * Report Page Application
 * Separate JavaScript for the KPI Report page to improve performance
 */

window.reportApp = {
    // Cache for loaded data
    cache: {},
    currentYearMonth: null,
    isLoading: false,
    updateDebounceTimer: null,

    /**
     * Initialize the report page
     */
    init() {
        // Initialize AOS animations
        AOS.init({
            duration: 600,
            once: true,
            offset: 50
        });

        // Set current date display
        this.updateDateDisplay();

        // Set default date to current month
        const today = new Date();
        const defaultMonth = today.toISOString().slice(0, 7);
        document.getElementById('kpi-report-month').value = defaultMonth;
        this.currentYearMonth = defaultMonth;

        // Load initial data
        this.loadReport(defaultMonth);
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
     * Update report based on selected month (with debounce)
     */
    updateReport() {
        const monthInput = document.getElementById('kpi-report-month');
        const selectedMonth = monthInput.value;

        if (selectedMonth === this.currentYearMonth && this.cache[selectedMonth]) {
            // Already loaded, just re-render
            this.renderReport(this.cache[selectedMonth]);
            return;
        }

        // Debounce rapid updates
        clearTimeout(this.updateDebounceTimer);
        this.updateDebounceTimer = setTimeout(() => {
            this.currentYearMonth = selectedMonth;
            this.loadReport(selectedMonth);
        }, 300);
    },

    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;
        document.getElementById('loading-skeleton').classList.remove('hidden');
        document.getElementById('report-data').classList.add('hidden');

        // Disable update button
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

        // Enable update button
        const btn = document.getElementById('btn-update');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt mr-1.5"></i> อัปเดตข้อมูล';
        }
    },

    /**
     * Load KPI report data from API
     */
    async loadReport(yearMonth) {
        // Check cache first
        if (this.cache[yearMonth]) {
            this.renderReport(this.cache[yearMonth]);
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`api/kpi_report.php?years_month=${yearMonth}`);
            if (!response.ok) throw new Error('Failed to load report data');

            const data = await response.json();

            // Cache the data
            this.cache[yearMonth] = data;

            // Render report
            this.renderReport(data);
        } catch (error) {
            console.error('Error loading report:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถโหลดข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง',
                confirmButtonColor: '#10b981'
            });
            this.hideLoading();
        }
    },

    /**
     * Render the KPI report
     */
    renderReport(kpiData) {
        const container = document.getElementById('report-data');
        const trend = kpiData.trend || [];
        const depts = [
            { id: 'academic', label: 'ฝ่ายวิชาการ' },
            { id: 'registration', label: 'ฝ่ายทะเบียน' },
            { id: 'survey', label: 'ฝ่ายรังวัด' }
        ];

        // Track running balances
        let deptBalances = { academic: 0, registration: 0, survey: 0 };

        let html = `<div class="space-y-8">`;

        // Header
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 class="text-2xl font-black text-gray-800 tracking-tight">รายงานสรุปผลการดำเนินงาน KPI</h2>
                <p class="text-gray-500 flex items-center mt-1">
                    <i class="fas fa-calendar-alt mr-2 text-blue-500"></i> สรุปผลงานรายเดือน (Action Plan)
                </p>
            </div>`;

        // Iterate months
        trend.forEach((monthItem, index) => {
            const date = new Date(monthItem.month + '-01');
            const monthLabel = date.toLocaleDateString('th-TH', { month: 'long' });
            const isFirstMonth = index === 0;

            let rowHtml = depts.map(dept => {
                const dData = monthItem.depts[dept.id] || { intake: 0, comp30: 0, comp60: 0, pending: 0, notes: '' };
                const intake = dData.intake || 0;
                const comp30 = dData.comp30 || 0;
                const comp60 = dData.comp60 || 0;
                const pendingCurrent = dData.pending || 0;

                const pct30 = intake > 0 ? ((comp30 / intake) * 100).toFixed(2) : "0.00";
                const pct60 = intake > 0 ? ((comp60 / intake) * 100).toFixed(2) : "0.00";

                const prevBal = deptBalances[dept.id];
                const currentBal = prevBal + pendingCurrent;
                deptBalances[dept.id] = currentBal;

                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-3 border font-bold text-gray-700 bg-gray-50/50">${dept.label}</td>
                        <!-- (7) 30 วัน -->
                        <td class="px-3 py-3 border text-center font-bold text-blue-600">${comp30.toLocaleString()}</td>
                        <td class="px-3 py-3 border text-center font-medium text-gray-600">${pct30} %</td>
                        <!-- (8) 60 วัน -->
                        <td class="px-3 py-3 border text-center font-bold text-indigo-600">${comp60.toLocaleString()}</td>
                        <td class="px-3 py-3 border text-center font-medium text-gray-600">${pct60} %</td>
                        <!-- (9) ไม่แล้วเสร็จ -->
                        <!-- (11) งานก่อนหน้า -->
                        <td class="px-3 py-3 border text-center font-bold text-gray-500 bg-gray-50/30">${prevBal.toLocaleString()}</td>
                        <!-- (12) เดือนปัจจุบัน -->
                        <td class="px-3 py-3 border text-center font-black text-orange-600 bg-orange-50/30">${currentBal.toLocaleString()}</td>
                        <!-- หมายเหตุ -->
                        <td class="px-3 py-3 border text-xs text-gray-500 min-w-[150px]">
                            <input type="text" 
                                class="w-full bg-transparent border-none focus:ring-0 text-xs text-gray-600 placeholder-gray-300 p-0" 
                                placeholder="ระบุสาเหตุ..." 
                                value="${dData.notes || ''}" 
                                onchange="reportApp.saveKPINote('${monthItem.month}', '${dept.id}', this.value)">
                        </td>
                    </tr>
                `;
            }).join('');

            html += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div class="bg-gray-100/50 px-6 py-3 border-b border-gray-200">
                        <h4 class="font-black text-gray-800">เดือน${monthLabel} ${isFirstMonth ? '(เดือนเริ่มต้น)' : ''}</h4>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-sm border-collapse">
                            <thead>
                                <!-- Row 1 -->
                                <tr class="bg-blue-100/50 text-gray-800 font-bold">
                                    <th rowspan="3" class="px-4 py-3 border text-center w-32">ฝ่าย</th>
                                    <th colspan="6" class="px-2 py-2 border text-center bg-blue-200/30 font-black">ปริมาณงานเกิดใหม่<sup>(5)</sup> ประจำเดือน</th>
                                    <th rowspan="3" class="px-4 py-3 border text-center w-48">หมายเหตุ</th>
                                </tr>
                                <!-- Row 2 -->
                                <tr class="bg-blue-50/50 text-gray-700 font-bold text-[11px]">
                                    <th colspan="2" class="px-2 py-2 border text-center">งานที่ดำเนินการแล้วเสร็จภายใน 30 วัน <sup>(7)</sup><br><span class="text-blue-600 font-medium">(เป้าหมายไม่น้อยกว่า 80% ตามแผนฯ)</span></th>
                                    <th colspan="2" class="px-2 py-2 border text-center">งานที่ดำเนินการแล้วเสร็จภายใน 60 วัน <sup>(8)</sup><br><span class="text-indigo-600 font-medium">(เป้าหมาย = 100% ตามแผนฯ)</span></th>
                                    <th colspan="2" class="px-2 py-2 border text-center bg-blue-50">งานที่ยังดำเนินการ<br>ไม่แล้วเสร็จ <sup>(9)</sup></th>
                                </tr>
                                <!-- Row 3 -->
                                <tr class="bg-blue-50/30 text-[10px] font-bold text-gray-600">
                                    <th class="px-1 py-2 border text-center w-16">เรื่อง</th>
                                    <th class="px-1 py-2 border text-center w-16">ร้อยละ</th>
                                    <th class="px-1 py-2 border text-center w-16">เรื่อง <sup>(10)</sup></th>
                                    <th class="px-1 py-2 border text-center w-16">ร้อยละ</th>
                                    <th class="px-1 py-2 border text-center w-24 bg-blue-50/50">เดือนก่อนหน้า <sup>(11)</sup></th>
                                    <th class="px-1 py-2 border text-center w-24 bg-blue-50/80">เดือนปัจจุบัน <sup>(12)</sup></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${rowHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
        this.hideLoading();
    },

    /**
     * Save KPI Note
     */
    async saveKPINote(yearMonth, dept, note) {
        try {
            const response = await fetch('api/kpi_report.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    years_month: yearMonth,
                    department: dept,
                    notes: note
                })
            });

            if (!response.ok) throw new Error('Failed to save note');

            // Update cache if exists
            if (this.cache[yearMonth]) {
                const trend = this.cache[yearMonth].trend || [];
                const monthData = trend.find(m => m.month === yearMonth);
                if (monthData && monthData.depts[dept]) {
                    monthData.depts[dept].notes = note;
                }
            }

            // Show subtle success indicator
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'บันทึกหมายเหตุแล้ว',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (error) {
            console.error('Error saving note:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถบันทึกหมายเหตุได้',
                confirmButtonColor: '#10b981'
            });
        }
    },

    /**
     * Export to Excel
     */
    exportToExcel() {
        const yearMonth = this.currentYearMonth;
        const data = this.cache[yearMonth];

        if (!data || !data.trend || data.trend.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีข้อมูล',
                text: 'กรุณาโหลดข้อมูลรายงานก่อนส่งออก',
                confirmButtonColor: '#10b981'
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
            const depts = [
                { id: 'academic', label: 'ฝ่ายวิชาการ' },
                { id: 'registration', label: 'ฝ่ายทะเบียน' },
                { id: 'survey', label: 'ฝ่ายรังวัด' }
            ];

            data.trend.forEach(monthItem => {
                const date = new Date(monthItem.month + '-01');
                const monthLabel = date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

                const rows = [
                    ['รายงานสรุปผลการดำเนินงาน KPI - ' + monthLabel],
                    [],
                    ['ฝ่าย', 'เสร็จภายใน 30 วัน', '%', 'เสร็จภายใน 60 วัน', '%', 'ยังไม่แล้วเสร็จ', '%', 'หมายเหตุ']
                ];

                depts.forEach(dept => {
                    const dData = monthItem.depts[dept.id] || {};
                    const intake = dData.intake || 0;
                    const comp30 = dData.comp30 || 0;
                    const comp60 = dData.comp60 || 0;
                    const pending = dData.pending || 0;

                    rows.push([
                        dept.label,
                        comp30,
                        intake > 0 ? ((comp30 / intake) * 100).toFixed(2) + '%' : '0%',
                        comp60,
                        intake > 0 ? ((comp60 / intake) * 100).toFixed(2) + '%' : '0%',
                        pending,
                        intake > 0 ? ((pending / intake) * 100).toFixed(2) + '%' : '0%',
                        dData.notes || ''
                    ]);
                });

                const ws = XLSX.utils.aoa_to_sheet(rows);
                XLSX.utils.book_append_sheet(wb, ws, monthLabel.slice(0, 31));
            });

            const filename = `KPI_Report_${yearMonth}.xlsx`;
            XLSX.writeFile(wb, filename);

            Swal.fire({
                icon: 'success',
                title: 'ส่งออกสำเร็จ!',
                text: `ไฟล์ ${filename} ถูกดาวน์โหลดแล้ว`,
                confirmButtonColor: '#10b981'
            });
        } catch (error) {
            console.error('Excel export error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถสร้างไฟล์ Excel ได้',
                confirmButtonColor: '#10b981'
            });
        }
    },

    /**
     * Export to PDF using browser print
     */
    exportToPDF() {
        const yearMonth = this.currentYearMonth;
        const data = this.cache[yearMonth];

        if (!data || !data.trend || data.trend.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีข้อมูล',
                text: 'กรุณาโหลดข้อมูลรายงานก่อนส่งออก',
                confirmButtonColor: '#10b981'
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
            // Open print dialog
            const printContent = document.getElementById('report-data').innerHTML;
            const printWindow = window.open('', '_blank');

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>รายงาน KPI - ${yearMonth}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 12px; }
                        th { background: #f3f4f6; font-weight: bold; }
                        h2, h4 { margin: 10px 0; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <h2>รายงานสรุปผลการดำเนินงาน KPI</h2>
                    <p>สำนักงานที่ดินจังหวัดอ่างทอง</p>
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
    reportApp.init();
});
