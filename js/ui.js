window.UI = {
    // Debounced AOS refresh - prevents multiple rapid calls
    _aosRefreshTimer: null,
    refreshAOS() {
        if (typeof AOS === 'undefined') return;
        clearTimeout(this._aosRefreshTimer);
        this._aosRefreshTimer = setTimeout(() => AOS.refresh(), 150);
    },

    //Progress Type Labels
    progressTypeLabels: {
        1: { name: 'งานปกติ', icon: 'fa-circle', color: 'gray' },
        2: { name: 'งานสุดขั้นตอน', icon: 'fa-flag-checkered', color: 'purple' },
        3: { name: 'งานศาล', icon: 'fa-gavel', color: 'red' },
        4: { name: 'งานค้าง', icon: 'fa-clock', color: 'orange' }
    },

    thaiMonths: [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ],

    //DataTables Thai Language Config
    dataTableThaiLang: {
        search: "ค้นหา:",
        lengthMenu: "แสดง _MENU_ รายการ",
        info: "แสดง _START_ ถึง _END_ จาก _TOTAL_ รายการ",
        infoEmpty: "ไม่มีข้อมูล",
        infoFiltered: "(กรองจาก _MAX_ รายการทั้งหมด)",
        zeroRecords: "ไม่พบข้อมูลที่ค้นหา",
        emptyTable: "ไม่มีข้อมูลในตาราง",
        paginate: {
            first: "หน้าแรก",
            last: "หน้าสุดท้าย",
            previous: "ก่อนหน้า",
            next: "ถัดไป"
        }
    },

    //DataTable instances tracker
    dataTableInstances: {},

    //Initialize DataTable with proper cleanup
    initDataTable(tableId, options = {}) {
        const tableSelector = '#' + tableId;

        //Check if table exists
        if (!document.getElementById(tableId)) {
            console.warn('DataTable: Table not found:', tableId);
            return null;
        }

        try {
            //Destroy existing instance if any
            if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable(tableSelector)) {
                $(tableSelector).DataTable().clear().destroy();
                //Remove DataTable wrapper elements
                const wrapper = document.getElementById(tableId + '_wrapper');
                if (wrapper) {
                    const table = document.getElementById(tableId);
                    if (table && wrapper.parentNode) {
                        wrapper.parentNode.insertBefore(table, wrapper);
                        wrapper.remove();
                    }
                }
            }

            //Remove tracking
            if (this.dataTableInstances[tableId]) {
                delete this.dataTableInstances[tableId];
            }

            const defaultOptions = {
                language: this.dataTableThaiLang,
                responsive: true,
                pageLength: 20,
                lengthMenu: [[10, 20, 50, 100, -1], [10, 20, 50, 100, "ทั้งหมด"]],
                order: [[1, 'desc']],
                columnDefs: [
                    { orderable: false, targets: -1 }
                ],
                dom: '<"flex flex-wrap justify-between items-center mb-4"<"flex items-center"l><"flex items-center"f>>rtip',
                drawCallback: function () {
                    //Refresh AOS after draw (debounced)
                    UI.refreshAOS();
                },
                //Disable state saving to prevent conflicts
                stateSave: false,
                //Destroy on re-init
                destroy: true
            };

            const dt = $(tableSelector).DataTable({ ...defaultOptions, ...options });
            this.dataTableInstances[tableId] = dt;
            return dt;
        } catch (error) {
            console.error('DataTable init error:', error);
            return null;
        }
    },

    //Destroy a specific DataTable
    destroyDataTable(tableId) {
        const tableSelector = '#' + tableId;
        try {
            if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable(tableSelector)) {
                $(tableSelector).DataTable().clear().destroy();
            }
            if (this.dataTableInstances[tableId]) {
                delete this.dataTableInstances[tableId];
            }
        } catch (error) {
            console.error('DataTable destroy error:', error);
        }
    },

    //Render Progress Type Checkboxes
    renderProgressTypeCheckboxes(currentType, itemId, workType, receivedDate = null) {
        const types = [
            { id: 2, label: 'งานสุดขั้นตอน', icon: 'fa-flag-checkered', color: 'purple', desc: 'อยู่ในขั้นตอนสุดท้าย' },
            { id: 3, label: 'งานศาล', icon: 'fa-gavel', color: 'red', desc: 'รอคำสั่งศาล/ดำเนินการทางกฎหมาย' },
            { id: 4, label: 'งานค้าง', icon: 'fa-clock', color: 'orange', desc: 'งานเก่าสะสม' }
        ];

        const assignMode = DataManager.systemSettings?.progress_type_assign || 'restricted';
        const canAssignType23 = (assignMode === 'allowed');

        const badgeHtml = canAssignType23
            ? `<span class="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold"><i class="fas fa-unlock-alt mr-1"></i>เพิ่มได้ทุกหมวด</span>`
            : `<span class="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">สุดขั้นตอน/งานศาล: ลดออกได้เท่านั้น</span>`;

        return `
            <div class="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="font-extrabold text-slate-800 mb-3 flex items-center text-sm">
                    <i class="fas fa-tags mr-2 text-slate-600"></i> หมวดหมู่ความคืบหน้า
                    ${badgeHtml}
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    ${types.map(t => {
            const isType23 = (t.id === 2 || t.id === 3);
            const isCurrentlyThis = (currentType == t.id);
            // ถ้า allowed: ติ๊กได้ทุกอัน / ถ้า restricted: type2/3 disabled เว้นแต่ checked อยู่แล้ว
            const disabled = isType23 && !canAssignType23 && !isCurrentlyThis;
            return `
                        <label class="relative flex items-start p-3 rounded-xl transition-all duration-200 
                            ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-100 border border-gray-200' :
                    (isCurrentlyThis ? `bg-${t.color}-100 border-2 border-${t.color}-400 shadow-md cursor-pointer` : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow cursor-pointer')}">
                            <input type="checkbox" 
                                id="progress-type-${t.id}"
                                ${isCurrentlyThis ? 'checked' : ''} 
                                ${disabled ? 'disabled' : ''}
                                onchange="app.updateProgressType('${itemId}', '${workType}', ${t.id}, this.checked)"
                                class="h-5 w-5 rounded border-gray-300 text-${t.color}-600 focus:ring-${t.color}-500 mt-0.5 ${disabled ? 'cursor-not-allowed' : ''}">
                            <div class="ml-3">
                                <div class="flex items-center">
                                    <i class="fas ${t.icon} text-${t.color}-500 mr-2 text-sm"></i>
                                    <span class="font-bold text-sm text-gray-800">${t.label}</span>
                                </div>
                                <p class="text-xs text-gray-500 mt-0.5">${disabled ? 'ไม่สามารถเพิ่มเข้าหมวดนี้ได้' : (isType23 && isCurrentlyThis ? 'คลิกเพื่อยกเลิกหมวดนี้' : t.desc)}</p>
                            </div>
                            ${isCurrentlyThis ? `<span class="absolute top-1 right-1 w-3 h-3 bg-${t.color}-500 rounded-full animate-pulse"></span>` : ''}
                        </label>
                    `}).join('')}
                </div>
            </div>
        `;
    },

    //Render Status History Section (Initially Loading)
    renderHistorySection(itemId, workType) {
        return `
            <div class="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200 shadow-sm mt-4" id="history-section">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-extrabold text-amber-900 flex items-center text-sm">
                        <i class="fas fa-history mr-2 text-amber-600"></i> ประวัติการดำเนินงาน
                    </h4>
                    <button onclick="app.showAddHistoryModal('${itemId}', '${workType}')" 
                        class="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold hover:from-amber-600 hover:to-orange-600 transition shadow-md flex items-center">
                        <i class="fas fa-plus mr-1"></i> เพิ่มประวัติ
                    </button>
                </div>
                <div id="history-list" class="space-y-2 max-h-48 overflow-y-auto">
                    <div class="text-center py-4">
                        <i class="fas fa-spinner fa-spin text-amber-500 text-xl"></i>
                        <p class="text-sm text-amber-600 mt-2">กำลังโหลดประวัติ...</p>
                    </div>
                </div>
            </div>
        `;
    },

    //Format History Item
    formatHistoryItem(h) {
        const actionColors = {
            'อัปเดตสถานะ': 'blue',
            'เปลี่ยนหมวดหมู่': 'purple',
            'เพิ่มหมายเหตุ': 'green',
            'ทำเครื่องหมายเสร็จ': 'emerald',
            'default': 'gray'
        };
        const color = actionColors[h.action_type] || actionColors['default'];
        const date = new Date(h.changed_at);
        const thaiDate = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
        const time = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex items-start gap-3 p-3 bg-white rounded-xl border border-amber-100 shadow-sm hover:shadow transition group relative">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-${color}-100 flex items-center justify-center">
                    <i class="fas fa-check-circle text-${color}-500"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 bg-${color}-100 text-${color}-700 rounded-full text-xs font-bold">${h.action_type}</span>
                        <span class="text-xs text-gray-400">${thaiDate} ${time}</span>
                    </div>
                    ${h.note ? `<p class="text-sm text-gray-700 mt-1 font-medium">${h.note}</p>` : ''}
                    ${h.old_value && h.new_value ? `
                        <div class="mt-1 text-xs">
                            <span class="text-gray-400 line-through">${h.old_value}</span>
                            <i class="fas fa-arrow-right mx-1 text-gray-300"></i>
                            <span class="text-${color}-600 font-medium">${h.new_value}</span>
                        </div>
                    ` : ''}
                    ${h.changed_by ? `<p class="text-xs text-gray-400 mt-1"><i class="fas fa-user mr-1"></i>${h.changed_by}</p>` : ''}
                </div>
                <!-- Edit/Delete Buttons - Show on hover -->
                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="app.editHistory(${h.id}, decodeURIComponent('${encodeURIComponent(h.action_type || '')}'), decodeURIComponent('${encodeURIComponent(h.note || '')}'), '${h.work_type}', ${h.work_id})" 
                        class="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-colors" title="แก้ไข">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button onclick="app.deleteHistory(${h.id}, '${h.work_type}', ${h.work_id})" 
                        class="w-7 h-7 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-colors" title="ลบ">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    },

    //Render Empty History
    renderEmptyHistory() {
        return `
            <div class="text-center py-6">
                <div class="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-3">
                    <i class="fas fa-inbox text-amber-400 text-2xl"></i>
                </div>
                <p class="text-sm text-amber-600 font-medium">ยังไม่มีประวัติการดำเนินงาน</p>
                <p class="text-xs text-gray-400 mt-1">คลิก "เพิ่มประวัติ" เพื่อบันทึกความคืบหน้า</p>
            </div>
        `;
    },


    handleTableScroll(element, tableType) {
        const container = element.closest('.table-scroll-container');
        const scrollHint = container?.querySelector('.scroll-indicator');

        //Calculate if scrolled beyond threshold
        const scrollLeft = element.scrollLeft;
        const scrollWidth = element.scrollWidth;
        const clientWidth = element.clientWidth;
        const isScrolledStart = scrollLeft > 50;
        const isScrolledEnd = (scrollLeft + clientWidth) >= (scrollWidth - 20);

        //Hide scroll indicator once user starts scrolling
        if (scrollHint && isScrolledStart) {
            scrollHint.style.display = 'none';
        }

        //Toggle shadow based on scroll position
        if (container) {
            if (isScrolledEnd) {
                container.classList.add('scrolled-end');
            } else {
                container.classList.remove('scrolled-end');
            }
        }
    },

    // Components
    async renderDashboard(userDept = 'all') {
        let stats, surveyItems, registrationItems, academicItems;

        if (userDept === 'all') {
            // Fetch all data in parallel for overview dashboard
            [stats, surveyItems, registrationItems, academicItems] = await Promise.all([
                DataManager.getStats(),
                DataManager.getSurveyItems(),
                DataManager.getRegistrationItems(),
                DataManager.getAcademicItems()
            ]);
        } else {
            // Single department: only fetch stats + that department's data (2 calls instead of 4)
            const deptFetch = userDept === 'survey' ? DataManager.getSurveyItems()
                : userDept === 'registration' ? DataManager.getRegistrationItems()
                    : DataManager.getAcademicItems();
            const [fetchedStats, deptItems] = await Promise.all([DataManager.getStats(), deptFetch]);
            stats = fetchedStats;
            surveyItems = userDept === 'survey' ? deptItems : [];
            registrationItems = userDept === 'registration' ? deptItems : [];
            academicItems = userDept === 'academic' ? deptItems : [];
        }

        //Filter stats based on user department
        if (userDept !== 'all') {
            let filteredItems = [];
            let deptLabel = '';
            if (userDept === 'survey') {
                filteredItems = surveyItems;
                deptLabel = 'ฝ่ายรังวัด';
            } else if (userDept === 'registration') {
                filteredItems = registrationItems;
                deptLabel = 'ฝ่ายทะเบียน';
            } else if (userDept === 'academic') {
                filteredItems = academicItems;
                deptLabel = 'กลุ่มงานวิชาการ';
            }

            //Recalculate stats for this department only
            const pendingItems = filteredItems.filter(i => DataManager.isPending(i));
            const completedItems = filteredItems.filter(i => DataManager.isCompleted(i));

            const today = new Date();
            const over30 = pendingItems.filter(i => {
                const rd = this.getSafeDate(i.received_date);
                if (!rd) return false;
                const days = Math.floor((today - rd) / (1000 * 60 * 60 * 24));
                return days > 30 && days <= 60;
            }).length;

            const over60 = pendingItems.filter(i => {
                const rd = this.getSafeDate(i.received_date);
                if (!rd) return false;
                return Math.floor((today - rd) / (1000 * 60 * 60 * 24)) > 60;
            }).length;

            // For single department, we use pendingByDept to show Progress Type breakdown
            const pendingBreakdown = {};
            const pBreakdown = { type2: 0, type3: 0, type4: 0, other: 0 };

            pendingItems.forEach(item => {
                const pType = parseInt(item.progress_type);
                if (pType === 2) pBreakdown.type2++;
                else if (pType === 3) pBreakdown.type3++;
                else if (pType === 4) pBreakdown.type4++;
                else pBreakdown.other++;
            });
            pendingBreakdown[deptLabel] = pBreakdown;

            stats = {
                total: filteredItems.length,
                completed: completedItems.length,
                pending: pendingItems.length,
                over30: over30,
                over60: over60,
                pendingByDept: {
                    'งานสุดขั้นตอน': pBreakdown.type2,
                    'งานศาล': pBreakdown.type3,
                    'งานค้าง (สะสม)': pBreakdown.type4,
                    'งานปกติ/อื่นๆ': pBreakdown.other
                },
                type2: pBreakdown.type2,
                type3: pBreakdown.type3,
                type4: pBreakdown.type4,
                pendingBreakdown: pendingBreakdown,
                isSingleDept: true,
                deptLabel: deptLabel
            };
        }

        // Dashboard (Ultimate SaaS Premium Look)
        const completionRate = Math.round((stats.completed / (stats.total || 1)) * 100);
        const userName = window.app?.currentUser?.name || window.app?.currentUser?.username || 'ผู้ใช้งาน';

        // Department Selection Menu definition
        const deptsMenu = [
            { id: 'all', label: 'ภาพรวมทั้งหมด', icon: 'fa-th-large', color: 'bg-emerald-500', text: 'text-emerald-600', hover: 'hover:bg-emerald-50', navigate: 'dashboard' },
            { id: 'survey', label: 'ฝ่ายรังวัด', icon: 'fa-vector-square', color: 'bg-indigo-500', text: 'text-indigo-600', hover: 'hover:bg-indigo-50', navigate: 'survey_dashboard' },
            { id: 'registration', label: 'ฝ่ายทะเบียน', icon: 'fa-file-invoice', color: 'bg-blue-500', text: 'text-blue-600', hover: 'hover:bg-blue-50', navigate: 'registration_dashboard' },
            { id: 'academic', label: 'ฝ่ายวิชาการ', icon: 'fa-book-reader', color: 'bg-orange-500', text: 'text-orange-600', hover: 'hover:bg-orange-50', navigate: 'academic_dashboard' }
        ];

        const deptSelectorHtml = `
            <div class="flex flex-wrap gap-2 mb-8 bg-white/40 p-1.5 rounded-2xl border border-white/60 backdrop-blur-sm inline-flex shadow-sm" data-aos="fade-right">
                ${deptsMenu.map(d => {
            const isActive = userDept === d.id;
            return `
                        <button onclick="app.navigate('${d.navigate}')" 
                            class="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${isActive
                    ? `${d.color} text-white shadow-lg`
                    : `${d.text} ${d.hover} opacity-70 hover:opacity-100`}">
                            <i class="fas ${d.icon} ${isActive ? 'text-white' : ''}"></i>
                            ${d.label}
                        </button>
                    `;
        }).join('')}
            </div>
        `;

        return `
            <!-- Department Selector -->
            ${deptSelectorHtml}

            <!-- Dashboard Header & Greeting -->
            <div class="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6" data-aos="fade-down">
                <div>
                    <h2 class="text-4xl font-black text-gray-800 tracking-tight">
                        สวัสดีคุณ <span class="text-gradient-indigo">${userName}</span> 👋
                    </h2>
                    <p class="text-gray-500 mt-2 font-medium flex items-center">
                        <i class="fas fa-calendar-day mr-2 text-indigo-500"></i>
                        ยินดีต้อนรับสู่ระบบบริหารงานที่ดิน — <span class="ml-1 text-gray-700">${new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </p>
                </div>
                <!-- Mini Stats Hero Widget -->
                <div class="glass-premium rounded-3xl p-1 pr-6 flex items-center shadow-2xl shadow-indigo-100 border border-indigo-50/50">
                    <div class="relative w-20 h-20">
                        <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(99, 102, 241, 0.1)" stroke-width="3" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#blue-grad)" stroke-width="3" stroke-dasharray="${completionRate}, 100" class="animate-progress" />
                            <defs>
                                <linearGradient id="blue-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#4338ca;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-sm font-black text-indigo-600">${completionRate}%</span>
                        </div>
                    </div>
                    <div class="ml-3">
                        <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">ความสำเร็จ</div>
                        <div class="text-xl font-black text-gray-800">${stats.completed}/${stats.total}</div>
                    </div>
                </div>
            </div>

            ${userDept === 'survey' ? `
            <div class="mb-10 flex flex-wrap gap-3" data-aos="fade-up">
                <a href="survey_classification_dashboard.html"
                    class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
                    <i class="fas fa-table-columns"></i>
                    รายงานคัดแยกฝ่ายรังวัด
                </a>
            </div>
            ` : ''}

            <!-- Primary Metric Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
                <!-- Total Task -->
                <div class="glass-premium card-hover rounded-3xl p-6 relative overflow-hidden group" data-aos="fade-up" data-aos-delay="0">
                    <div class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl gradient-indigo flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <i class="fas fa-layer-group text-lg"></i>
                        </div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">จำนวนงานทั้งหมด</div>
                    </div>
                    <div class="text-4xl font-black text-gray-800 tracking-tight">${stats.total}</div>
                    <div class="mt-2 text-xs text-gray-500 flex items-center">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
                        รายการรวมทุกสถานะ
                    </div>
                </div>

                <!-- Completed Tasks -->
                <div class="glass-premium card-hover rounded-3xl p-6 relative overflow-hidden group" data-aos="fade-up" data-aos-delay="100">
                    <div class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl gradient-emerald flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                            <i class="fas fa-check-double text-lg"></i>
                        </div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ดำเนินการแล้วเสร็จ</div>
                    </div>
                    <div class="text-4xl font-black text-gray-800 tracking-tight">${stats.completed}</div>
                    <div class="mt-2 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                        <i class="fas fa-chart-line mr-1"></i> ${completionRate}% เสร็จสิ้น
                    </div>
                </div>

                <!-- Over 30 Days -->
                <div class="glass-premium card-hover rounded-3xl p-6 relative overflow-hidden group" data-aos="fade-up" data-aos-delay="200">
                    <div class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl gradient-amber flex items-center justify-center text-white shadow-lg shadow-amber-100">
                            <i class="fas fa-hourglass-start text-lg"></i>
                        </div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ค้าง 31 - 60 วัน</div>
                    </div>
                    <div class="text-4xl font-black text-gray-800 tracking-tight">${stats.over30}</div>
                    <div class="mt-2 text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full inline-block">
                        🚨 งานที่ควรเร่งรัด
                    </div>
                </div>

                <!-- Over 60 Days -->
                <div class="glass-premium card-hover rounded-3xl p-6 relative overflow-hidden group" data-aos="fade-up" data-aos-delay="300">
                    <div class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl gradient-rose flex items-center justify-center text-white shadow-lg shadow-rose-100">
                            <i class="fas fa-fire-flame-curved text-lg"></i>
                        </div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ค้างเกิน 60 วัน</div>
                    </div>
                    <div class="text-4xl font-black text-rose-600 tracking-tight">${stats.over60}</div>
                    <div class="mt-2 text-xs text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full inline-block animate-pulse">
                        ⚠️ ติดตามอย่างใกล้ชิด
                    </div>
                </div>

                <!-- Final Step Tasks -->
                <div class="glass-premium card-hover rounded-3xl p-6 relative overflow-hidden group" data-aos="fade-up" data-aos-delay="400">
                    <div class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl gradient-purple flex items-center justify-center text-white shadow-lg shadow-purple-100">
                            <i class="fas fa-flag-checkered text-lg"></i>
                        </div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">งานสุดขั้นตอน</div>
                    </div>
                    <div class="text-4xl font-black text-gray-800 tracking-tight">${stats.type2 || 0}</div>
                    <div class="mt-2 text-xs text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full inline-block">
                        🏁 อยู่ในขั้นตอนสุดท้าย
                    </div>
                </div>

                <!-- Court Tasks -->
                <div class="glass-premium card-hover rounded-3xl p-6 relative overflow-hidden group" data-aos="fade-up" data-aos-delay="500">
                    <div class="absolute right-0 top-0 -mr-6 -mt-6 w-24 h-24 bg-red-50 rounded-full group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl gradient-red flex items-center justify-center text-white shadow-lg shadow-red-100">
                            <i class="fas fa-gavel text-lg"></i>
                        </div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">งานศาล</div>
                    </div>
                    <div class="text-4xl font-black text-gray-800 tracking-tight">${stats.type3 || 0}</div>
                    <div class="mt-2 text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full inline-block">
                        ⚖️ รอการวินิจฉัย/ศาล
                    </div>
                </div>
            </div>

            <!-- Analysis & Activity Section -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10" data-aos="fade-up" data-aos-delay="400">
                <!-- Performance Trends Graph -->
                <div class="glass-premium rounded-3xl p-8 shadow-xl border border-gray-100 lg:col-span-2">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 class="font-black text-xl text-gray-800 tracking-tight">กราฟภาพรวมผลการดำเนินงาน</h3>
                            <p class="text-xs text-gray-500 font-medium">แนวโน้มงานเสร็จสิ้นและงานค้างสะสม 6 เดือนล่าสุด</p>
                        </div>
                        <div class="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm">
                            <i class="fas fa-chart-line"></i>
                        </div>
                    </div>
                    <div class="h-[300px] w-full relative">
                        <canvas id="performanceChart"></canvas>
                    </div>
                </div>

                <!-- Workload Breakdown -->
                <div class="glass-premium rounded-3xl p-8 shadow-xl border border-gray-100">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 class="font-black text-xl text-gray-800 tracking-tight">${stats.isSingleDept ? 'สัดส่วนงานค้าง' : 'ภาระงานค้าง'}</h3>
                            <p class="text-xs text-gray-500 font-medium">${stats.isSingleDept ? `แยกตามประเภทความคืบหน้า (${stats.deptLabel})` : 'สัดส่วนงานค้างแยกตามแผนก'}</p>
                        </div>
                        <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                    </div>
                    <div class="space-y-6">
                        ${stats.pendingByDept && Object.entries(stats.pendingByDept).length > 0 ?
                Object.entries(stats.pendingByDept)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, count], idx) => {
                        const percentage = Math.round((count / (stats.pending || 1)) * 100);
                        const depts_meta = {
                            'ฝ่ายรังวัด': { icon: 'fa-vector-square', color: 'from-emerald-400 to-teal-500' },
                            'ฝ่ายทะเบียน': { icon: 'fa-file-invoice', color: 'from-blue-400 to-indigo-500' },
                            'กลุ่มงานวิชาการ': { icon: 'fa-book-reader', color: 'from-purple-400 to-pink-500' },
                            'งานปกติ/อื่นๆ': { icon: 'fa-circle', color: 'from-gray-400 to-gray-500' },
                            'งานสุดขั้นตอน': { icon: 'fa-flag-checkered', color: 'from-purple-400 to-indigo-500' },
                            'งานศาล': { icon: 'fa-gavel', color: 'from-red-400 to-rose-500' },
                            'งานค้าง (สะสม)': { icon: 'fa-clock', color: 'from-orange-400 to-amber-500' }
                        };
                        const meta = depts_meta[label] || depts_meta[label.replace(' (2)', '').replace(' (4)', '')] || { icon: 'fa-layer-group', color: 'from-gray-400 to-gray-500' };

                        return `
                                <div>
                                    <div class="flex justify-between items-end mb-2">
                                        <div class="flex items-center">
                                            <div class="w-2 h-2 rounded-full bg-gradient-to-r ${meta.color} mr-2"></div>
                                            <span class="text-sm font-bold text-gray-700">${label}</span>
                                        </div>
                                        <div class="flex flex-col items-end">
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs font-bold text-gray-400 tracking-widest uppercase">${count} งาน</span>
                                                <span class="text-lg font-black text-gray-800">${percentage}%</span>
                                            </div>
                                            <div class="text-[9px] space-x-2 font-bold whitespace-nowrap mt-0.5">
                                                ${!stats.isSingleDept && stats.pendingBreakdown?.[label]?.type2 ? `<span class="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100 italic">สุดขั้นตอน(2): ${stats.pendingBreakdown[label].type2}</span>` : ''}
                                                ${!stats.isSingleDept && stats.pendingBreakdown?.[label]?.type4 ? `<span class="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100 italic">งานค้าง(4): ${stats.pendingBreakdown[label].type4}</span>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                        <div class="bg-gradient-to-r ${meta.color} h-3 rounded-full transition-all duration-1000 ease-out shadow-inner" style="width: ${percentage}%"></div>
                                    </div>
                                </div>
                            `;
                    }).join('')
                : '<div class="text-center text-gray-400 py-10"><i class="fas fa-inbox text-4xl mb-2 opacity-20"></i><p>ไม่มีข้อมูลงานค้าง</p></div>'
            }
                    </div>
                </div>

                <!-- Recent Activity Feed -->
                <div class="glass-premium rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 class="font-black text-xl text-gray-800 tracking-tight">รายการล่าสุด</h3>
                            <p class="text-xs text-gray-500 font-medium">${stats.isSingleDept ? 'ความเคลื่อนไหวล่าสุดในฝ่าย' : 'ความเคลื่อนไหวรวมทุกฝ่ายย้อนหลัง 8 รายการ'}</p>
                        </div>
                        <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                            <i class="fas fa-history"></i>
                        </div>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
                        ${this.renderRecentTasks(
                userDept === 'survey' || userDept === 'all' ? surveyItems : [],
                userDept === 'registration' || userDept === 'all' ? registrationItems : [],
                userDept === 'academic' || userDept === 'all' ? academicItems : []
            )}
                    </div>
                </div>
            </div>

            <!-- Ultimate Action Hub -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-aos="fade-up" data-aos-delay="500">
                <!-- Action: New Report -->
                <div class="glass-premium card-hover rounded-3xl p-6 group cursor-pointer border-l-4 border-indigo-500" onclick="app.navigate('report')">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div>
                            <div class="text-lg font-black text-gray-800 tracking-tight">รายงาน งานเกิดใหม่</div>
                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">แผนงานงานค้าง</div>
                        </div>
                    </div>
                </div>

                <!-- Action: Sameday Report -->
                <a href="sameday_report.html" class="glass-premium card-hover rounded-3xl p-6 group border-l-4 border-emerald-500 block">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                            <i class="fas fa-file-circle-check"></i>
                        </div>
                        <div>
                            <div class="text-lg font-black text-gray-800 tracking-tight">เกิดเสร็จวันเดียว</div>
                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Sameday Report</div>
                        </div>
                    </div>
                </a>

                <!-- Action: Backlog History -->
                <div class="glass-premium card-hover rounded-3xl p-6 group cursor-pointer border-l-4 border-amber-500" onclick="app.navigate('old_backlog')">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                            <i class="fas fa-folder-open"></i>
                        </div>
                        <div>
                            <div class="text-lg font-black text-gray-800 tracking-tight">งานค้างย้อนหลัง</div>
                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Old Backlog</div>
                        </div>
                    </div>
                </div>

                <!-- Action: System Status -->
                <div class="glass-premium rounded-3xl p-6 border-l-4 border-rose-500 flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl">
                        <i class="fas fa-server"></i>
                    </div>
                    <div>
                        <div class="text-lg font-black text-gray-800 tracking-tight">System Status</div>
                        <div class="flex items-center mt-1">
                            <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1.5"></span>
                            <span class="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Normal</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    //Helper function for Recent Tasks
    renderRecentTasks(surveyItems, registrationItems, academicItems) {
        const allItems = [...surveyItems, ...registrationItems, ...academicItems]
            .filter(i => i.received_date)
            .sort((a, b) => new Date(b.received_date) - new Date(a.received_date))
            .slice(0, 8);

        if (allItems.length === 0) {
            return '<div class="text-center text-gray-400 py-8"><i class="fas fa-inbox text-4xl mb-2"></i><p>ยังไม่มีงานในระบบ</p></div>';
        }

        return allItems.map(item => {
            const date = new Date(item.received_date);
            const dept = item.survey_type ? 'รังวัด' : (item.subject ? 'ทะเบียน' : 'วิชาการ');
            const deptColor = item.survey_type ? 'bg-emerald-100 text-emerald-700' : (item.subject ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700');
            const title = item.applicant || item.related_person || item.sender_name || 'ไม่ระบุ';
            const isCompleted = DataManager.isCompleted(item);
            const opacityClass = isCompleted ? 'opacity-50' : '';
            const statusBadge = isCompleted
                ? '<span class="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500"><i class="fas fa-check mr-1"></i>เสร็จ</span>'
                : '<span class="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700"><i class="fas fa-hourglass-half mr-1"></i>รอ</span>';

            return `
                <div class="flex items-center p-3 mb-2 rounded-2xl hover:bg-gray-50/80 transition-all duration-300 group border border-transparent hover:border-gray-100 hover:shadow-sm">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center text-center mr-4 flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                        <span class="text-lg font-black text-gray-700 leading-tight">${date.getDate()}</span>
                        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">${date.toLocaleDateString('th-TH', { month: 'short' })}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start mb-1">
                            <p class="font-bold text-gray-800 truncate group-hover:text-indigo-600 transition-colors">${title}</p>
                            ${statusBadge}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${deptColor}">${dept}</span>
                            <span class="text-[10px] text-gray-400 truncate">${item.summary ? item.summary.substring(0, 30) + '...' : '-'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    //Helper function for Urgent Tasks
    renderUrgentTasks(surveyItems, registrationItems, academicItems) {
        const today = new Date();
        const allItems = [...surveyItems, ...registrationItems, ...academicItems]
            .filter(i => {
                if (DataManager.isCompleted(i)) return false;
                const rd = new Date(i.received_date);
                if (isNaN(rd.getTime())) return false;
                return Math.floor((today - rd) / (1000 * 60 * 60 * 24)) > 30;
            })
            .sort((a, b) => new Date(a.received_date) - new Date(b.received_date))
            .slice(0, 8);

        if (allItems.length === 0) {
            return '<div class="text-center text-gray-500 py-8"><i class="fas fa-circle-check text-4xl mb-2 text-emerald-500"></i><p class="text-gray-700 font-semibold">ไม่พบรายการเร่งด่วน</p><p class="text-sm text-gray-500 mt-1">ไม่พบรายการค้าง 31 วันขึ้นไป</p></div>';
        }

        return allItems.map(item => {
            const rd = new Date(item.received_date);
            const days = Math.floor((today - rd) / (1000 * 60 * 60 * 24));
            const dept = item.survey_type ? 'รังวัด' : (item.subject ? 'ทะเบียน' : 'วิชาการ');
            const title = item.applicant || item.related_person || item.sender_name || 'ไม่ระบุ';
            const isOver60 = days > 60;
            const bgClass = isOver60 ? 'bg-red-50 border-l-4 border-red-500' : 'bg-orange-50 border-l-4 border-orange-400';
            const numBgClass = isOver60 ? 'bg-red-100' : 'bg-orange-100';
            const numTextClass = isOver60 ? 'text-red-600' : 'text-orange-600';
            const labelTextClass = isOver60 ? 'text-red-500' : 'text-orange-500';
            const urgencyBadge = isOver60
                ? '<span class="px-2 py-1 text-xs font-bold rounded bg-red-100 text-red-700">ค้างเกิน 60 วัน</span>'
                : '<span class="px-2 py-1 text-xs font-bold rounded bg-orange-100 text-orange-700">ค้าง 31 - 60 วัน</span>';

            return `
                <div class="flex items-center py-3 mb-2 rounded-lg px-3 ${bgClass}">
                    <div class="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center mr-3 flex-shrink-0 ${numBgClass}">
                        <span class="text-xl font-black ${numTextClass}">${days}</span>
                        <span class="text-[10px] ${labelTextClass}">วัน</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-800 truncate">${title}</p>
                        <p class="text-xs text-gray-500 mt-0.5">${dept} • รับ ${rd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                    </div>
                    <div class="flex-shrink-0">
                        ${urgencyBadge}
                    </div>
                </div>
            `;
        }).join('');
    },

    //Render Monthly ABM Report (สถิติรายเดือนแยกตามฝ่าย)
    //Render Monthly ABM Report (ตารางตามเดือน แยกตามฝ่าย - ตามรูปภาพตัวอย่าง)
    async renderMonthlyABMReport(abmData, currentYearMonth = '') {
        const trend = abmData.trend || [];
        const depts = [
            { id: 'academic', label: 'ฝ่ายวิชาการ' },
            { id: 'registration', label: 'ฝ่ายทะเบียน' }, // มักจะเรียกฝ่ายทะเบียน หรือฝ่ายบริหารในบางแผนก
            { id: 'survey', label: 'ฝ่ายรังวัด' }
        ];

        // Track running balances for each department
        let deptBalances = {
            academic: 0,
            registration: 0,
            survey: 0
        };

        let html = `
            <div class="space-y-12 animate-fade-in p-2 md:p-6 bg-gray-50/50 rounded-2xl">
                <!-- Header Zone -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-black text-gray-800 tracking-tight">รายงานสรุปผลการดำเนินงาน</h2>
                        <p class="text-gray-500 flex items-center mt-1">
                            <i class="fas fa-calendar-alt mr-2 text-blue-500"></i> สรุปผลงานรายเดือน (Action Plan)
                        </p>
                    </div>
                </div>`;

        // Iterate Month by Month
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
                const pctPending = intake > 0 ? ((pendingCurrent / intake) * 100).toFixed(2) : "0.00";

                const prevBal = deptBalances[dept.id];
                const currentBal = prevBal + pendingCurrent;

                // Update for next month
                deptBalances[dept.id] = currentBal;

                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-3 border font-bold text-gray-700 bg-gray-50/50">${dept.label}</td>
                        <!-- (7) 30 วัน -->
                        <td class="px-3 py-3 border text-center font-bold text-blue-600">${comp30.toLocaleString()}</td>
                        <td class="px-3 py-3 border text-center font-medium text-gray-600">${pct30}</td>
                        <!-- (8) 60 วัน -->
                        <td class="px-3 py-3 border text-center font-bold text-indigo-600">${comp60.toLocaleString()}</td>
                        <td class="px-3 py-3 border text-center font-medium text-gray-600">${pct60}</td>
                        <!-- (9) ไม่แล้วเสร็จ -->
                        <td class="px-3 py-3 border text-center font-bold text-red-600">${pendingCurrent.toLocaleString()}</td>
                        <td class="px-3 py-3 border text-center font-medium text-gray-600">${pctPending}</td>
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
                                onchange="app.saveABMNote('${monthItem.month}', '${dept.id}', this.value)">
                        </td>
                    </tr>
                `;
            }).join('');

            html += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8" data-aos="fade-up">
                    <div class="bg-gray-100/50 px-6 py-3 border-b border-gray-200">
                        <h4 class="font-black text-gray-800">เดือน${monthLabel} ${isFirstMonth ? '(เดือนเริ่มต้น)' : ''}</h4>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm border-collapse">
                            <thead>
                                <tr class="bg-blue-50/50 text-gray-700 font-bold">
                                    <th rowspan="2" class="px-4 py-3 border text-center w-32">ฝ่าย</th>
                                    <th colspan="6" class="px-2 py-2 border text-center bg-blue-100/30">ปริมาณงานที่เกิดใหม่</th>
                                    <th rowspan="2" class="px-2 py-3 border text-center w-24">(11)<br>งานก่อนหน้า<br>(เรื่อง)</th>
                                    <th rowspan="2" class="px-2 py-3 border text-center w-24">(12)<br>งานเดือนปัจจุบัน<br>(เรื่อง)</th>
                                    <th rowspan="2" class="px-4 py-3 border text-center">หมายเหตุ</th>
                                </tr>
                                <tr class="bg-blue-50/30 text-[11px] font-bold text-gray-600">
                                    <th class="px-2 py-2 border text-center w-20">(7)<br>≤30 วัน<br>(เรื่อง)</th>
                                    <th class="px-2 py-2 border text-center w-20">(7)<br>≤30 วัน<br>(%)</th>
                                    <th class="px-2 py-2 border text-center w-20">(8)<br>31-60 วัน<br>(เรื่อง)</th>
                                    <th class="px-2 py-2 border text-center w-20">(8)<br>31-60 วัน<br>(%)</th>
                                    <th class="px-2 py-2 border text-center w-20">(9)<br>ค้าง >60 วัน<br>(เรื่อง)</th>
                                    <th class="px-2 py-2 border text-center w-20">(9)<br>ค้าง >60 วัน<br>(%)</th>
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
        return html;
    },

    async renderReport(reportDate = null) {
        //Get ABM data based on selected date
        const abmReport = await DataManager.getABMReport(reportDate);
        this.renderStats(abmReport.stats, reportDate);
        this.renderABMReport(abmReport, reportDate);
        const today = new Date();
        const datePickerValue = reportDate || today.toISOString().split('T')[0];

        //Render Monthly Report Content
        const monthlyReportContent = await this.renderMonthlyABMReport(abmData, datePickerValue.slice(0, 7));

        return `
            <div class="space-y-6" data-aos="fade-up">
                <!-- Toolbar with Date Picker -->
                <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 class="font-bold text-gray-800 text-xl"><i class="fas fa-chart-line mr-2 text-emerald-500"></i>รายงานสรุปผลการดำเนินงาน</h3>
                        <p class="text-sm text-gray-500">ระบบติดตามงานค้าง สำนักงานที่ดินจังหวัดอ่างทอง</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <!-- Date Picker -->
                        <div class="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 p-2 rounded-xl border border-indigo-100">
                            <label class="text-sm font-bold text-indigo-700"><i class="fas fa-calendar-alt mr-1"></i>ปีที่รายงาน:</label>
                            <input type="month" id="abm-report-month" value="${datePickerValue.slice(0, 7)}" 
                                class="px-3 py-2 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium bg-white">
                            <button onclick="app.updateABMReport(document.getElementById('abm-report-month').value + '-01')" 
                                class="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg font-bold text-sm hover:from-indigo-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg flex items-center">
                                <i class="fas fa-sync-alt mr-1.5"></i> อัปเดตข้อมูล
                            </button>
                        </div>
                        <button onclick="app.exportToExcel()" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center">
                             <i class="fas fa-file-excel mr-2"></i> Export Excel
                        </button>
                        <button onclick="app.exportToPDF()" class="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center">
                             <i class="fas fa-file-pdf mr-2"></i> Export PDF
                        </button>
                    </div>
                </div>

                <!-- Monthly Breakdown Content -->
                <div id="report-content">
                    ${monthlyReportContent}
                </div>
            </div>
            `;
    },

    showDetailModal(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const statusLabel = item.status === 'completed'
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-bold">รอการดำเนินการ</span>';

        content.innerHTML = `
            <div class="space-y-6">
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        ${statusLabel}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatDate(item.received_date)}</span>
                    </div>
                </div>

                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">เรื่อง /หัวข้อ</label>
                        <div class="text-gray-900 font-medium text-lg leading-relaxed">${item.subject || '-'}</div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ฝ่ายเจ้าของเรื่อง</label>
                            <div class="text-gray-800 font-medium flex items-center">
                                <span class="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                                ${item.department}
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ผู้รับผิดชอบ</label>
                            <div class="text-gray-800 font-medium flex items-center">
                                <span class="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs mr-2 font-bold">
                                    ${(item.responsible_person || 'U').charAt(0).toUpperCase()}
                                </span>
                                ${item.responsible_person || '-'}
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">รายละเอียดเพิ่มเติม</label>
                    <div class="p-4 bg-white border border-gray-200 rounded-lg min-h-[100px] text-gray-600 leading-relaxed shadow-inner">
                        ${item.details ? item.details.replace(/\n/g, '<br>') : '<span class="text-gray-400 italic">ไม่มีรายละเอียดเพิ่มเติมระบุไว้</span>'}
                    </div>
                </div>
            </div>
            `;

        modal.classList.remove('hidden');
        //Simple entry animation
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);
    },


    formatDate(dateString) {
        if (!dateString || dateString === '0000-00-00' || dateString === '0000-00-00 00:00:00') return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    },

    //--- Survey Department Views ---

    async renderSurveyList(allItems, searchTerm = '', sortOrder = 'desc', filterType = 'all', page = 1, limit = 20, statusView = 'pending') {
        const fullItems = await DataManager.getSurveyItems();
        const surveyTypes = [...new Set(fullItems.map(i => i.survey_type).filter(Boolean))];

        // Process data (Sort by ID)
        let processedItems = [...allItems];
        processedItems.sort((a, b) => {
            const idA = parseInt(a.id, 10) || 0;
            const idB = parseInt(b.id, 10) || 0;
            return sortOrder === 'asc' ? (idA - idB) : (idB - idA);
        });

        const totalItems = processedItems.length;

        let html = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4" data-aos="fade-down">
                <h3 class="font-bold text-3xl flex items-center self-start md:self-auto group">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 mr-4 transform group-hover:scale-105 transition-transform duration-300">
                        <i class="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-0.5">Department</span>
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 group-hover:from-indigo-600 group-hover:to-purple-600 transition-all duration-300">งานฝ่ายรังวัด</span>
                    </div>
                    <span class="bg-indigo-50 text-indigo-700 text-sm font-bold px-3 py-1 rounded-full ml-4 border border-indigo-100 shadow-sm flex items-center">
                        <i class="fas fa-file-alt mr-1.5 text-xs"></i> <span id="survey-total-items">${totalItems}</span> รายการ
                    </span>
                </h3>
                
                <div class="flex flex-wrap gap-2 w-full md:w-auto justify-end items-center">
                    <!-- Tab Switcher (งานคงค้าง/งานเสร็จ) -->
                    <div class="flex bg-gray-100 p-1 rounded-xl mr-2">
                        <button onclick="app.setSurveyStatusView('pending')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานค้าง
                        </button>
                        <button onclick="app.setSurveyStatusView('completed')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานที่เสร็จแล้ว
                        </button>
                    </div>

                    <!-- Filter by Survey Type -->
                    <select onchange="app.filterSurveyType(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-white">
                        <option value="all" ${filterType === 'all' ? 'selected' : ''}>-- ทุกประเภท --</option>
                        ${surveyTypes.map(t => `<option value="${t}" ${filterType === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>

                    <!-- Progress Type Filter -->
                    <select onchange="app.filterSurveyProgress(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer bg-purple-50">
                        <option value="all" ${app.surveyProgressFilter === 'all' || !app.surveyProgressFilter ? 'selected' : ''}>-- ทุกสถานะ --</option>
                        <option value="2" ${app.surveyProgressFilter === '2' ? 'selected' : ''}>สุดขั้นตอน</option>
                        <option value="3" ${app.surveyProgressFilter === '3' ? 'selected' : ''}>งานศาล</option>
                        <option value="4" ${app.surveyProgressFilter === '4' ? 'selected' : ''}>งานค้าง</option>
                    </select>

                    <!-- Month Filter (Completed Only) -->
                    ${statusView === 'completed' ? `
                    <select onchange="app.filterSurveyMonth(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer bg-indigo-50">
                        <option value="all" ${app.surveyMonthFilter === 'all' ? 'selected' : ''}>-- ทุกเดือน (เสร็จ) --</option>
                        ${this.thaiMonths.map((m, i) => `<option value="${i + 1}" ${parseInt(app.surveyMonthFilter) === (i + 1) ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    ` : ''}

                    <div class="flex bg-indigo-50 p-1.5 rounded-2xl mr-2 shadow-inner border border-indigo-100">
                        <button onclick="app.sortSurveyList('desc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'desc' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 transform scale-105' : 'text-indigo-400 hover:text-indigo-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-down-9-1 mr-2 scale-110"></i> ใหม่ไปเก่า
                        </button>
                        <button onclick="app.sortSurveyList('asc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'asc' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 transform scale-105' : 'text-indigo-400 hover:text-indigo-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-up-1-9 mr-2 scale-110"></i> เก่ามาใหม่
                        </button>
                    </div>

                    <button onclick="app.exportDepartmentToExcel('survey')" class="bg-white border border-indigo-200 text-indigo-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all shadow-sm flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-file-excel mr-2"></i> ส่งออก Excel
                    </button>

                    <button onclick="app.openSurveyRegModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-file-import mr-2"></i> บันทึกยอดรับจากทะเบียน
                    </button>

                    <button onclick="app.openAddModal('survey')" class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-plus mr-2"></i> เพิ่มงาน
                    </button>

                </div>
                </div>
            </div>

            <div id="survey-list-container" class="space-y-4" data-aos="fade-up">
                ${this.renderSurveyItems(processedItems)}
            </div>`;
        return html;
    },


    async updateSurveyList(allItems, searchTerm, sortOrder, filterType, page, limit) {
        //Pagination Logic
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const start = (page - 1) * limit;
        const currentItems = allItems.slice(start, start + limit);

        //Update Total Count
        const countDisplay = document.getElementById('survey-total-items');
        if (countDisplay) countDisplay.innerText = totalItems;

        //Update List Items
        const container = document.getElementById('survey-list-container');
        if (container) {
            container.innerHTML = this.renderSurveyItems(allItems, page, totalPages, totalItems, start, limit);
        }
    },

    renderSurveyItems(items) {
        let html = '';
        if (items.length === 0) {
            html += `<div class="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"> ไม่พบข้อมูล</div> `;
        } else {
            //Mobile View (Cards) - hidden on desktop
            html += `<div class="grid grid-cols-1 gap-4 md:hidden"> `;
            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);
                const statusVal = item.status_cause || item.status || '';

                let statusBadgeText = statusVal === 'pending' ? 'รอดำเนินการ' : (statusVal || 'รอดำเนินการ');
                let statusColor = "bg-blue-100 text-blue-800";
                let durationText = `<span class="text-xs text-gray-500"> ผ่านมา ${diffDays} วัน</span> `;

                const isCompleted = DataManager.isCompleted(item);
                if (!isCompleted) {
                    if (diffDays > 60) {
                        statusColor = "bg-red-100 text-red-800 animate-pulse border border-red-200";
                        statusBadgeText = `🚨 ล่าช้า`;
                        durationText = `<span class="text-xs font-bold text-red-600 animate-pulse"> <i class="fas fa-fire mr-1"></i>🔥 เกิน ${diffDays} วัน</span> `;
                    } else if (diffDays > 30) {
                        statusColor = "bg-yellow-100 text-yellow-800 border border-yellow-200";
                        statusBadgeText = `⚠️ ล่าช้า`;
                        durationText = `<span class="text-xs font-bold text-yellow-600"> <i class="fas fa-exclamation-triangle mr-1"></i>🟠 เกิน ${diffDays} วัน</span> `;
                    } else if (diffDays > 14) {
                        statusColor = "bg-orange-100 text-orange-800 border border-orange-200";
                        statusBadgeText = `⏳ ติดตาม`;
                        durationText = `<span class="text-xs font-bold text-orange-600">⏱️ ติดตาม(${diffDays} วัน)</span> `;
                    }
                }

                html += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all hover:shadow-md">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="text-xs font-bold text-gray-500">#${item.received_seq || '-'}</span>
                            <h4 class="font-bold text-gray-800 text-lg">${item.applicant || 'ไม่ระบุชื่อ'}</h4>
                        </div>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">
                            ${statusBadgeText}
                        </span>
                    </div>

                    <div class="bg-gray-50 rounded-lg p-2 mb-3 flex justify-between items-center">
                         <div class="text-sm"><i class="far fa-calendar-alt text-gray-400 mr-2"></i>${formattedDate}</div>
                         <div>${durationText}</div>
                    </div>
                    
                    <div class="space-y-2 text-sm text-gray-600 mb-4">
                        <div class="flex items-center"><i class="fas fa-tag w-5 text-gray-400"></i>${item.survey_type || '-'}</div>
                        ${item.summary ? `<div class="flex items-center"><i class="fas fa-file-alt w-5 text-gray-400"></i>${item.summary.substring(0, 30)}...</div>` : ''}
                    </div>

                    <button onclick="app.viewSurveyDetail('${item.id}')" class="w-full bg-emerald-50 text-emerald-700 py-2 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
                        ดูรายละเอียด
                    </button>
                </div> `;
            });
            html += `</div> `;

            //Desktop View (Table)
            html += `<div class="hidden md:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <table id="survey-datatable" class="w-full text-left border-collapse display">
                <thead class="bg-emerald-50/80 border-b border-emerald-100">
                    <tr>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800 text-center" style="width:50px">สถานะ</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800 text-center" style="width:90px">วันที่รับ</th>
                        <th class="px-3 py-3 text-xs font-bold text-red-600 text-center" style="width:80px">ระยะเวลา</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800 text-center" style="width:60px">ลำดับ</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800 text-center" style="width:80px">เลข รว.12</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800" style="width:120px">ประเภท</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800">ผู้ขอ</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800">สรุป</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800" style="width:80px">คนคุม</th>
                        <th class="px-3 py-3 text-xs font-bold text-emerald-800 text-center" style="width:50px">ดู</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">`;

            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);
                const statusVal = item.status_cause || item.status || '';

                let statusBadge = '';
                let rowClass = "hover:bg-gray-50 transition-all";
                let durationCol = `<span class="text-gray-500 text-xs">${diffDays}วัน</span>`;

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted) {
                    statusBadge = '<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">เสร็จ</span>';
                    rowClass += " opacity-50 bg-gray-50";
                } else if (statusVal === 'job_sent' || statusVal.includes('ส่งเรื่อง')) {
                    statusBadge = '<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-teal-50 text-teal-600">ส่งทะเบียน</span>';
                } else {
                    let badgeText = statusVal || 'รอ';
                    if (diffDays > 60) {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 animate-pulse">🚨</span>`;
                        durationCol = `<span class="text-red-700 font-bold text-xs bg-red-50 px-1.5 py-0.5 rounded">🔥 ${diffDays}วัน</span>`;
                        rowClass = "bg-red-50/40 hover:bg-red-50 border-l-2 border-red-500";
                    } else if (diffDays > 30) {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 text-orange-700">⚠️</span>`;
                        durationCol = `<span class="text-orange-700 font-bold text-xs bg-orange-50 px-1.5 py-0.5 rounded">🟠 ${diffDays}วัน</span>`;
                    } else if (diffDays > 14) {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-100 text-yellow-700">⏳</span>`;
                        durationCol = `<span class="text-yellow-700 font-bold text-xs bg-yellow-50 px-1.5 py-0.5 rounded">⏱️ ${diffDays}วัน</span>`;
                    } else {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-600">${badgeText.substring(0, 4)}</span>`;
                    }
                }

                const truncate = (text, len) => text && text.length > len ? text.substring(0, len) + '...' : (text || '-');

                html += `
                    <tr class="${rowClass}">
                        <td class="px-3 py-2 text-center">${statusBadge}</td>
                        <td class="px-3 py-2 text-center text-sm text-gray-700 font-medium">${formattedDate}</td>
                        <td class="px-3 py-2 text-center">${durationCol}</td>
                        <td class="px-3 py-2 text-center text-sm text-gray-400">#${item.received_seq || '-'}</td>
                        <td class="px-3 py-2 text-center text-sm text-indigo-600 font-bold">${item.rv_12 || '-'}</td>
                        <td class="px-3 py-2 text-sm text-gray-700">${truncate(item.survey_type, 15)}</td>
                        <td class="px-3 py-2 text-sm text-gray-800 font-medium">${truncate(item.applicant, 20)}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">${truncate(item.summary, 25)}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">${item.men || '-'}</td>
                        <td class="px-3 py-2 text-center">
                            <button onclick="app.viewSurveyDetail('${item.id}')"
                                class="px-2 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>`;
            });
            html += `</tbody></table></div> `;
        }
        return html;
    },

    //--- Registration Department Views ---

    //--- Helper for Date ---
    getSafeDate(dateString) {
        if (!dateString) return null;
        let date = new Date(dateString);

        //Invalid check
        if (isNaN(date.getTime())) return null;

        let year = date.getFullYear();

        //1. Handle Short Years (e.g. 23 -> 2023)
        //Browsers might parse "23" as 1923 or 2023. We want 2023 for this system.
        // This is a placeholder for the actual navigate function logic.
        // The instruction implies this code snippet is part of a larger 'navigate' function.
        // Since the full 'navigate' function is not provided, I'm inserting the change
        // at the closest logical point based on the provided context, which is within
        // the 'getSafeDate' function's comments, as per the instruction's formatting.
        // In a real scenario, this would be placed in the 'app.navigate' function.
        /*
        if (page === 'dashboard') {
            title.innerText = 'ภาพรวมการดำเนินงาน';
            content.innerHTML = await UI.renderDashboard(userDept);
            this.initPerformanceChart();
        } else if (type === 'registration' || type === 'academic' || type === 'admin')(page === 'logs') {
            title.innerText = 'ตรวจสอบประวัติ (Activity Logs)';
            content.innerHTML = await UI.renderLogs();
            UI.initDataTable('logs-datatable', { order: [[4, 'desc']] });
        } else if (type === 'registration' || type === 'academic' || type === 'admin')(page === 'report') {
        */
        if (year < 100) {
            year += 2000;
            date.setFullYear(year);
        } else if (year >= 100 && year < 1900) {
            //Safer to leave 19xx alone, it's visually obvious.
        }

        //2. Handle Buddhist Years (Recursive fallback)
        //If year is way in the future (e.g. 2566, 2600, 2780), subtract 543 until it's in a reasonable range (e.g. <2200)
        //This handles double-conversion errors (e.g. 2566 + 543 = 3109)
        while (year > 2200) {
            year -= 543;
            date.setFullYear(year); //Update the date object's year in each iteration
        }

        return date;
    },

    formatThaiDate(dateString) {
        if (!dateString) return '-';
        const date = this.getSafeDate(dateString); //Use the safe date first!
        if (!date || isNaN(date)) return '-';

        const day = date.getDate();
        const month = date.toLocaleDateString('th-TH', { month: 'short' });
        const year = date.getFullYear();
        const bYear = year + 543;
        const shortYear = String(bYear).slice(-2);

        return `${day} -${month} -${shortYear} `;
    },

    calculateDiffDays(dateString) {
        if (!dateString) return 0;
        const receivedDate = this.getSafeDate(dateString);
        if (!receivedDate || isNaN(receivedDate)) return 0;

        const now = new Date();
        //Reset time for fair comparison
        now.setHours(0, 0, 0, 0);
        receivedDate.setHours(0, 0, 0, 0);

        const diff = Math.floor((now - receivedDate) / (1000 * 60 * 60 * 24));

        //Sanity Check: If diff is> 50 years (18250 days), return 0. (Likely data error)
        if (Math.abs(diff) > 18250) {
            console.warn(`Suspicious Date Diff clamped to 0. Original: ${diff} `);
            return 0;
        }
        return diff;
    },

    processRegistrationData(items, searchTerm, sortOrder, filterType) {
        let processedItems = [...items];

        //Filter by Status
        if (filterType !== 'all') {
            const now = new Date();
            processedItems = processedItems.filter(item => {
                const diffDays = this.calculateDiffDays(item.received_date);
                if (filterType === 'pending') return item.status_cause !== 'เสร็จสิ้น' && item.status_cause !== 'ส่งทะเบียน' && item.status_cause !== 'ยกเลิก';
                if (filterType === 'completed') return item.status_cause === 'เสร็จสิ้น' || item.status_cause === 'ส่งทะเบียน' || item.status_cause === 'ยกเลิก';
                if (filterType === 'alert') return diffDays > 14 && item.status_cause !== 'เสร็จสิ้น' && item.status_cause !== 'ส่งทะเบียน' && item.status_cause !== 'ยกเลิก';
                return true;
            });
        }

        //Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            processedItems = processedItems.filter(item =>
                (item.subject && item.subject.toLowerCase().includes(lowerTerm)) ||
                (item.related_person && item.related_person.toLowerCase().includes(lowerTerm)) ||
                (item.responsible_person && item.responsible_person.toLowerCase().includes(lowerTerm)) ||
                (item.seq_no && String(item.seq_no).toLowerCase().includes(lowerTerm))
            );
        }

        //Sort
        processedItems.sort((a, b) => {
            if (sortOrder === 'subject_asc') {
                return (a.subject || '').localeCompare(b.subject || '');
            } else if (sortOrder === 'subject_desc') {
                return (b.subject || '').localeCompare(a.subject || '');
            }

            //Sort by ID
            const idA = parseInt(a.id, 10) || 0;
            const idB = parseInt(b.id, 10) || 0;

            return sortOrder === 'asc' ? (idA - idB) : (idB - idA);
        });

        return processedItems;
    },

    async renderRegistrationList(items, searchTerm = '', sortOrder = 'desc', filterType = 'all', subjectFilter = 'all', page = 1, limit = 20, statusView = 'pending') {
        const fullItems = await DataManager.getRegistrationItems();
        const subjects = [...new Set(fullItems.map(i => i.subject).filter(Boolean))];

        // Process data (Sort by ID inside here)
        const processedItems = this.processRegistrationData(items, searchTerm, sortOrder, filterType);

        let displayItems = processedItems;
        if (subjectFilter && subjectFilter !== 'all') {
            displayItems = displayItems.filter(i => i.subject === subjectFilter);
        }

        const totalItems = displayItems.length;

        let html = `
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4" data-aos="fade-down">
                <h3 class="font-bold text-3xl flex items-center self-start md:self-auto group">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-200 mr-4 transform group-hover:scale-105 transition-transform duration-300">
                        <i class="fas fa-folder-open text-white text-xl"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">Department</span>
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 group-hover:from-blue-600 group-hover:to-cyan-600 transition-all duration-300">งานฝ่ายทะเบียน</span>
                    </div>
                    <span class="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1 rounded-full ml-4 border border-blue-100 shadow-sm flex items-center">
                        <i class="fas fa-file-alt mr-1.5 text-xs"></i> <span id="reg-total-items">${totalItems}</span> รายการ
                    </span>
                </h3>
                
                <div class="flex flex-wrap gap-2 w-full md:w-auto justify-end items-center">
                    <!-- Tab Switcher -->
                    <div class="flex bg-gray-100 p-1 rounded-xl mr-2">
                        <button onclick="app.setRegistrationStatusView('pending')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานคงค้าง
                        </button>
                        <button onclick="app.setRegistrationStatusView('completed')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานที่เสร็จแล้ว
                        </button>
                    </div>

                    <!-- Subject Filter -->
                     <select onchange="app.filterRegistrationSubject(this.value)" class="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm max-w-[200px] truncate">
                          <option value="all" ${subjectFilter === 'all' ? 'selected' : ''}>-- ทุกเรื่อง --</option>
                          ${subjects.map(t => `<option value="${t}" ${subjectFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                     </select>

                    <!-- Progress Type Filter -->
                    <select onchange="app.filterRegistrationProgress(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-cyan-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer bg-cyan-50">
                        <option value="all" ${app.registrationProgressFilter === 'all' || !app.registrationProgressFilter ? 'selected' : ''}>-- ทุกสถานะ --</option>
                        <option value="2" ${app.registrationProgressFilter === '2' ? 'selected' : ''}>สุดขั้นตอน</option>
                        <option value="3" ${app.registrationProgressFilter === '3' ? 'selected' : ''}>งานศาล</option>
                        <option value="4" ${app.registrationProgressFilter === '4' ? 'selected' : ''}>งานค้าง</option>
                    </select>

                    <!-- Month Filter (Completed Only) -->
                    ${statusView === 'completed' ? `
                    <select onchange="app.filterRegistrationMonth(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-blue-50">
                        <option value="all" ${app.registrationMonthFilter === 'all' ? 'selected' : ''}>-- ทุกเดือน (เสร็จ) --</option>
                        ${this.thaiMonths.map((m, i) => `<option value="${i + 1}" ${parseInt(app.registrationMonthFilter) === (i + 1) ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    ` : ''}

                    <div class="flex bg-blue-50 p-1.5 rounded-2xl mr-2 shadow-inner border border-blue-100">
                        <button onclick="app.sortRegistrationList('desc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'desc' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 transform scale-105' : 'text-blue-400 hover:text-blue-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-down-9-1 mr-2 scale-110"></i> ใหม่ไปเก่า
                        </button>
                        <button onclick="app.sortRegistrationList('asc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'asc' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 transform scale-105' : 'text-blue-400 hover:text-blue-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-up-1-9 mr-2 scale-110"></i> เก่ามาใหม่
                        </button>
                    </div>

                    <button onclick="app.exportDepartmentToExcel('registration')" class="bg-white border border-blue-200 text-blue-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-file-excel mr-2"></i> ส่งออก Excel
                    </button>

                    <button onclick="app.openAddModal('registration')" class="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-plus mr-2"></i> เพิ่มงาน
                    </button>
                </div>
            </div>

            <div id="registration-list-container" class="space-y-4" data-aos="fade-up">
                ${this.renderRegistrationItems(displayItems)}
            </div>`;
        return html;
    },

    async updateRegistrationList(items, searchTerm, sortOrder, filterType, subjectFilter, page, limit) {
        const processedItems = this.processRegistrationData(items, searchTerm, sortOrder, filterType);

        let displayItems = processedItems;
        if (subjectFilter && subjectFilter !== 'all') {
            displayItems = displayItems.filter(i => i.subject === subjectFilter);
        }

        const totalItems = displayItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const start = (page - 1) * limit;
        const currentItems = displayItems.slice(start, start + limit);

        //Update Total Count
        const countDisplay = document.getElementById('reg-total-items');
        if (countDisplay) countDisplay.innerText = totalItems;

        //Update List Items
        const container = document.getElementById('registration-list-container');
        if (container) {
            container.innerHTML = this.renderRegistrationItems(displayItems, page, totalPages, totalItems, start, limit);
        }
    },

    renderRegistrationItems(items) {
        let html = '';
        if (items.length === 0) {
            html += `<div class="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"> ไม่พบข้อมูล</div> `;
        } else {
            //Mobile View (Cards)
            html += `<div class="grid grid-cols-1 gap-4 md:hidden">`;
            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);

                let statusBadge = '';
                let statusColor = "bg-blue-50 text-blue-600";
                let statusText = item.status_cause || '-';

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted || statusText === 'ส่งทะเบียน') {
                    statusColor = "bg-gray-100 text-gray-500";
                } else {
                    if (diffDays > 60) {
                        statusColor = "bg-red-100 text-red-800 animate-pulse border border-red-200";
                        statusText = `🚨 ${statusText} `;
                    } else if (diffDays > 30) {
                        statusColor = "bg-orange-100 text-orange-800 border border-orange-200";
                        statusText = `⚠️ ${statusText} `;
                    } else if (diffDays > 14) {
                        statusColor = "bg-yellow-100 text-yellow-800 border border-yellow-200";
                        statusText = `⏳ ${statusText} `;
                    }
                }

                html += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative overflow-hidden group hover:shadow-md transition-all">
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-gray-400 font-mono text-xs">#${item.seq_no}</span>
                        <span class="${statusColor} text-xs px-2 py-1 rounded-md font-bold">${statusText}</span>
                    </div>
                    <div class="mb-3">
                        <h4 class="font-bold text-gray-800 text-lg mb-1">${item.subject}</h4>
                        <p class="text-sm text-gray-600"><i class="fas fa-user mr-1.5 text-gray-400"></i>${item.related_person}</p>
                        ${item.summary ? `<p class="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded"><i class="fas fa-info-circle mr-1"></i>${item.summary}</p>` : ''}
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3 mt-2">
                        <div class="flex items-center">
                            <i class="far fa-calendar-alt mr-1.5"></i> ${formattedDate}
                            ${(statusText !== 'เสร็จสิ้น' && statusText !== 'ส่งทะเบียน' && statusText !== 'ยกเลิก') ? `<span class="ml-1 text-[10px] text-red-500">(${diffDays} วัน)</span>` : ''} 
                        </div>
                        <div class="flex items-center font-medium text-gray-700">
                            <i class="fas fa-user-tag mr-1.5 text-blue-400"></i> ${item.responsible_person || '-'}
                        </div>
                    </div>
                </div>
                `;
            });
            html += `</div>`;


            //Desktop View (Table) - Compact Design like Academic
            html += `<div class="hidden md:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div class="overflow-x-auto custom-scrollbar">
                <table id="registration-datatable" class="w-full text-left border-collapse min-w-[900px] display">
                    <thead class="bg-blue-50/80 border-b border-blue-100">
                        <tr>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800 text-center" style="width:50px">ลำดับ</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800 text-center" style="width:80px">วันที่รับ</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800" style="width:100px">เรื่อง</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800" style="width:140px">ผู้เกี่ยวข้อง</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800" style="width:150px">สรุป</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800 text-center" style="width:90px">สถานะ/สาเหตุ</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800" style="width:90px">ผู้รับผิดชอบ</th>
                            <th class="px-3 py-3 text-xs font-bold text-blue-800 text-center sticky right-0 bg-blue-50/80" style="width:50px">ดู</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;

            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);

                let statusBadge = '';
                let rowClass = "hover:bg-gray-50 transition-all";
                let statusText = item.status_cause || '-';

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted || statusText === 'ส่งทะเบียน') {
                    statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">${statusText.substring(0, 6)}</span>`;
                    rowClass += " opacity-50 bg-gray-50";
                } else {
                    if (diffDays > 60) {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 animate-pulse">🚨 ${diffDays}วัน</span>`;
                        rowClass = "bg-red-50/40 hover:bg-red-50 border-l-2 border-red-500";
                    } else if (diffDays > 30) {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 text-orange-700">⚠️ ${diffDays}วัน</span>`;
                    } else if (diffDays > 14) {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-100 text-yellow-700">⏳ ${diffDays}วัน</span>`;
                    } else {
                        statusBadge = `<span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">${statusText.substring(0, 8)}</span>`;
                    }
                }

                //Truncate text helper
                const truncate = (text, len) => text && text.length > len ? text.substring(0, len) + '...' : (text || '-');

                html += `
                        <tr class="${rowClass}">
                            <td class="px-3 py-2 text-center text-sm text-gray-500">${item.seq_no || '-'}</td>
                            <td class="px-3 py-2 text-center text-sm text-gray-700 font-medium">${formattedDate}</td>
                            <td class="px-3 py-2 text-sm text-gray-800">${truncate(item.subject, 15)}</td>
                            <td class="px-3 py-2 text-sm text-gray-700">${truncate(item.related_person, 18)}</td>
                            <td class="px-3 py-2 text-sm text-gray-600" title="${item.summary || ''}">${truncate(item.summary, 20)}</td>
                            <td class="px-3 py-2 text-center">${statusBadge}</td>
                            <td class="px-3 py-2 text-sm text-gray-600">${truncate(item.responsible_person, 12)}</td>
                            <td class="px-3 py-2 text-center sticky right-0 bg-white">
                                <button onclick="app.viewRegistrationDetail('${item.id}')"
                                    class="px-2 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>`;
            });
            html += `</tbody></table></div></div>`;
        }
        return html;
    },

    //--- Academic Department Views ---
    async renderAcademicList(items, searchTerm = '', sortOrder = 'desc', subjectFilter = 'all', page = 1, limit = 20, statusView = 'pending') {
        const fullItems = await DataManager.getAcademicItems();
        const subjects = [...new Set(fullItems.map(i => i.subject).filter(Boolean))];

        // Process data (Sort by ID)
        let processedItems = [...items];
        processedItems.sort((a, b) => {
            const idA = parseInt(a.id, 10) || 0;
            const idB = parseInt(b.id, 10) || 0;
            return sortOrder === 'asc' ? (idA - idB) : (idB - idA);
        });

        let displayItems = processedItems;
        if (subjectFilter && subjectFilter !== 'all') {
            displayItems = displayItems.filter(i => i.subject === subjectFilter);
        }

        const totalItems = displayItems.length;

        let html = `
                            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4" data-aos="fade-down">
                <h3 class="font-bold text-3xl flex items-center self-start md:self-auto group">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-200 mr-4 transform group-hover:scale-105 transition-transform duration-300">
                        <i class="fas fa-book-reader text-white text-xl"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-0.5">Department</span>
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 group-hover:from-orange-600 group-hover:to-red-600 transition-all duration-300">งานกลุ่มงานวิชาการ</span>
                    </div>
                    <span class="bg-orange-50 text-orange-700 text-sm font-bold px-3 py-1 rounded-full ml-4 border border-orange-100 shadow-sm flex items-center">
                        <i class="fas fa-file-alt mr-1.5 text-xs"></i> <span id="academic-total-items">${totalItems}</span> รายการ
                    </span>
                </h3>
                
                <div class="flex flex-wrap gap-2 w-full md:w-auto justify-end items-center">
                    <!-- Tab Switcher -->
                    <div class="flex bg-gray-100 p-1 rounded-xl mr-2">
                        <button onclick="app.setAcademicStatusView('pending')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'pending' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานคงค้าง
                        </button>
                        <button onclick="app.setAcademicStatusView('completed')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานที่เสร็จแล้ว
                        </button>
                    </div>

                     <!-- Subject Filter -->
                     <select onchange="app.filterAcademicSubject(this.value)" class="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 shadow-sm max-w-[200px] truncate">
                          <option value="all" ${subjectFilter === 'all' ? 'selected' : ''}>-- ทุกเรื่อง --</option>
                          ${subjects.map(t => `<option value="${t}" ${subjectFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                     </select>

                    <!-- Progress Type Filter -->
                    <select onchange="app.filterAcademicProgress(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer bg-red-50">
                        <option value="all" ${app.academicProgressFilter === 'all' || !app.academicProgressFilter ? 'selected' : ''}>-- ทุกสถานะ --</option>
                        <option value="2" ${app.academicProgressFilter === '2' ? 'selected' : ''}>สุดขั้นตอน</option>
                        <option value="3" ${app.academicProgressFilter === '3' ? 'selected' : ''}>งานศาล</option>
                        <option value="4" ${app.academicProgressFilter === '4' ? 'selected' : ''}>งานค้าง</option>
                    </select>

                    <!-- Month Filter (Completed Only) -->
                    ${statusView === 'completed' ? `
                    <select onchange="app.filterAcademicMonth(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-orange-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer bg-orange-50">
                        <option value="all" ${app.academicMonthFilter === 'all' ? 'selected' : ''}>-- ทุกเดือน (เสร็จ) --</option>
                        ${this.thaiMonths.map((m, i) => `<option value="${i + 1}" ${parseInt(app.academicMonthFilter) === (i + 1) ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    ` : ''}

                    <div class="flex bg-orange-50 p-1.5 rounded-2xl mr-2 shadow-inner border border-orange-100">
                        <button onclick="app.sortAcademicList('desc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'desc' ? 'bg-orange-600 text-white shadow-md ring-2 ring-orange-300 transform scale-105' : 'text-orange-400 hover:text-orange-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-down-9-1 mr-2 scale-110"></i> ใหม่ไปเก่า
                        </button>
                        <button onclick="app.sortAcademicList('asc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'asc' ? 'bg-orange-600 text-white shadow-md ring-2 ring-orange-300 transform scale-105' : 'text-orange-400 hover:text-orange-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-up-1-9 mr-2 scale-110"></i> เก่ามาใหม่
                        </button>
                    </div>

                <button onclick="app.exportDepartmentToExcel('academic')" class="bg-white border border-orange-200 text-orange-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-50 transition-all shadow-sm flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-file-excel mr-2"></i> ส่งออก Excel
                    </button>

                    <button onclick="app.openAddModal('academic')" class="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-orange-500/30 transform hover:-translate-y-0.5 flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-plus mr-2"></i> เพิ่มงาน
                    </button>
                </div>
            </div>

            <div id="academic-list-container" class="space-y-4" data-aos="fade-up">
                ${this.renderAcademicItems(displayItems)}
            </div>`;
        return html;
    },

    async updateAcademicList(items, searchTerm, subjectFilter, page, limit) {
        //Pagination Logic
        let displayItems = items;
        if (subjectFilter && subjectFilter !== 'all') {
            displayItems = displayItems.filter(i => i.subject === subjectFilter);
        }

        const totalItems = displayItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const start = (page - 1) * limit;
        const currentItems = displayItems.slice(start, start + limit);

        //Update Total Count
        const countDisplay = document.getElementById('academic-total-items');
        if (countDisplay) countDisplay.innerText = totalItems;

        //Update List Items
        const container = document.getElementById('academic-list-container');
        if (container) {
            container.innerHTML = this.renderAcademicItems(displayItems, page, totalPages, totalItems, start, limit);
        }
    },

    renderAcademicItems(items) {
        let html = '';
        if (items.length === 0) {
            html += `<div class="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"> ไม่พบข้อมูล</div> `;
        } else {
            //Mobile View (Cards)
            html += `<div class="grid grid-cols-1 gap-4 md:hidden"> `;
            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);
                let statusBadge = '';
                let statusText = item.status_cause || '-';
                let statusColor = "bg-orange-50 text-orange-600";

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted) {
                    statusColor = "bg-gray-100 text-gray-500";
                } else if (diffDays > 30) {
                    statusColor = "bg-red-100 text-red-800 animate-pulse border border-red-200";
                    statusText = `🚨 ${statusText} `;
                }

                html += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative overflow-hidden group hover:shadow-md transition-all">
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-gray-400 font-mono text-xs">#${item.seq_no}</span>
                            <span class="${statusColor} text-xs px-2 py-1 rounded-md font-bold">${statusText}</span>
                        </div>
                        <div class="mb-3">
                            <h4 class="font-bold text-gray-800 text-lg mb-1">${item.subject}</h4>
                            <p class="text-sm text-gray-600"><i class="fas fa-user mr-1.5 text-gray-400"></i>${item.related_person}</p>
                        </div>
                         <div class="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3 mt-2">
                             <div class="flex items-center">
                                <i class="far fa-calendar-alt mr-1.5"></i> ${formattedDate}
                                ${(statusText !== 'เสร็จสิ้น' && statusText !== 'ยกเลิก') ? `<span class="ml-1 text-[10px] text-red-500">(${diffDays} วัน)</span>` : ''} 
                             </div>
                             <div class="flex items-center font-medium text-gray-700">
                                <i class="fas fa-user-tag mr-1.5 text-orange-400"></i> ${item.responsible_person || '-'}
                             </div>
                        </div>
                    </div>
            `;
            });
            html += `</div> `;

            //Desktop View (Table) - DataTables will handle pagination
            html += `
            <div class="hidden md:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <table id="academic-datatable" class="w-full text-left border-collapse display">
                    <thead class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                        <tr>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center" style="width: 60px;">ที่</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center" style="width: 100px;">วันที่รับ</th>
                            <th class="px-4 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider">เรื่อง</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider" style="width: 150px;">ผู้เกี่ยวข้อง</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-red-600 uppercase tracking-wider text-center" style="width: 120px;">สาเหตุค้าง</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center" style="width: 80px;">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;

            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);
                let statusBadge = '';
                let statusText = item.status_cause || '-';
                let rowClass = "hover:bg-orange-50/50 transition-all duration-200 group";

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted) {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded bg-gray-100 text-gray-500">${statusText}</span>`;
                    rowClass += " opacity-60 bg-gray-50";
                } else if (diffDays > 60) {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-bold rounded bg-red-100 text-red-700 animate-pulse">🔥 ${diffDays}วัน</span>`;
                    rowClass = "bg-red-50/40 hover:bg-red-100/50 border-l-4 border-red-500";
                } else if (diffDays > 30) {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-bold rounded bg-orange-100 text-orange-700">⚠️ ${diffDays}วัน</span>`;
                    rowClass = "bg-orange-50/40 hover:bg-orange-100/50 border-l-4 border-orange-400";
                } else {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded bg-blue-50 text-blue-700">${statusText || diffDays + 'วัน'}</span>`;
                }

                html += `
                        <tr class="${rowClass}">
                            <td class="px-3 py-3 text-center text-sm font-mono text-gray-500">${item.seq_no || '-'}</td>
                            <td class="px-3 py-3 text-center text-sm text-gray-700">
                                <div class="font-semibold">${formattedDate}</div>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-800">
                                <div class="font-medium leading-relaxed">${item.subject || '-'}</div>
                            </td>
                            <td class="px-3 py-3 text-sm text-gray-600">${item.related_person || '-'}</td>
                            <td class="px-3 py-3 text-center">${statusBadge}</td>
                            <td class="px-3 py-3 text-center">
                                <button onclick="app.viewAcademicDetail('${item.id}')"
                                    class="inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold shadow hover:shadow-lg hover:scale-105 transition-all">
                                    <i class="fas fa-eye mr-1"></i> ดู
                                </button>
                            </td>
                        </tr>
                        `;
            });
            html += `</tbody></table></div> `;
        }
        return html;
    },
    renderAcademicForm() {
        return `
                            <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-xl p-8 border border-gray-100" data-aos="fade-up">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-gray-800 flex items-center">
                        <span class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 mr-3">
                            <i class="fas fa-book-reader"></i>
                        </span>
                        บันทึกงานใหม่ (กลุ่มงานวิชาการ)
                    </h3>
                    <button onclick="app.navigate('academic_list')" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <form id="add-academic-form" onsubmit="app.handleAcademicSubmit(event)">
                    <div class="grid grid-cols-1 gap-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">ที่ (เลขหนังสือ) <span class="text-red-500">*</span></label>
                                <input type="text" name="seq_no" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none" required>
                            </div>
                            <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">วันที่รับเรื่อง <span class="text-red-500">*</span></label>
                                <input type="date" name="received_date" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none" required>
                            </div>
                        </div>

                        <div class="group">
                            <label class="block text-gray-700 font-semibold mb-2">เรื่อง <span class="text-red-500">*</span></label>
                            <input type="text" name="subject" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none" required>
                        </div>

                        <div class="group">
                             <label class="block text-gray-700 font-semibold mb-2">ผู้ที่เกี่ยวข้อง (คู่กรณี)</label>
                             <input type="text" name="related_person" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none">
                        </div>

                        <div class="group">
                            <label class="block text-gray-700 font-semibold mb-2">ความสำคัญของเรื่อง (โดยสรุป)</label>
                            <textarea name="summary" rows="3" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"></textarea>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">สาเหตุที่ค้าง (สถานะ)</label>
                                <input type="text" name="status_cause" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none" placeholder="เช่น รอตรวจสอบ, เสนอลงนาม">
                            </div>
                            <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">ประเภทความคืบหน้า</label>
                                <input type="hidden" name="progress_type" value="1">
                                <div class="w-full border-gray-200 bg-gray-100 rounded-lg p-3 border text-gray-500 text-sm">
                                    <i class="fas fa-info-circle mr-1"></i> งานใหม่ — ตั้งเป็น "ปกติ" อัตโนมัติ
                                </div>
                            </div>
                        </div>

                        <div class="group">
                            <label class="block text-gray-700 font-semibold mb-2">ผู้รับผิดชอบ <span class="text-red-500">*</span></label>
                            <input type="text" name="responsible_person" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none" required>
                        </div>

                        <div class="pt-6">
                            <button type="submit" class="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold py-3.5 px-4 rounded-lg hover:from-orange-700 hover:to-red-700 transition duration-300 shadow-md transform hover:-translate-y-1">
                                <i class="fas fa-save mr-2"></i> บันทึกข้อมูล
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            `;
    },

    renderSurveyForm() {
        return `
            <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-xl p-8 border border-gray-100" data-aos="fade-up">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-gray-800">บันทึกงานรังวัดใหม่</h3>
                    <button onclick="app.navigate('survey_list')" class="text-gray-500 hover:text-gray-700 text-sm"><i class="fas fa-arrow-left mr-1"></i> กลับหน้ารายการ</button>
                </div>
                
                <form id="add-survey-form" onsubmit="app.handleSurveySubmit(event)">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Row 1: ลำดับ และ วันที่ -->
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ลำดับที่</label>
                            <input type="text" name="received_seq" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น 1, 2, 3..." required>
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">วันที่รับเรื่อง</label>
                            <input type="date" name="received_date" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" required>
                        </div>

                        <!-- Row 2: ประเภท และ ผู้ขอ -->
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ประเภทการรังวัด</label>
                            <input type="text" name="survey_type" list="survey_types" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น สอบเขต, แบ่งแยก...">
                            <datalist id="survey_types">
                                <option value="สอบเขตโฉนดที่ดิน">
                                <option value="แบ่งแยกในนามเดิม">
                                <option value="รวมโฉนด">
                                <option value="แบ่งกรรมสิทธิ์รวม">
                                <option value="แบ่งหักเป็นที่สาธารณประโยชน์">
                            </datalist>
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ผู้ขอรังวัด</label>
                            <input type="text" name="applicant" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="ชื่อผู้ขอรังวัด" required>
                        </div>

                        <!-- Row 3: สรุปเรื่อง -->
                        <div class="col-span-full group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">สรุปเรื่อง</label>
                            <textarea name="summary" rows="3" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="รายละเอียดหรือสรุปเรื่องโดยย่อ..."></textarea>
                        </div>

                        <!-- Row 4: สถานะ และ คนคุม -->
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">สาเหตุที่ค้าง /สถานะ</label>
                            <input type="text" name="status_cause" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น รอดำเนินการ...">
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ประเภทความคืบหน้า</label>
                            <input type="hidden" name="progress_type" value="1">
                            <div class="w-full border-gray-200 bg-gray-100 rounded-lg p-3 border text-gray-500 text-sm">
                                <i class="fas fa-info-circle mr-1"></i> งานใหม่ — ตั้งเป็น "ปกติ" อัตโนมัติ
                            </div>
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">เลข รว.12</label>
                            <input type="text" name="rv_12" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น 123/2567">
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">คนคุมเรื่อง</label>
                            <input type="text" name="men" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="ชื่อผู้รับผิดชอบ">
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-amber-700 mb-2">วันที่นัดรังวัด</label>
                            <input type="date" name="survey_date" class="w-full border-amber-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500 p-3 bg-amber-50">
                        </div>
                    </div>
                    
                    <div class="mt-8">
                        <button type="submit" class="w-full bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-700 transition duration-300 shadow-lg transform hover:-translate-y-1">
                            <i class="fas fa-save mr-2"></i> บันทึกข้อมูลงานรังวัด
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    showSurveyDetail(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const statusValue = item.status_cause || item.status || '';
        const isCompleted = (item.completion_date && item.completion_date !== '0000-00-00') &&
            (statusValue === 'completed' || statusValue === 'เสร็จสิ้น' || !statusValue || statusValue === '');
        const progressType = item.progress_type || 4;

        const statusLabel = isCompleted
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">รอดำเนินการ</span>';

        //Get progress type badge
        const ptInfo = this.progressTypeLabels[progressType] || this.progressTypeLabels[4];
        const progressBadge = `<span class="px-2 py-1 rounded-full bg-${ptInfo.color}-100 text-${ptInfo.color}-700 text-xs font-bold ml-2">
            <i class="fas ${ptInfo.icon} mr-1"></i>${ptInfo.name}
        </span>`;

        content.innerHTML = `
            <div class="space-y-4">
                <!-- Header Info -->
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        <div class="flex items-center flex-wrap gap-2">
                            ${statusLabel}
                            ${progressBadge}
                        </div>
                        ${isCompleted ? `<div class="mt-1 text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> เสร็จสิ้นเมื่อ: ${this.formatDate(item.completion_date)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatDate(item.received_date)}</span>
                        <div class="text-xs text-gray-400">ลำดับที่: ${item.received_seq}</div>
                    </div>
                </div>

                <!-- Main Details -->
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 class="font-bold text-gray-700 mb-3 border-b pb-2">ข้อมูลงานรังวัด</h4>
                    <div class="space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-4">
                            <p><span class="text-gray-500">ประเภทการรังวัด:</span> <span class="font-medium">${item.survey_type || '-'}</span></p>
                            <p><span class="text-gray-500">ผู้ขอรังวัด:</span> <span class="font-medium">${item.applicant || '-'}</span></p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <p><span class="text-gray-500 font-bold text-indigo-600">เลข รว.12:</span> <span class="font-black text-indigo-700">${item.rv_12 || '-'}</span></p>
                            <p><span class="text-gray-500">คนคุมเรื่อง:</span> <span class="font-medium">${item.men || '-'}</span></p>
                        </div>
                        ${item.summary ? `<p><span class="text-gray-500">สรุปเรื่อง:</span> <span class="font-medium">${item.summary}</span></p>` : ''}
                        <div class="grid grid-cols-2 gap-4">
                            ${statusValue ? `<p><span class="text-gray-500">สาเหตุที่ค้าง:</span> <span class="font-medium">${statusValue}</span></p>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Progress Type Checkboxes -->
                ${this.renderProgressTypeCheckboxes(progressType, item.id, 'survey', item.received_date)}

                <!-- Status Management Tool -->
                <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                    <h4 class="font-extrabold text-emerald-900 mb-4 flex items-center">
                        <i class="fas fa-tools mr-2"></i> จัดการสถานะงาน
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-emerald-700 mb-2">สาเหตุที่ค้าง /สถานะ</label>
                            <input type="text" id="update-status-input" value="${statusValue}" 
                                class="w-full border-emerald-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent" 
                                placeholder="เช่น รอดำเนินการ...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-indigo-700 mb-2">เลข รว.12</label>
                            <input type="text" id="update-rv12-input" value="${item.rv_12 || ''}" 
                                class="w-full border-indigo-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" 
                                placeholder="ระบุเลข รว.12">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-emerald-700 mb-2">วันที่ทำรายการเสร็จ</label>
                            <input type="date" id="update-completion-date" value="${item.completion_date || ''}" 
                                class="w-full border-emerald-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-amber-700 mb-2">วันที่นัดรังวัด</label>
                            <input type="date" id="update-survey-date" value="${item.survey_date || ''}" 
                                class="w-full border-amber-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent">
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="app.sendToRegistration('${item.id}', 'survey')" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-md">
                            <i class="fas fa-paper-plane mr-2"></i> บันทึกส่งฝ่ายทะเบียน
                        </button>
                        <button onclick="app.saveStatusUpdate('${item.id}', 'survey')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-md">
                            <i class="fas fa-save mr-2"></i> บันทึก
                        </button>
                        <button onclick="app.deleteWork('${item.id}', 'survey')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-md ml-auto">
                            <i class="fas fa-trash-alt mr-2"></i> ลบงาน
                        </button>
                    </div>
                </div>

                <!-- History Section -->
                ${this.renderHistorySection(item.id, 'survey')}
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);

        //Load history
        app.loadStatusHistory(item.id, 'survey');
    },


    showRegistrationDetail(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const isCompleted = (item.completion_date && item.completion_date !== '0000-00-00') &&
            (item.status_cause === 'completed' || item.status_cause === 'เสร็จสิ้น' || !item.status_cause || item.status_cause === '');
        const progressType = item.progress_type || 4;

        const statusLabel = isCompleted
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">รอดำเนินการ</span>';

        const ptInfo = this.progressTypeLabels[progressType] || this.progressTypeLabels[4];
        const progressBadge = `<span class="px-2 py-1 rounded-full bg-${ptInfo.color}-100 text-${ptInfo.color}-700 text-xs font-bold ml-2">
            <i class="fas ${ptInfo.icon} mr-1"></i>${ptInfo.name}
        </span>`;

        content.innerHTML = `
            <div class="space-y-4">
                <!-- Header Info -->
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        <div class="flex items-center flex-wrap gap-2">
                            ${statusLabel}
                            ${progressBadge}
                        </div>
                        ${isCompleted ? `<div class="mt-1 text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> เสร็จสิ้นเมื่อ: ${this.formatDate(item.completion_date)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatThaiDate(item.received_date)}</span>
                        <div class="text-xs text-gray-400">เลขที่: ${item.seq_no}</div>
                    </div>
                </div>

                <!-- Main Details -->
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">รายละเอียดงาน</h4>
                    <div class="space-y-3 text-sm">
                        <p><span class="text-gray-500 font-bold">เรื่อง:</span> <span class="font-medium text-gray-800">${item.subject}</span></p>
                        <p><span class="text-gray-500 font-bold">ผู้เกี่ยวข้อง:</span> <span class="font-medium text-gray-800">${item.related_person || '-'}</span></p>
                        <div class="bg-white p-3 rounded-lg border border-gray-100">
                            <span class="text-gray-500 block mb-1">สรุปเรื่อง/สาเหตุที่ค้าง:</span>
                            <span class="font-medium text-gray-700">${item.summary || item.status_cause || '-'}</span>
                        </div>
                        <p><span class="text-gray-500 font-bold">ผู้รับผิดชอบ:</span> <span class="font-medium text-gray-800">${item.responsible_person || '-'}</span></p>
                    </div>
                </div>

                <!-- Progress Type Checkboxes -->
                ${this.renderProgressTypeCheckboxes(progressType, item.id, 'registration', item.received_date)}

                <!-- Status Management Tool -->
                <div class="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                    <h4 class="font-extrabold text-indigo-900 mb-4 flex items-center">
                        <i class="fas fa-tools mr-2"></i> เครื่องมือจัดการสถานะ
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-indigo-700 mb-2">ระบุสถานะงาน/สาเหตุ</label>
                            <input type="text" id="update-status-input" value="${item.status_cause || ''}"
                                class="w-full border-indigo-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                                placeholder="เช่น รอดำเนินการ, รอคู่กรณี...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-indigo-700 mb-2">วันที่ทำรายการเสร็จ</label>
                            <input type="date" id="update-completion-date" value="${item.completion_date || ''}"
                                class="w-full border-indigo-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="app.quickUpdateStatus('${item.id}', 'registration', 'completed')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md">
                            <i class="fas fa-check-double mr-2"></i> เสร็จสิ้นวันนี้
                        </button>
                        <button onclick="app.saveStatusUpdate('${item.id}', 'registration')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-md">
                            <i class="fas fa-save mr-2"></i> บันทึก
                        </button>
                        <button onclick="app.deleteWork('${item.id}', 'registration')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-md ml-auto">
                            <i class="fas fa-trash-alt mr-2"></i> ลบงาน
                        </button>
                    </div>
                </div>

                <!-- History Section -->
                ${this.renderHistorySection(item.id, 'registration')}
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);

        //Load history
        app.loadStatusHistory(item.id, 'registration');
    },


    showAcademicDetail(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const isCompleted = (item.completion_date && item.completion_date !== '0000-00-00') &&
            (item.status_cause === 'completed' || item.status_cause === 'เสร็จสิ้น' || !item.status_cause || item.status_cause === '');
        const progressType = item.progress_type || 4;

        const statusLabel = isCompleted
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">รอดำเนินการ</span>';

        const ptInfo = this.progressTypeLabels[progressType] || this.progressTypeLabels[4];
        const progressBadge = `<span class="px-2 py-1 rounded-full bg-${ptInfo.color}-100 text-${ptInfo.color}-700 text-xs font-bold ml-2">
            <i class="fas ${ptInfo.icon} mr-1"></i>${ptInfo.name}
        </span>`;

        content.innerHTML = `
            <div class="space-y-4">
                <!-- Header Info -->
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        <div class="flex items-center flex-wrap gap-2">
                            ${statusLabel}
                            ${progressBadge}
                        </div>
                        ${isCompleted ? `<div class="mt-1 text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> เสร็จสิ้นเมื่อ: ${this.formatDate(item.completion_date)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatThaiDate(item.received_date)}</span>
                        <div class="text-xs text-gray-400">เลขที่: ${item.seq_no}</div>
                    </div>
                </div>

                <!-- Main Details -->
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">รายละเอียดงานวิชาการ</h4>
                    <div class="space-y-3 text-sm">
                        <p><span class="text-gray-500 font-bold">เรื่อง:</span> <span class="font-medium text-gray-800">${item.subject}</span></p>
                        <p><span class="text-gray-500 font-bold">ผู้เกี่ยวข้อง:</span> <span class="font-medium text-gray-800">${item.related_person || '-'}</span></p>
                        <div class="bg-white p-3 rounded-lg border border-gray-100">
                            <span class="text-gray-500 block mb-1">สรุปเรื่อง/สาเหตุที่ค้าง:</span>
                            <span class="font-medium text-gray-700">${item.summary || item.status_cause || '-'}</span>
                        </div>
                        <p><span class="text-gray-500 font-bold">ผู้รับผิดชอบ:</span> <span class="font-medium text-gray-800">${item.responsible_person || '-'}</span></p>
                    </div>
                </div>

                <!-- Progress Type Checkboxes -->
                ${this.renderProgressTypeCheckboxes(progressType, item.id, 'academic', item.received_date)}

                <!-- Status Management Tool -->
                <div class="bg-orange-50 p-5 rounded-2xl border border-orange-100 shadow-sm">
                    <h4 class="font-extrabold text-orange-900 mb-4 flex items-center">
                        <i class="fas fa-tools mr-2"></i> เครื่องมือจัดการสถานะ
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-orange-700 mb-2">ระบุสถานะงาน/สาเหตุ</label>
                            <input type="text" id="update-status-input" value="${item.status_cause || ''}"
                                class="w-full border-orange-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                                placeholder="เช่น รอดำเนินการ, รอผลวินิจฉัย...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-orange-700 mb-2">วันที่ทำรายการเสร็จ</label>
                            <input type="date" id="update-completion-date" value="${item.completion_date || ''}"
                                class="w-full border-orange-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent">
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="app.quickUpdateStatus('${item.id}', 'academic', 'completed')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md">
                            <i class="fas fa-check-double mr-2"></i> เสร็จสิ้นวันนี้
                        </button>
                        <button onclick="app.saveStatusUpdate('${item.id}', 'academic')" class="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 transition shadow-md">
                            <i class="fas fa-save mr-2"></i> บันทึก
                        </button>
                        <button onclick="app.deleteWork('${item.id}', 'academic')" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-md ml-auto">
                            <i class="fas fa-trash-alt mr-2"></i> ลบงาน
                        </button>
                    </div>
                </div>

                <!-- History Section -->
                ${this.renderHistorySection(item.id, 'academic')}
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);

        //Load history
        app.loadStatusHistory(item.id, 'academic');
    },


    renderAddForm(type) {
        if (type === 'survey') {
            return `
                <div>
                    <!-- Auto-generated received_seq -->
                    <label class="block text-sm font-medium text-gray-700">ลำดับรับ (Received Seq)</label>
                    <input type="text" name="received_seq" disabled placeholder="สร้างอัตโนมัติ (Auto)" class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่รับเรื่อง (Date)</label>
                    <input type="date" name="received_date" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">สถานะ (Status)</label>
                    <input type="text" name="status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2" placeholder="ระบุสถานะ...">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">เลขที่ ร.ว. 12</label>
                    <input type="text" name="rv_12" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ประเภทการรังวัด</label>
                    <input type="text" name="survey_type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้ขอ (Applicant)</label>
                    <input type="text" name="applicant" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ช่างรังวัด</label>
                    <input type="text" name="men" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
`;
        } else if (type === 'registration' || type === 'academic') {
            const context = type === 'registration' ? 'ทะเบียน' : 'วิชาการ';
            return `
                <div>
                    <!-- Auto-generated seq_no -->
                    <label class="block text-sm font-medium text-gray-700">ลำดับที่ (Seq No)</label>
                    <input type="text" name="seq_no" disabled placeholder="สร้างอัตโนมัติ (Auto)" class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่รับเรื่อง</label>
                    <input type="date" name="received_date" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">สถานะ/สาเหตุ (Status Cause)</label>
                    <input type="text" name="status_cause" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2" placeholder="ระบุสถานะ/สาเหตุ...">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">เรื่อง (Subject)</label>
                    <input type="text" name="subject" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้เกี่ยวข้อง/คู่กรณี</label>
                    <input type="text" name="related_person" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">สรุปเรื่อง (Summary)</label>
                    <textarea name="summary" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ประเภทความคืบหน้า</label>
                    <select name="progress_type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                        <option value="1">ปกติ</option>
                        <option value="2">สุดขั้นตอน</option>
                        <option value="3">งานศาล</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ผู้รับผิดชอบ</label>
                    <input type="text" name="responsible_person" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
`;
        }
        return '';
    },

    //--- Admin Department Views ---
    //--- Admin Department Views ---
    async renderAdminList(items, searchTerm = '', sortOrder = 'desc', subjectFilter = 'all', page = 1, limit = 20, statusView = 'pending') {
        const fullItems = await DataManager.getAdminItems();
        const subjects = [...new Set(fullItems.map(i => i.subject).filter(Boolean))];

        // Process data (Sort by ID)
        let processedItems = [...items];
        processedItems.sort((a, b) => {
            const idA = parseInt(a.id, 10) || 0;
            const idB = parseInt(b.id, 10) || 0;
            return sortOrder === 'asc' ? (idA - idB) : (idB - idA);
        });

        let displayItems = processedItems;
        if (subjectFilter && subjectFilter !== 'all') {
            displayItems = displayItems.filter(i => i.subject === subjectFilter);
        }

        const totalItems = displayItems.length;

        let html = `
                            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4" data-aos="fade-down">
                <h3 class="font-bold text-3xl flex items-center self-start md:self-auto group">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 mr-4 transform group-hover:scale-105 transition-transform duration-300">
                        <i class="fas fa-building text-white text-xl"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-0.5">Department</span>
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 group-hover:from-emerald-600 group-hover:to-teal-600 transition-all duration-300">งานฝ่ายอำนวยการ</span>
                    </div>
                    <span class="bg-emerald-50 text-emerald-700 text-sm font-bold px-3 py-1 rounded-full ml-4 border border-emerald-100 shadow-sm flex items-center">
                        <i class="fas fa-file-alt mr-1.5 text-xs"></i> <span id="admin-total-items">${totalItems}</span> รายการ
                    </span>
                </h3>
                
                <div class="flex flex-wrap gap-2 w-full md:w-auto justify-end items-center">
                    <!-- Tab Switcher -->
                    <div class="flex bg-gray-100 p-1 rounded-xl mr-2">
                        <button onclick="app.setAdminStatusView('pending')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'pending' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานคงค้าง
                        </button>
                        <button onclick="app.setAdminStatusView('completed')" 
                            class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusView === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
                            งานที่เสร็จแล้ว
                        </button>
                    </div>

                     <!-- Subject Filter -->
                     <select onchange="app.filterAdminSubject(this.value)" class="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 shadow-sm max-w-[200px] truncate">
                          <option value="all" ${subjectFilter === 'all' ? 'selected' : ''}>-- ทุกเรื่อง --</option>
                          ${subjects.map(t => `<option value="${t}" ${subjectFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                     </select>

                    <!-- Progress Type Filter -->
                    <select onchange="app.filterAdminProgress(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-teal-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer bg-teal-50">
                        <option value="all" ${app.adminProgressFilter === 'all' || !app.adminProgressFilter ? 'selected' : ''}>-- ทุกสถานะ --</option>
                        <option value="2" ${app.adminProgressFilter === '2' ? 'selected' : ''}>สุดขั้นตอน</option>
                        <option value="3" ${app.adminProgressFilter === '3' ? 'selected' : ''}>งานศาล</option>
                        <option value="4" ${app.adminProgressFilter === '4' ? 'selected' : ''}>งานค้าง</option>
                    </select>

                    <!-- Month Filter (Completed Only) -->
                    ${statusView === 'completed' ? `
                    <select onchange="app.filterAdminMonth(this.value)" class="py-2 pl-3 pr-8 rounded-lg border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-emerald-50">
                        <option value="all" ${app.adminMonthFilter === 'all' ? 'selected' : ''}>-- ทุกเดือน (เสร็จ) --</option>
                        ${this.thaiMonths.map((m, i) => `<option value="${i + 1}" ${parseInt(app.adminMonthFilter) === (i + 1) ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    ` : ''}

                    <div class="flex bg-emerald-50 p-1.5 rounded-2xl mr-2 shadow-inner border border-emerald-100">
                        <button onclick="app.sortAdminList('desc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'desc' ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300 transform scale-105' : 'text-emerald-400 hover:text-emerald-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-down-9-1 mr-2 scale-110"></i> ใหม่ไปเก่า
                        </button>
                        <button onclick="app.sortAdminList('asc')" 
                            class="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center ${sortOrder === 'asc' ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300 transform scale-105' : 'text-emerald-400 hover:text-emerald-600 hover:bg-white/50'}">
                            <i class="fas fa-arrow-up-1-9 mr-2 scale-110"></i> เก่ามาใหม่
                        </button>
                    </div>

                <button onclick="app.exportDepartmentToExcel('admin')" class="bg-white border border-emerald-200 text-emerald-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-file-excel mr-2"></i> ส่งออก Excel
                    </button>

                    <button onclick="app.openAddModal('admin')" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-emerald-500/30 transform hover:-translate-y-0.5 flex items-center justify-center whitespace-nowrap">
                        <i class="fas fa-plus mr-2"></i> เพิ่มงาน
                    </button>
                </div>
            </div>

            <div id="admin-list-container" class="space-y-4" data-aos="fade-up">
                ${this.renderAdminItems(displayItems)}
            </div>`;
        return html;
    },

    async updateAdminList(items, searchTerm, subjectFilter, page, limit) {
        //Pagination Logic
        let displayItems = items;
        if (subjectFilter && subjectFilter !== 'all') {
            displayItems = displayItems.filter(i => i.subject === subjectFilter);
        }

        const totalItems = displayItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const start = (page - 1) * limit;
        const currentItems = displayItems.slice(start, start + limit);

        //Update Total Count
        const countDisplay = document.getElementById('admin-total-items');
        if (countDisplay) countDisplay.innerText = totalItems;

        //Update List Items
        const container = document.getElementById('admin-list-container');
        if (container) {
            container.innerHTML = this.renderAdminItems(displayItems, page, totalPages, totalItems, start, limit);
        }
    },

    renderAdminItems(items) {
        let html = '';
        if (items.length === 0) {
            html += `<div class="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400"> ไม่พบข้อมูล</div> `;
        } else {
            //Mobile View (Cards)
            html += `<div class="grid grid-cols-1 gap-4 md:hidden"> `;
            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);
                let statusBadge = '';
                let statusText = item.status_cause || '-';
                let statusColor = "bg-emerald-50 text-emerald-600";

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted) {
                    statusColor = "bg-gray-100 text-gray-500";
                } else if (diffDays > 30) {
                    statusColor = "bg-teal-100 text-teal-800 animate-pulse border border-teal-200";
                    statusText = `🚨 ${statusText} `;
                }

                html += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative overflow-hidden group hover:shadow-md transition-all">
                        <div class="flex justify-between items-start mb-3">
                            <span class="text-gray-400 font-mono text-xs">#${item.seq_no}</span>
                            <span class="${statusColor} text-xs px-2 py-1 rounded-md font-bold">${statusText}</span>
                        </div>
                        <div class="mb-3">
                            <h4 class="font-bold text-gray-800 text-lg mb-1">${item.subject}</h4>
                            <p class="text-sm text-gray-600"><i class="fas fa-user mr-1.5 text-gray-400"></i>${item.related_person}</p>
                        </div>
                         <div class="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3 mt-2">
                             <div class="flex items-center">
                                <i class="far fa-calendar-alt mr-1.5"></i> ${formattedDate}
                                ${(statusText !== 'เสร็จสิ้น' && statusText !== 'ยกเลิก') ? `<span class="ml-1 text-[10px] text-teal-500">(${diffDays} วัน)</span>` : ''} 
                             </div>
                             <div class="flex items-center font-medium text-gray-700">
                                <i class="fas fa-user-tag mr-1.5 text-emerald-400"></i> ${item.responsible_person || '-'}
                             </div>
                        </div>
                    </div>
            `;
            });
            html += `</div> `;

            //Desktop View (Table) - DataTables will handle pagination
            html += `
            <div class="hidden md:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <table id="admin-datatable" class="w-full text-left border-collapse display">
                    <thead class="bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                        <tr>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center" style="width: 60px;">ที่</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center" style="width: 100px;">วันที่รับ</th>
                            <th class="px-4 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider">เรื่อง</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider" style="width: 150px;">ผู้เกี่ยวข้อง</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-teal-600 uppercase tracking-wider text-center" style="width: 120px;">สาเหตุค้าง</th>
                            <th class="px-3 py-3 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center" style="width: 80px;">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;

            items.forEach(item => {
                const formattedDate = this.formatThaiDate(item.received_date);
                const diffDays = this.calculateDiffDays(item.received_date);
                let statusBadge = '';
                let statusText = item.status_cause || '-';
                let rowClass = "hover:bg-emerald-50/50 transition-all duration-200 group";

                const isCompleted = DataManager.isCompleted(item);
                if (isCompleted) {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded bg-gray-100 text-gray-500">${statusText}</span>`;
                    rowClass += " opacity-60 bg-gray-50";
                } else if (diffDays > 60) {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-bold rounded bg-teal-100 text-teal-700 animate-pulse">🔥 ${diffDays}วัน</span>`;
                    rowClass = "bg-teal-50/40 hover:bg-teal-100/50 border-l-4 border-teal-500";
                } else if (diffDays > 30) {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-bold rounded bg-emerald-100 text-emerald-700">⚠️ ${diffDays}วัน</span>`;
                    rowClass = "bg-emerald-50/40 hover:bg-emerald-100/50 border-l-4 border-emerald-400";
                } else {
                    statusBadge = `<span class="px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded bg-blue-50 text-blue-700">${statusText || diffDays + 'วัน'}</span>`;
                }

                html += `
                        <tr class="${rowClass}">
                            <td class="px-3 py-3 text-center text-sm font-mono text-gray-500">${item.seq_no || '-'}</td>
                            <td class="px-3 py-3 text-center text-sm text-gray-700">
                                <div class="font-semibold">${formattedDate}</div>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-800">
                                <div class="font-medium leading-relaxed">${item.subject || '-'}</div>
                            </td>
                            <td class="px-3 py-3 text-sm text-gray-600">${item.related_person || '-'}</td>
                            <td class="px-3 py-3 text-center">${statusBadge}</td>
                            <td class="px-3 py-3 text-center">
                                <button onclick="app.viewAdminDetail('${item.id}')"
                                    class="inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow hover:shadow-lg hover:scale-105 transition-all">
                                    <i class="fas fa-eye mr-1"></i> ดู
                                </button>
                            </td>
                        </tr>
                        `;
            });
            html += `</tbody></table></div> `;
        }
        return html;
    },
    renderAdminForm() {
        return `
                            <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-xl p-8 border border-gray-100" data-aos="fade-up">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-gray-800 flex items-center">
                        <span class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 mr-3">
                            <i class="fas fa-building"></i>
                        </span>
                        บันทึกงานใหม่ (ฝ่ายอำนวยการ)
                    </h3>
                    <button onclick="app.navigate('admin_list')" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <form id="add-admin-form" onsubmit="app.handleAdminSubmit(event)">
                    <div class="grid grid-cols-1 gap-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">ที่ (เลขหนังสือ) <span class="text-teal-500">*</span></label>
                                <input type="text" name="seq_no" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" requiteal>
                            </div>
                            <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">วันที่รับเรื่อง <span class="text-teal-500">*</span></label>
                                <input type="date" name="received_date" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" requiteal>
                            </div>
                        </div>

                        <div class="group">
                            <label class="block text-gray-700 font-semibold mb-2">เรื่อง <span class="text-teal-500">*</span></label>
                            <input type="text" name="subject" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" requiteal>
                        </div>

                        <div class="group">
                             <label class="block text-gray-700 font-semibold mb-2">ผู้ที่เกี่ยวข้อง (คู่กรณี)</label>
                             <input type="text" name="related_person" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none">
                        </div>

                        <div class="group">
                            <label class="block text-gray-700 font-semibold mb-2">ความสำคัญของเรื่อง (โดยสรุป)</label>
                            <textarea name="summary" rows="3" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"></textarea>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">สาเหตุที่ค้าง (สถานะ)</label>
                                <input type="text" name="status_cause" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" placeholder="เช่น รอตรวจสอบ, เสนอลงนาม">
                            </div>
                            <div class="group">
                                <label class="block text-gray-700 font-semibold mb-2">ประเภทความคืบหน้า</label>
                                <input type="hidden" name="progress_type" value="1">
                                <div class="w-full border-gray-200 bg-gray-100 rounded-lg p-3 border text-gray-500 text-sm">
                                    <i class="fas fa-info-circle mr-1"></i> งานใหม่ — ตั้งเป็น "ปกติ" อัตโนมัติ
                                </div>
                            </div>
                        </div>

                        <div class="group">
                            <label class="block text-gray-700 font-semibold mb-2">ผู้รับผิดชอบ <span class="text-teal-500">*</span></label>
                            <input type="text" name="responsible_person" class="w-full border-gray-200 bg-gray-50 rounded-lg p-3 border focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none" requiteal>
                        </div>

                        <div class="pt-6">
                            <button type="submit" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 px-4 rounded-lg hover:from-emerald-700 hover:to-teal-700 transition duration-300 shadow-md transform hover:-translate-y-1">
                                <i class="fas fa-save mr-2"></i> บันทึกข้อมูล
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            `;
    },

    renderSurveyForm() {
        return `
            <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-xl p-8 border border-gray-100" data-aos="fade-up">
                <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-gray-800">บันทึกงานรังวัดใหม่</h3>
                    <button onclick="app.navigate('survey_list')" class="text-gray-500 hover:text-gray-700 text-sm"><i class="fas fa-arrow-left mr-1"></i> กลับหน้ารายการ</button>
                </div>
                
                <form id="add-survey-form" onsubmit="app.handleSurveySubmit(event)">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Row 1: ลำดับ และ วันที่ -->
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ลำดับที่</label>
                            <input type="text" name="received_seq" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น 1, 2, 3..." requiteal>
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">วันที่รับเรื่อง</label>
                            <input type="date" name="received_date" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" requiteal>
                        </div>

                        <!-- Row 2: ประเภท และ ผู้ขอ -->
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ประเภทการรังวัด</label>
                            <input type="text" name="survey_type" list="survey_types" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น สอบเขต, แบ่งแยก...">
                            <datalist id="survey_types">
                                <option value="สอบเขตโฉนดที่ดิน">
                                <option value="แบ่งแยกในนามเดิม">
                                <option value="รวมโฉนด">
                                <option value="แบ่งกรรมสิทธิ์รวม">
                                <option value="แบ่งหักเป็นที่สาธารณประโยชน์">
                            </datalist>
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ผู้ขอรังวัด</label>
                            <input type="text" name="applicant" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="ชื่อผู้ขอรังวัด" requiteal>
                        </div>

                        <!-- Row 3: สรุปเรื่อง -->
                        <div class="col-span-full group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">สรุปเรื่อง</label>
                            <textarea name="summary" rows="3" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="รายละเอียดหรือสรุปเรื่องโดยย่อ..."></textarea>
                        </div>

                        <!-- Row 4: สถานะ และ คนคุม -->
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">สาเหตุที่ค้าง /สถานะ</label>
                            <input type="text" name="status_cause" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น รอดำเนินการ...">
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ประเภทความคืบหน้า</label>
                            <input type="hidden" name="progress_type" value="1">
                            <div class="w-full border-gray-200 bg-gray-100 rounded-lg p-3 border text-gray-500 text-sm">
                                <i class="fas fa-info-circle mr-1"></i> งานใหม่ — ตั้งเป็น "ปกติ" อัตโนมัติ
                            </div>
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">เลข รว.12</label>
                            <input type="text" name="rv_12" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="เช่น 123/2567">
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">คนคุมเรื่อง</label>
                            <input type="text" name="men" class="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-3 bg-white" placeholder="ชื่อผู้รับผิดชอบ">
                        </div>
                        <div class="group">
                            <label class="block text-sm font-semibold text-green-700 mb-2">วันที่นัดรังวัด</label>
                            <input type="date" name="survey_date" class="w-full border-green-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 p-3 bg-green-50">
                        </div>
                    </div>
                    
                    <div class="mt-8">
                        <button type="submit" class="w-full bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-700 transition duration-300 shadow-lg transform hover:-translate-y-1">
                            <i class="fas fa-save mr-2"></i> บันทึกข้อมูลงานรังวัด
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    showSurveyDetail(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const statusValue = item.status_cause || item.status || '';
        const isCompleted = (item.completion_date && item.completion_date !== '0000-00-00') &&
            (statusValue === 'completed' || statusValue === 'เสร็จสิ้น' || !statusValue || statusValue === '');
        const progressType = item.progress_type || 4;

        const statusLabel = isCompleted
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">รอดำเนินการ</span>';

        //Get progress type badge
        const ptInfo = this.progressTypeLabels[progressType] || this.progressTypeLabels[4];
        const progressBadge = `<span class="px-2 py-1 rounded-full bg-${ptInfo.color}-100 text-${ptInfo.color}-700 text-xs font-bold ml-2">
            <i class="fas ${ptInfo.icon} mr-1"></i>${ptInfo.name}
        </span>`;

        content.innerHTML = `
            <div class="space-y-4">
                <!-- Header Info -->
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        <div class="flex items-center flex-wrap gap-2">
                            ${statusLabel}
                            ${progressBadge}
                        </div>
                        ${isCompleted ? `<div class="mt-1 text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> เสร็จสิ้นเมื่อ: ${this.formatDate(item.completion_date)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatDate(item.received_date)}</span>
                        <div class="text-xs text-gray-400">ลำดับที่: ${item.received_seq}</div>
                    </div>
                </div>

                <!-- Main Details -->
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 class="font-bold text-gray-700 mb-3 border-b pb-2">ข้อมูลงานรังวัด</h4>
                    <div class="space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-4">
                            <p><span class="text-gray-500">ประเภทการรังวัด:</span> <span class="font-medium">${item.survey_type || '-'}</span></p>
                            <p><span class="text-gray-500">ผู้ขอรังวัด:</span> <span class="font-medium">${item.applicant || '-'}</span></p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <p><span class="text-gray-500 font-bold text-indigo-600">เลข รว.12:</span> <span class="font-black text-indigo-700">${item.rv_12 || '-'}</span></p>
                            <p><span class="text-gray-500">คนคุมเรื่อง:</span> <span class="font-medium">${item.men || '-'}</span></p>
                        </div>
                        ${item.summary ? `<p><span class="text-gray-500">สรุปเรื่อง:</span> <span class="font-medium">${item.summary}</span></p>` : ''}
                        <div class="grid grid-cols-2 gap-4">
                            ${statusValue ? `<p><span class="text-gray-500">สาเหตุที่ค้าง:</span> <span class="font-medium">${statusValue}</span></p>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Progress Type Checkboxes -->
                ${this.renderProgressTypeCheckboxes(progressType, item.id, 'survey', item.received_date)}

                <!-- Status Management Tool -->
                <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                    <h4 class="font-extrabold text-emerald-900 mb-4 flex items-center">
                        <i class="fas fa-tools mr-2"></i> จัดการสถานะงาน
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-emerald-700 mb-2">สาเหตุที่ค้าง /สถานะ</label>
                            <input type="text" id="update-status-input" value="${statusValue}" 
                                class="w-full border-emerald-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent" 
                                placeholder="เช่น รอดำเนินการ...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-indigo-700 mb-2">เลข รว.12</label>
                            <input type="text" id="update-rv12-input" value="${item.rv_12 || ''}" 
                                class="w-full border-indigo-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" 
                                placeholder="ระบุเลข รว.12">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-emerald-700 mb-2">วันที่ทำรายการเสร็จ</label>
                            <input type="date" id="update-completion-date" value="${item.completion_date || ''}" 
                                class="w-full border-emerald-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-green-700 mb-2">วันที่นัดรังวัด</label>
                            <input type="date" id="update-survey-date" value="${item.survey_date || ''}" 
                                class="w-full border-green-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent">
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="app.sendToRegistration('${item.id}', 'survey')" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-md">
                            <i class="fas fa-paper-plane mr-2"></i> บันทึกส่งฝ่ายทะเบียน
                        </button>
                        <button onclick="app.saveStatusUpdate('${item.id}', 'survey')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-md">
                            <i class="fas fa-save mr-2"></i> บันทึก
                        </button>
                        <button onclick="app.deleteWork('${item.id}', 'survey')" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-md ml-auto">
                            <i class="fas fa-trash-alt mr-2"></i> ลบงาน
                        </button>
                    </div>
                </div>

                <!-- History Section -->
                ${this.renderHistorySection(item.id, 'survey')}
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);

        //Load history
        app.loadStatusHistory(item.id, 'survey');
    },


    showRegistrationDetail(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const isCompleted = (item.completion_date && item.completion_date !== '0000-00-00') &&
            (item.status_cause === 'completed' || item.status_cause === 'เสร็จสิ้น' || !item.status_cause || item.status_cause === '');
        const progressType = item.progress_type || 4;

        const statusLabel = isCompleted
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">รอดำเนินการ</span>';

        const ptInfo = this.progressTypeLabels[progressType] || this.progressTypeLabels[4];
        const progressBadge = `<span class="px-2 py-1 rounded-full bg-${ptInfo.color}-100 text-${ptInfo.color}-700 text-xs font-bold ml-2">
            <i class="fas ${ptInfo.icon} mr-1"></i>${ptInfo.name}
        </span>`;

        content.innerHTML = `
            <div class="space-y-4">
                <!-- Header Info -->
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        <div class="flex items-center flex-wrap gap-2">
                            ${statusLabel}
                            ${progressBadge}
                        </div>
                        ${isCompleted ? `<div class="mt-1 text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> เสร็จสิ้นเมื่อ: ${this.formatDate(item.completion_date)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatThaiDate(item.received_date)}</span>
                        <div class="text-xs text-gray-400">เลขที่: ${item.seq_no}</div>
                    </div>
                </div>

                <!-- Main Details -->
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">รายละเอียดงาน</h4>
                    <div class="space-y-3 text-sm">
                        <p><span class="text-gray-500 font-bold">เรื่อง:</span> <span class="font-medium text-gray-800">${item.subject}</span></p>
                        <p><span class="text-gray-500 font-bold">ผู้เกี่ยวข้อง:</span> <span class="font-medium text-gray-800">${item.related_person || '-'}</span></p>
                        <div class="bg-white p-3 rounded-lg border border-gray-100">
                            <span class="text-gray-500 block mb-1">สรุปเรื่อง/สาเหตุที่ค้าง:</span>
                            <span class="font-medium text-gray-700">${item.summary || item.status_cause || '-'}</span>
                        </div>
                        <p><span class="text-gray-500 font-bold">ผู้รับผิดชอบ:</span> <span class="font-medium text-gray-800">${item.responsible_person || '-'}</span></p>
                    </div>
                </div>

                <!-- Progress Type Checkboxes -->
                ${this.renderProgressTypeCheckboxes(progressType, item.id, 'registration', item.received_date)}

                <!-- Status Management Tool -->
                <div class="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                    <h4 class="font-extrabold text-indigo-900 mb-4 flex items-center">
                        <i class="fas fa-tools mr-2"></i> เครื่องมือจัดการสถานะ
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-indigo-700 mb-2">ระบุสถานะงาน/สาเหตุ</label>
                            <input type="text" id="update-status-input" value="${item.status_cause || ''}"
                                class="w-full border-indigo-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                                placeholder="เช่น รอดำเนินการ, รอคู่กรณี...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-indigo-700 mb-2">วันที่ทำรายการเสร็จ</label>
                            <input type="date" id="update-completion-date" value="${item.completion_date || ''}"
                                class="w-full border-indigo-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="app.quickUpdateStatus('${item.id}', 'registration', 'completed')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md">
                            <i class="fas fa-check-double mr-2"></i> เสร็จสิ้นวันนี้
                        </button>
                        <button onclick="app.saveStatusUpdate('${item.id}', 'registration')" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-md">
                            <i class="fas fa-save mr-2"></i> บันทึก
                        </button>
                        <button onclick="app.deleteWork('${item.id}', 'registration')" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-md ml-auto">
                            <i class="fas fa-trash-alt mr-2"></i> ลบงาน
                        </button>
                    </div>
                </div>

                <!-- History Section -->
                ${this.renderHistorySection(item.id, 'registration')}
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);

        //Load history
        app.loadStatusHistory(item.id, 'registration');
    },


    showAdminDetail(item) {
        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');

        if (!modal || !content) return;

        const isCompleted = (item.completion_date && item.completion_date !== '0000-00-00') &&
            (item.status_cause === 'completed' || item.status_cause === 'เสร็จสิ้น' || !item.status_cause || item.status_cause === '');
        const progressType = item.progress_type || 4;

        const statusLabel = isCompleted
            ? '<span class="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold">เสร็จสิ้นแล้ว</span>'
            : '<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">รอดำเนินการ</span>';

        const ptInfo = this.progressTypeLabels[progressType] || this.progressTypeLabels[4];
        const progressBadge = `<span class="px-2 py-1 rounded-full bg-${ptInfo.color}-100 text-${ptInfo.color}-700 text-xs font-bold ml-2">
            <i class="fas ${ptInfo.icon} mr-1"></i>${ptInfo.name}
        </span>`;

        content.innerHTML = `
            <div class="space-y-4">
                <!-- Header Info -->
                <div class="flex justify-between items-start border-b border-gray-100 pb-4">
                    <div>
                        <label class="block text-sm text-gray-500 mb-1">สถานะปัจจุบัน</label>
                        <div class="flex items-center flex-wrap gap-2">
                            ${statusLabel}
                            ${progressBadge}
                        </div>
                        ${isCompleted ? `<div class="mt-1 text-xs text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> เสร็จสิ้นเมื่อ: ${this.formatDate(item.completion_date)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <label class="block text-sm text-gray-500 mb-1">วันที่รับเรื่อง</label>
                        <span class="text-lg font-semibold text-gray-800">${this.formatThaiDate(item.received_date)}</span>
                        <div class="text-xs text-gray-400">เลขที่: ${item.seq_no}</div>
                    </div>
                </div>

                <!-- Main Details -->
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">รายละเอียดงานวิชาการ</h4>
                    <div class="space-y-3 text-sm">
                        <p><span class="text-gray-500 font-bold">เรื่อง:</span> <span class="font-medium text-gray-800">${item.subject}</span></p>
                        <p><span class="text-gray-500 font-bold">ผู้เกี่ยวข้อง:</span> <span class="font-medium text-gray-800">${item.related_person || '-'}</span></p>
                        <div class="bg-white p-3 rounded-lg border border-gray-100">
                            <span class="text-gray-500 block mb-1">สรุปเรื่อง/สาเหตุที่ค้าง:</span>
                            <span class="font-medium text-gray-700">${item.summary || item.status_cause || '-'}</span>
                        </div>
                        <p><span class="text-gray-500 font-bold">ผู้รับผิดชอบ:</span> <span class="font-medium text-gray-800">${item.responsible_person || '-'}</span></p>
                    </div>
                </div>

                <!-- Progress Type Checkboxes -->
                ${this.renderProgressTypeCheckboxes(progressType, item.id, 'admin', item.received_date)}

                <!-- Status Management Tool -->
                <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                    <h4 class="font-extrabold text-emerald-900 mb-4 flex items-center">
                        <i class="fas fa-tools mr-2"></i> เครื่องมือจัดการสถานะ
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-emerald-700 mb-2">ระบุสถานะงาน/สาเหตุ</label>
                            <input type="text" id="update-status-input" value="${item.status_cause || ''}"
                                class="w-full border-emerald-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                placeholder="เช่น รอดำเนินการ, รอผลวินิจฉัย...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-emerald-700 mb-2">วันที่ทำรายการเสร็จ</label>
                            <input type="date" id="update-completion-date" value="${item.completion_date || ''}"
                                class="w-full border-emerald-200 rounded-xl shadow-sm p-3 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-transparent">
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="app.quickUpdateStatus('${item.id}', 'admin', 'completed')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md">
                            <i class="fas fa-check-double mr-2"></i> เสร็จสิ้นวันนี้
                        </button>
                        <button onclick="app.saveStatusUpdate('${item.id}', 'admin')" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md">
                            <i class="fas fa-save mr-2"></i> บันทึก
                        </button>
                        <button onclick="app.deleteWork('${item.id}', 'admin')" class="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition shadow-md ml-auto">
                            <i class="fas fa-trash-alt mr-2"></i> ลบงาน
                        </button>
                    </div>
                </div>

                <!-- History Section -->
                ${this.renderHistorySection(item.id, 'admin')}
            </div>
        `;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
        }, 10);

        //Load history
        app.loadStatusHistory(item.id, 'admin');
    },


    renderAddForm(type) {
        if (type === 'survey') {
            return `
                <div>
                    <!-- Auto-generated received_seq -->
                    <label class="block text-sm font-medium text-gray-700">ลำดับรับ (Received Seq)</label>
                    <input type="text" name="received_seq" disabled placeholder="สร้างอัตโนมัติ (Auto)" class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่รับเรื่อง (Date)</label>
                    <input type="date" name="received_date" requiteal class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">สถานะ (Status)</label>
                    <input type="text" name="status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2" placeholder="ระบุสถานะ...">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">เลขที่ ร.ว. 12</label>
                    <input type="text" name="rv_12" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ประเภทการรังวัด</label>
                    <input type="text" name="survey_type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้ขอ (Applicant)</label>
                    <input type="text" name="applicant" requiteal class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ช่างรังวัด</label>
                    <input type="text" name="men" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
`;
        } else if (type === 'registration' || type === 'academic' || type === 'admin') {
            const context = type === 'registration' ? 'ทะเบียน' : (type === 'academic' ? 'วิชาการ' : 'อำนวยการ');
            return `
                <div>
                    <!-- Auto-generated seq_no -->
                    <label class="block text-sm font-medium text-gray-700">ลำดับที่ (Seq No)</label>
                    <input type="text" name="seq_no" disabled placeholder="สร้างอัตโนมัติ (Auto)" class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่รับเรื่อง</label>
                    <input type="date" name="received_date" requiteal class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">สถานะ/สาเหตุ (Status Cause)</label>
                    <input type="text" name="status_cause" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2" placeholder="ระบุสถานะ/สาเหตุ...">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">เรื่อง (Subject)</label>
                    <input type="text" name="subject" requiteal class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้เกี่ยวข้อง/คู่กรณี</label>
                    <input type="text" name="related_person" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">สรุปเรื่อง (Summary)</label>
                    <textarea name="summary" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ประเภทความคืบหน้า</label>
                    <select name="progress_type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                        <option value="1">ปกติ</option>
                        <option value="2">สุดขั้นตอน</option>
                        <option value="3">งานศาล</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ผู้รับผิดชอบ</label>
                    <input type="text" name="responsible_person" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm border p-2">
                </div>
`;
        }
        return '';
    },


    //Form สำหรับบันทึกงานเสร็จทันที (ไม่มีช่องสถานะ เพราะเสร็จแล้ว)
    renderCompletedAddForm(type) {
        //สร้าง Select dropdown สำหรับเลือกฝ่าย
        const deptSelector = `
            <div class="md:col-span-2 mb-4">
                <div class="flex flex-col md:flex-row gap-4">
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-2">เลือกฝ่าย/กลุ่มงาน <span class="text-red-500">*</span></label>
                        <select id="completed-dept-select" onchange="app.updateCompletedFormFields(this.value)" 
                            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-3 bg-green-50">
                            <option value="">-- กรุณาเลือก --</option>
                            <option value="survey" ${type === 'survey' ? 'selected' : ''}>ฝ่ายรังวัด</option>
                            <option value="registration" ${type === 'registration' ? 'selected' : ''}>ฝ่ายทะเบียน</option>
                            <option value="academic" ${type === 'academic' ? 'selected' : ''}>กลุ่มงานวิชาการ</option>
                            <option value="admin" ${type === 'admin' ? 'selected' : ''}>ฝ่ายอำนวยการ</option>
                        </select>
                    </div>
                    <div class="flex-1">
                        <label class="block text-sm font-medium text-gray-700 mb-2">ประเภทงาน <span class="text-red-500">*</span></label>
                        <select name="progress_type" id="completed-progress-type"
                            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-3 bg-white">
                            <option value="1">ปกติ /เสร็จสิ้น</option>
                            <option value="2">สุดขั้นตอน</option>
                            <option value="3">งานศาล</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        //ถ้ายังไม่ได้เลือก type จะแสดง selector เฉย ๆ
        if (!type) {
            return deptSelector + `<div id="completed-form-fields" class="md:col-span-2 text-center py-8 text-gray-400">
                <i class="fas fa-hand-pointer text-3xl mb-2"></i>
                <p>กรุณาเลือกฝ่าย/กลุ่มงานที่ต้องการบันทึก</p>
            </div>`;
        }

        let formFields = '';

        if (type === 'survey') {
            formFields = `
                <div>
                    <label class="block text-sm font-medium text-gray-700">ลำดับรับ (Received Seq)</label>
                    <input type="text" name="received_seq" disabled placeholder="สร้างอัตโนมัติ (Auto)" class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่รับเรื่อง <span class="text-red-500">*</span></label>
                    <input type="date" name="received_date" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">เลขที่ ร.ว. 12</label>
                    <input type="text" name="rv_12" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ประเภทการรังวัด</label>
                    <input type="text" name="survey_type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">แปลง (Plot No)</label>
                    <input type="text" name="plot_no" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้ขอ (Applicant) <span class="text-red-500">*</span></label>
                    <input type="text" name="applicant" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ชนิดเอกสาร (Doc Type)</label>
                    <select name="doc_type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                        <option value="โฉนดที่ดิน">โฉนดที่ดิน</option>
                        <option value="น.ส.3ก">น.ส.3ก</option>
                        <option value="อื่น ๆ">อื่น ๆ</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">เลขที่เอกสาร (Doc No)</label>
                    <input type="text" name="doc_no" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">ช่างรังวัด</label>
                    <input type="text" name="surveyor" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">เลข รว.12</label>
                    <input type="text" name="rv_12" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2" placeholder="เช่น 123/2567">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">คนคุมเรื่อง</label>
                    <input type="text" name="men" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2" placeholder="ชื่อผู้รับผิดชอบ">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่นัดรังวัด</label>
                    <input type="date" name="survey_date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
            `;
        } else if (type === 'registration' || type === 'academic') {
            const context = type === 'registration' ? 'ทะเบียน' : 'วิชาการ';
            formFields = `
                <div>
                    <label class="block text-sm font-medium text-gray-700">ลำดับที่ (Seq No)</label>
                    <input type="text" name="seq_no" disabled placeholder="สร้างอัตโนมัติ (Auto)" class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">วันที่รับเรื่อง <span class="text-red-500">*</span></label>
                    <input type="date" name="received_date" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">เรื่อง (Subject) <span class="text-red-500">*</span></label>
                    <input type="text" name="subject" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้เกี่ยวข้อง/คู่กรณี</label>
                    <input type="text" name="related_person" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">สรุปเรื่อง (Summary)</label>
                    <textarea name="summary" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2"></textarea>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700">ผู้รับผิดชอบ</label>
                    <input type="text" name="responsible_person" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm border p-2">
                </div>
            `;
        }

        return deptSelector + `<div id="completed-form-fields" class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">${formFields}</div>`;
    },

    /**
     * สำหรับฉีด HTML รายงานแบบทางการเพื่อใช้สั่งพิมพ์ (Official PDF)
     */renderOfficialPrintTemplate(abmReport) {
        //ใช้สำเนาของ abmReport เพื่อจัดการจัดรูปแบบ
        const dateStr = abmReport.reportDate || new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

        //รูปสัญลักษณ์ครุฑ (URL จาก Wikimedia - เป็นมาตรฐานที่หน่วยงานรัฐใช้บ่อยในเว็บ)
        const garudaUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Garuda_Emblem_of_Thailand.svg/100px-Garuda_Emblem_of_Thailand.svg.png';

        let html = `
    <!DOCTYPE html>
        <html lang="th">
            <head>
                <meta charset="UTF-8">
                    <title>ABM Report - ${dateStr}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
                        <style>
                            @page {size: A4; margin: 15mm; }
                            body {
                                font - family: 'Sarabun', sans-serif;
                            line-height: 1.5;
                            color: #000;
                            background: #fff;
                            margin: 0;
                            padding: 0;
                            font-size: 16px;
                }
                            .page {
                                padding: 20px;
                            background: white;
                            position: relative;
                }
                            .official-header {
                                text-align: center;
                            margin-bottom: 20px;
                            position: relative;
                }
                            .garuda {
                                width: 65px;
                            height: auto;
                            margin-bottom: 10px;
                }
                            .title-main {
                                font-size: 22px;
                            font-weight: bold;
                            margin: 5px 0;
                }
                            .title-sub {
                                font-size: 19px;
                            margin: 5px 0;
                }
                            .report-meta {
                                text-align: right;
                            margin-bottom: 30px;
                            font-size: 14px;
                }

                            h2 {border-bottom: 2px solid #000; padding-bottom: 5px; margin-top: 35px; font-size: 18px; }

                            table {
                                width: 100%;
                            border-collapse: collapse;
                            margin-top: 15px;
                            margin-bottom: 25px;
                            table-layout: fixed;
                            font-size: 14px;
                }
                            th, td {
                                border: 1px solid #000;
                            padding: 4px 6px;
                            text-align: center;
                            word-wrap: break-word;
                }
                            th {background-color: #f2f2f2; font-weight: bold; }
                            .text-left {text-align: left; }
                            .text-right {text-align: right; }

                            .summary-box {
                                display: grid;
                            grid-template-cols: repeat(4, 1fr);
                            gap: 10px;
                            margin-bottom: 25px;
                }
                            .summary-item {
                                border: 1px solid #000;
                            padding: 10px;
                            text-align: center;
                }
                            .summary-label {font-size: 12px; display: block; font-weight: bold; }
                            .summary-value {font-size: 22px; font-weight: bold; display: block; }

                            .status-pass {color: #000 !important; font-weight: bold; }
                            .status-fail {color: #000 !important; text-decoration: underline; font-weight: bold; }

                            .signature-area {
                                margin-top: 60px;
                            width: 350px;
                            margin-left: auto;
                            text-align: center;
                }
                            .signature-line {
                                margin-top: 45px;
                            border-top: 1px dotted #000;
                }

                            .footer-note {
                                position: fixed;
                            bottom: 10px;
                            left: 20px;
                            font-size: 10px;
                            color: #555;
                }

                            @media print {
                    .no - print {display: none; }
                            body {background: none; }
                            .page {padding: 0; }
                }
                        </style>
                    </head>
                    <body>
                        <div class="page">
                            <div class="official-header">
                                <img src="${garudaUrl}" class="garuda">
                                    <div class="title-main">รายงานผลการดำเนินงานตามตัวชี้วัด</div>
                                    <div class="title-sub">Ang Thong Active Backlog Management (ABM)</div>
                            </div>

                            <div class="report-meta">
                                ข้อมูล ณ วันที่ ${dateStr}<br>
                                    พิมพ์เอกสารเมื่อ: ${new Date().toLocaleString('th-TH')}
                            </div>

                            <h2>๑. การติดตามงานค้างสะสม (งานที่มีวันรับก่อนวันที่ ๑ มกราคม ๒๕๖๙)</h2>
                            <div class="summary-box">
                                <div class="summary-item">
                                    <span class="summary-label">งานค้างยกมา (Baseline)</span>
                                    <span class="summary-value">${abmReport.oldWork.baseline.total}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">ดำเนินการเสร็จสิ้นสะสม</span>
                                    <span class="summary-value">${abmReport.oldWork.summary.totalCompleted}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">คงเหลือรอกำเนินการ</span>
                                    <span class="summary-value">${abmReport.oldWork.summary.remaining}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">ร้อยละที่ลดลง (สะสม)</span>
                                    <span class="summary-value">${abmReport.oldWork.summary.currentPercent.toFixed(1)}%</span>
                                </div>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 25%;">เดือน/ปี</th>
                                        <th>งานค้างต้นเดือน</th>
                                        <th>เสร็จในเดือน</th>
                                        <th>งานค้างสิ้นเดือน</th>
                                        <th>ร้อยละที่ลดลง</th>
                                        <th>ผลการประเมิน</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${abmReport.oldWork.monthlyProgress.map(m => `
                        <tr>
                            <td class="text-left">${m.month} ${m.year}</td>
                            <td>${m.backlogStart.toLocaleString()}</td>
                            <td>${m.completedThisMonth.toLocaleString()}</td>
                            <td>${m.backlogEnd.toLocaleString()}</td>
                            <td>${m.percentThisMonth.toFixed(1)}%</td>
                            <td>${m.achieved ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุเป้าหมาย'}</td>
                        </tr>`).join('')}
                                </tbody>
                            </table>

                            <h2>๒. การบริหารจัดการงานรับใหม่ (ตั้งแต่วันที่ ๑ มกราคม ๒๕๖๙ เป็นต้นไป)</h2>
                            <div class="summary-box">
                                <div class="summary-item">
                                    <span class="summary-label">จำนวนงานรับใหม่</span>
                                    <span class="summary-value">${abmReport.newWork.total}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">ดำเนินการเสร็จสิ้น</span>
                                    <span class="summary-value">${abmReport.newWork.completed}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">รอดำเนินการ</span>
                                    <span class="summary-value">${abmReport.newWork.pending}</span>
                                </div>
                                <div class="summary-item" style="background-color: #f9f9f9;">
                                    <span class="summary-label">ร้อยละความสำเร็จรวม</span>
                                    <span class="summary-value">${abmReport.newWork.percentages.within60.toFixed(1)}%</span>
                                </div>
                            </div>

                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 45%;">ตัวชี้วัดความรวดเร็วในการบริการ</th>
                                        <th>จำนวนที่เสร็จ</th>
                                        <th>ร้อยละที่ทำได้</th>
                                        <th>เกณฑ์เป้าหมาย</th>
                                        <th>สรุปผล</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td class="text-left">การดำเนินการเสร็จสิ้นภายในระยะเวลา ๓๐ วัน</td>
                                        <td>${abmReport.newWork.breakdown.within30Days}</td>
                                        <td>${abmReport.newWork.percentages.within30.toFixed(1)}%</td>
                                        <td>ไม่น้อยกว่าร้อยละ ๘๐</td>
                                        <td>${abmReport.newWork.percentages.achieved30 ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-left">การดำเนินการเสร็จสิ้นภายในระยะเวลา ๖๐ วัน</td>
                                        <td>${abmReport.newWork.breakdown.within60Days}</td>
                                        <td>${abmReport.newWork.percentages.within60.toFixed(1)}%</td>
                                        <td>ร้อยละ ๑๐๐</td>
                                        <td>${abmReport.newWork.percentages.achieved60 ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style="page-break-before: always;"></div>
                            <h2>ภาคผนวก: รายละเอียดรายการงานที่ดำเนินการเสร็จสิ้น (งานค้างสะสม)</h2>

                            ${abmReport.oldWork.monthlyProgress.map(m => m.items && m.items.length > 0 ? `
                <div style="margin-top: 15px;">
                    <strong>ประจำเดือน ${m.month} ${m.year} (ทั้งสิ้น ${m.items.length} รายการ)</strong>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 8%;">ลำดับ</th>
                                <th style="width: 60%;">เรื่อง /ชื่อผู้ขอ /รายละเอียด</th>
                                <th>วันที่รับ</th>
                                <th>วันที่เสร็จ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${m.items.slice(0, 150).map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td class="text-left" style="font-size: 13px;">${item.subject || item.applicant || '-'}</td>
                                <td style="font-size: 12px;">${item.received_date ? new Date(item.received_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</td>
                                <td style="font-size: 12px;">${item.completion_date ? new Date(item.completion_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</td>
                            </tr>`).join('')}
                            ${m.items.length > 150 ? `<tr><td colspan="4" style="text-align: center;">... และรายการอื่นๆ อีกจำนวน ${m.items.length - 150} รายการ</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
                ` : '').join('')}

                            <div class="signature-area">
                                <p>ขอรับรองว่าข้อมูลดังกล่าวเป็นความจริงทุกประการ</p>
                                <div class="signature-line"></div>
                                <p>(...........................................................................)</p>
                                <p>ตำแหน่ง ...........................................................................</p>
                                <p>วันที่ ............ เดือน ............................ พ.ศ. ................</p>
                            </div>

                            <div class="footer-note">
                                เอกสารนี้สร้างโดยระบบจัดเก็บข้อมูลงานค้างอัตโนมัติ (Automated Pending Work System)
                            </div>
                        </div>
                    </body>
                </html>
                `;
        return html;
    },

    /**
     * Render System Activity Logs
     */
    async renderLogs() {
        try {
            const response = await fetch('api/logs_fetch.php');
            const logs = await response.json();

            const rows = logs.map((log, idx) => {
                const actionColors = {
                    'ADD': 'emerald',
                    'UPDATE': 'blue',
                    'DELETE': 'rose',
                    'STATUS_CHANGE': 'amber',
                    'IMPORT': 'purple'
                };
                const color = actionColors[log.action] || 'gray';

                return `
                    <tr class="hover:bg-gray-50/50 transition-colors border-b border-gray-100/50">
                        <td class="px-6 py-4 text-xs font-bold text-gray-400">${idx + 1}</td>
                        <td class="px-6 py-4">
                            <div class="flex items-center">
                                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3">
                                    <i class="fas fa-user text-gray-400 text-xs"></i>
                                </div>
                                <span class="text-sm font-bold text-gray-700">${log.user_name}</span>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <span class="px-3 py-1 bg-${color}-50 text-${color}-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-${color}-100">
                                ${log.action}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-sm text-gray-500 font-medium">${log.department}</td>
                        <td class="px-6 py-4 text-sm text-gray-400">${log.created_at}</td>
                        <td class="px-6 py-4">
                            <p class="text-xs text-gray-600 max-w-xs truncate" title="${log.details || ''}">${log.details || '-'}</p>
                        </td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="glass-premium rounded-3xl p-8 shadow-xl border border-gray-100" data-aos="fade-up">
                    <div class="overflow-x-auto">
                        <table id="logs-datatable" class="w-full text-left">
                            <thead>
                                <tr class="text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                                    <th class="px-6 py-4">#</th>
                                    <th class="px-6 py-4">ผู้ใช้งาน</th>
                                    <th class="px-6 py-4">การกระทำ</th>
                                    <th class="px-6 py-4">ฝ่าย</th>
                                    <th class="px-6 py-4">วัน/เวลา</th>
                                    <th class="px-6 py-4">รายละเอียด</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering logs:', error);
            return '<div class="p-8 text-center text-rose-500 font-bold glass-premium rounded-3xl">เกิดข้อผิดพลาดในการโหลดข้อมูลประวัติ</div>';
        }
    }
};

console.log('UI Loaded successfully', window.UI);
