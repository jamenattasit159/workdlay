window.app = {
    currentUser: null,
    idleTimer: null,
    timeoutSettings: 15 * 60 * 1000, // 15 minutes
    sessionMaxAge: 4 * 60 * 60 * 1000, // 24 hours - session จะหมดอายุหลังจาก 24 ชั่วโมง

    // State for List View
    currentDepFilter: 'all',
    currentSort: 'desc',
    currentPage: 1,
    itemsPerPage: 20,
    searchTerm: '',
    currentStatusFilter: 'all',

    // Status View State (pending/completed)
    surveyStatusView: 'pending',
    registrationStatusView: 'pending',
    academicStatusView: 'pending',

    // Progress Type Filter State (all, 1, 2, 3)
    surveyProgressFilter: 'all',
    registrationProgressFilter: 'all',
    academicProgressFilter: 'all',

    init() {
        console.log('App initialized v2.0');
        this.checkSession();
        this.updateDate();
        if (this.currentUser) {
            this.startIdleMonitor();
        }

        // Initialize AOS
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                once: true,
                offset: 50
            });
        }

        // Add Work Button Listener
        document.getElementById('btn-save-work')?.addEventListener('click', () => this.handleSaveWork());

        // Completed Work Button Listener (งานเสร็จทันที)
        document.getElementById('btn-save-completed-work')?.addEventListener('click', () => this.handleSaveCompletedWork());
    },

    checkSession() {
        // Session check with expiration (localStorage)
        const user = localStorage.getItem('dol_user');
        const sessionTimestamp = localStorage.getItem('dol_session_timestamp');

        if (user && sessionTimestamp) {
            const loginTime = parseInt(sessionTimestamp, 10);
            const now = Date.now();
            const sessionAge = now - loginTime;

            // Check if session has expired
            if (sessionAge > this.sessionMaxAge) {
                // Session expired - clear and show login
                console.log('Session expired after', Math.round(sessionAge / (1000 * 60 * 60)), 'hours');
                this.clearSession();
                this.showLogin();

                // Show notification to user
                setTimeout(() => {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'info',
                            title: 'เซสชันหมดอายุ',
                            text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
                            confirmButtonColor: '#10B981'
                        });
                    }
                }, 500);
            } else {
                // Session still valid
                this.currentUser = JSON.parse(user);
                this.showMainApp();
            }
        } else if (user) {
            // Old session without timestamp - clear it for security
            this.clearSession();
            this.showLogin();
        } else {
            this.showLogin();
        }
    },

    clearSession() {
        this.currentUser = null;
        localStorage.removeItem('dol_user');
        localStorage.removeItem('dol_session_timestamp');
        clearTimeout(this.idleTimer);
    },

    showLogin() {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('main-message-box')?.classList.add('hidden'); // Logic to hide main app
        document.getElementById('main-sidebar').classList.add('hidden');
        document.getElementById('main-content').classList.add('hidden');
        // Reset Mobile header if needed, for now main-content hidden covers it if structure is correct
    },

    showMainApp() {
        document.getElementById('login-overlay').classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('login-overlay').classList.remove('opacity-0', 'pointer-events-none');
        }, 500);

        const sidebar = document.getElementById('main-sidebar');
        const mainContent = document.getElementById('main-content');

        // Sidebar uses 'hidden lg:flex' class in HTML, so no need to manage classes here
        // Just ensure it's in the DOM and let Tailwind handle responsive display

        mainContent.classList.remove('hidden');

        // Hide menu items based on user department
        this.updateMenuVisibility();

        // Navigate to appropriate page based on role
        const userDept = this.currentUser?.department || 'all';
        if (userDept === 'all') {
            this.navigate('dashboard');
        } else {
            // Staff users go directly to their department page
            this.navigate(userDept + '_list');
        }

        this.updateUserInfo();
    },

    updateMenuVisibility() {
        const userDept = this.currentUser?.department || 'all';
        const userRole = this.currentUser?.role || 'staff';
        const isAdmin = userRole === 'superadmin' || userRole === 'admin';

        // Define which elements to hide for each department
        const menuMappings = {
            'survey': [
                'nav-registration_list', 'nav-academic_list',
                'nav-add-registration', 'nav-add-academic',
                'nav-import-registration', 'nav-import-academic',
                'nav-sameday-registration', 'nav-sameday-academic',
                'nav-import-completed-registration', 'nav-import-completed-academic',
                'nav-completed-registration', 'nav-completed-academic'
            ],
            'registration': [
                'nav-survey_list', 'nav-academic_list',
                'nav-add-survey', 'nav-add-academic',
                'nav-import-survey', 'nav-import-academic',
                'nav-sameday-survey', 'nav-sameday-academic',
                'nav-import-completed-survey', 'nav-import-completed-academic',
                'nav-completed-survey', 'nav-completed-academic'
            ],
            'academic': [
                'nav-survey_list', 'nav-registration_list',
                'nav-add-survey', 'nav-add-registration',
                'nav-import-survey', 'nav-import-registration',
                'nav-sameday-survey', 'nav-sameday-registration',
                'nav-import-completed-survey', 'nav-import-completed-registration',
                'nav-completed-survey', 'nav-completed-registration'
            ]
        };

        // Show all menus first (reset)
        document.querySelectorAll('.nav-item, .nav-import-btn, .mobile-nav-item').forEach(el => {
            el.classList.remove('hidden');
        });

        // If department-specific user, hide other department menus
        if (userDept !== 'all' && menuMappings[userDept]) {
            menuMappings[userDept].forEach(menuId => {
                const el = document.getElementById(menuId);
                if (el) el.classList.add('hidden');
            });
        }
    },


    updateUserInfo() {
        const infoEl = document.getElementById('user-info');
        if (infoEl && this.currentUser) {
            infoEl.innerHTML = `
                <p class="text-sm font-bold text-white">${this.currentUser.name}</p>
                <p class="text-xs text-emerald-100 opacity-80">${this.currentUser.role === 'superadmin' ? 'ผู้ดูแลระบบ' : 'เจ้าหน้าที่'}</p>
            `;
        }
    },

    login() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const username = usernameInput.value.toLowerCase().trim();
        const password = passwordInput.value;

        // User accounts configuration
        const users = {
            // Admin accounts (see all)
            'admin': { password: 'admin1234', role: 'superadmin', name: 'ผู้ดูแลระบบ', department: 'all' },
            'dolthong': { password: 'angthong1', role: 'admin', name: 'เจ้าหน้าที่ทั่วไป', department: 'all' },

            // Department-specific accounts
            'survey': { password: '1234', role: 'staff', name: 'ฝ่ายรังวัด', department: 'survey' },
            'rangwad': { password: '1234', role: 'staff', name: 'ฝ่ายรังวัด', department: 'survey' },

            'registration': { password: '1234', role: 'staff', name: 'ฝ่ายทะเบียน', department: 'registration' },
            'tabian': { password: '1234', role: 'staff', name: 'ฝ่ายทะเบียน', department: 'registration' },

            'academic': { password: '1234', role: 'staff', name: 'กลุ่มงานวิชาการ', department: 'academic' },
            'wichakan': { password: '1234', role: 'staff', name: 'กลุ่มงานวิชาการ', department: 'academic' }
        };

        const user = users[username];

        if (user && user.password === password) {
            this.setSession({
                username,
                role: user.role,
                name: user.name,
                department: user.department
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'เข้าสู่ระบบไม่สำเร็จ',
                text: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
                confirmButtonColor: '#10B981'
            });
            return;
        }

        // Clear inputs
        usernameInput.value = '';
        passwordInput.value = '';
    },

    setSession(user) {
        this.currentUser = user;
        localStorage.setItem('dol_user', JSON.stringify(user));
        localStorage.setItem('dol_session_timestamp', Date.now().toString());

        Swal.fire({
            icon: 'success',
            title: `ยินดีต้อนรับ, ${user.name}`,
            text: 'เข้าสู่ระบบสำเร็จ',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            this.showMainApp();
            this.startIdleMonitor();
        });
    },

    startIdleMonitor() {
        // Reset timer on any user activity
        window.onload = this.resetIdleTimer.bind(this);
        window.onmousemove = this.resetIdleTimer.bind(this);
        window.onmousedown = this.resetIdleTimer.bind(this); // catches touchscreen presses as well
        window.ontouchstart = this.resetIdleTimer.bind(this);
        window.onclick = this.resetIdleTimer.bind(this); // catches touchpad clicks
        window.onkeypress = this.resetIdleTimer.bind(this);
        window.addEventListener('scroll', this.resetIdleTimer.bind(this), true); // improved; scroll capturing

        this.resetIdleTimer(); // Start the timer
    },

    resetIdleTimer() {
        clearTimeout(this.idleTimer);
        // Only set timer if user is logged in
        if (this.currentUser) {
            this.idleTimer = setTimeout(this.handleSessionTimeout.bind(this), this.timeoutSettings);
        }
    },

    handleSessionTimeout() {
        // Clear session immediately
        this.clearSession();

        Swal.fire({
            title: 'หมดเวลาการใช้งาน',
            text: 'คุณไม่ได้ทำรายการเป็นเวลานาน ระบบจะทำการออกจากระบบอัตโนมัติ',
            icon: 'warning',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#10B981',
            allowOutsideClick: false,
            allowEscapeKey: false
        }).then((result) => {
            // Force reload regardless of how dialog was closed
            window.location.href = window.location.href;
        });
    },

    logout() {
        Swal.fire({
            title: 'ออกจากระบบ?',
            text: "คุณต้องการออกจากระบบใช่หรือไม่",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ใช่, ออกจากระบบ'
        }).then((result) => {
            if (result.isConfirmed) {
                this.clearSession();
                location.reload(); // Reload to reset state clean
            }
        });
    },

    updateDate() {
        const el = document.getElementById('current-date');
        if (el) {
            const now = new Date();
            el.innerText = now.toLocaleDateString('th-TH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    },

    // ... existing code ...
    // State for Survey View
    currentSurveyFilter: 'all',
    currentSurveySort: 'desc',
    surveySearchTerm: '',
    surveySearchTimeout: null,
    currentSurveyPage: 1,
    surveyItemsPerPage: 20,

    // State for Registration View
    currentRegistrationPage: 1,
    registrationItemsPerPage: 20,
    registrationSearchTerm: '',
    registrationSearchTimeout: null,
    currentRegistrationSort: 'desc',
    currentRegistrationFilter: 'all',

    // State for Academic View
    currentAcademicPage: 1,
    academicItemsPerPage: 20,
    academicSearchTerm: '',
    academicSearchTimeout: null,

    // ... (navigate function remains mostly same, just ensure state reset)

    async sortRegistrationList(order) {
        this.currentRegistrationSort = order;
        this.currentRegistrationPage = 1;
        this.refreshRegistrationList();
    },

    async filterRegistrationList(type) {
        this.currentRegistrationFilter = type;
        this.currentRegistrationPage = 1;
        this.refreshRegistrationList();
    },


    async navigate(page) {
        const content = document.getElementById('app-content');
        const title = document.getElementById('page-title');
        const userDept = this.currentUser?.department || 'all';
        const isStaff = this.currentUser?.role === 'staff';

        // Permission check for staff users
        if (isStaff && userDept !== 'all') {
            // Staff can only access their department's page, dashboard, and reports
            const allowedPages = {
                'survey': ['dashboard', 'survey_list', 'survey_form', 'report', 'old_backlog'],
                'registration': ['dashboard', 'registration_list', 'registration_form', 'report', 'old_backlog'],
                'academic': ['dashboard', 'academic_list', 'academic_form', 'report', 'old_backlog']
            };

            if (!allowedPages[userDept]?.includes(page)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่มีสิทธิ์เข้าถึง',
                    text: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้',
                    confirmButtonColor: '#F97316'
                });

                // Redirect to their department page
                const deptPage = userDept + '_list';
                this.navigate(deptPage);
                return;
            }
        }

        // Reset active nav state efficiently without overwriting className (preserving 'hidden')
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('bg-emerald-50', 'text-emerald-700', 'font-bold', 'shadow-sm', 'border-l-4', 'border-emerald-500',
                'bg-indigo-50', 'text-indigo-700', 'border-indigo-500',
                'bg-blue-50', 'text-blue-700', 'border-blue-500',
                'bg-orange-50', 'text-orange-700', 'border-orange-500',
                'bg-purple-50', 'text-purple-700', 'border-purple-500');
            el.classList.add('hover:bg-emerald-50', 'hover:text-emerald-600', 'text-gray-600');

            const iconDiv = el.querySelector('div');
            if (iconDiv) {
                iconDiv.className = 'p-2 bg-gray-100 rounded-lg group-hover:bg-emerald-100 mr-3 transition-colors text-gray-400 group-hover:text-emerald-600';
            }
        });

        const activeNav = document.getElementById(`nav-${page}`);
        if (activeNav) {
            activeNav.classList.remove('text-gray-600');
            activeNav.classList.add('font-bold', 'shadow-sm', 'transition-all', 'duration-300', 'text-left', 'group', 'border-l-4');

            const iconDiv = activeNav.querySelector('div');

            if (page === 'survey_list') {
                activeNav.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-500');
                if (iconDiv) iconDiv.className = 'p-2 bg-indigo-100 rounded-lg mr-3 transition-colors text-indigo-600';
            } else if (page === 'registration_list') {
                activeNav.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-500');
                if (iconDiv) iconDiv.className = 'p-2 bg-blue-100 rounded-lg mr-3 transition-colors text-blue-600';
            } else if (page === 'academic_list') {
                activeNav.classList.add('bg-orange-50', 'text-orange-700', 'border-orange-500');
                if (iconDiv) iconDiv.className = 'p-2 bg-orange-100 rounded-lg mr-3 transition-colors text-orange-600';
            } else if (page === 'sync_page') {
                activeNav.classList.add('bg-purple-50', 'text-purple-700', 'border-purple-500');
                if (iconDiv) iconDiv.className = 'p-2 bg-purple-100 rounded-lg mr-3 transition-colors text-purple-600';
            } else {
                activeNav.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-500');
                if (iconDiv) iconDiv.className = 'p-2 bg-emerald-100 rounded-lg mr-3 transition-colors text-emerald-600';
            }
        }

        // Reset active nav state (Mobile)
        document.querySelectorAll('.mobile-nav-item').forEach(el => {
            if (el.classList.contains('w-16')) return; // Skip floating button
            el.classList.remove('text-emerald-600', 'font-bold');
            el.classList.add('text-gray-400');
            const iconWrap = el.querySelector('div');
            if (iconWrap) iconWrap.classList.remove('bg-emerald-50');
        });

        const activeMobile = document.querySelector(`.mobile-nav-item[data-page="${page}"]`);
        if (activeMobile && !activeMobile.classList.contains('w-16')) {
            activeMobile.classList.remove('text-gray-400');
            activeMobile.classList.add('text-emerald-600', 'font-bold');
            const iconWrap = activeMobile.querySelector('div');
            if (iconWrap) iconWrap.classList.add('bg-emerald-50');
        }

        if (page === 'dashboard') {
            title.innerText = 'ภาพรวมการดำเนินงาน';
            content.innerHTML = await UI.renderDashboard(userDept);
            this.initPerformanceChart();
        } else if (page === 'logs') {
            title.innerText = 'ตรวจสอบประวัติ (Activity Logs)';
            content.innerHTML = await UI.renderLogs();
            UI.initDataTable('logs-datatable', { order: [[4, 'desc']] });
        } else if (page === 'report') {
            window.location.href = 'report.html';
            return;
        } else if (page === 'old_backlog') {
            window.location.href = 'old_backlog_report.html';
            return;
        } else if (page === 'survey_list') {
            title.innerText = 'งานฝ่ายรังวัด';
            this.currentSurveyPage = 1; // Reset to first page
            await this.refreshSurveyList();
        } else if (page === 'survey_form') {
            title.innerText = 'บันทึกงานรังวัด';
            content.innerHTML = UI.renderSurveyForm();
        } else if (page === 'registration_list') {
            title.innerText = 'งานฝ่ายทะเบียน';
            this.currentRegistrationPage = 1;
            await this.refreshRegistrationList();
        } else if (page === 'academic_list') {
            title.innerText = 'งานกลุ่มงานวิชาการ';
            this.currentAcademicPage = 1;
            await this.refreshAcademicList();
        } else if (page === 'academic_form') {
            title.innerText = 'บันทึกงานวิชาการ';
            content.innerHTML = UI.renderAcademicForm();
        }

        // Refresh AOS/Animations
        if (typeof AOS !== 'undefined') {
            setTimeout(() => AOS.refresh(), 100);
        }
    },

    // --- Survey Logic ---
    async handleSurveySubmit(e) {
        e.preventDefault();
        const form = e.target;
        const data = new FormData(form);

        // Map FormData to Object
        const item = {};
        data.forEach((value, key) => item[key] = value);

        try {
            await DataManager.saveSurveyItem(item);
            Swal.fire({
                title: 'บันทึกสำร็จ!',
                text: 'บันทึกข้อมูลงานรังวัดเรียบร้อยแล้ว',
                icon: 'success',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#10B981'
            }).then(() => {
                this.navigate('survey_list');
            });
        } catch (error) {
            Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    },

    // --- Registration Logic ---
    async handleRegistrationSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const data = new FormData(form);
        const item = {};
        data.forEach((value, key) => item[key] = value);

        try {
            await DataManager.saveRegistrationItem(item);
            Swal.fire({
                title: 'บันทึกสำเร็จ!',
                text: 'บันทึกข้อมูลงานทะเบียนเรียบร้อยแล้ว',
                icon: 'success',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#10B981'
            }).then(() => {
                this.navigate('registration_list');
            });
        } catch (error) {
            Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    },

    // --- Academic Logic ---
    async handleAcademicSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const data = new FormData(form);
        const item = {};
        data.forEach((value, key) => item[key] = value);

        try {
            await DataManager.saveAcademicItem(item);
            Swal.fire({
                title: 'บันทึกสำเร็จ!',
                text: 'บันทึกข้อมูลวิชาการเรียบร้อยแล้ว',
                icon: 'success',
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#F97316'
            }).then(() => {
                this.navigate('academic_list');
            });
        } catch (error) {
            Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    },

    async searchAcademicList(term) {
        this.academicSearchTerm = term;
        this.currentAcademicPage = 1;

        if (this.academicSearchTimeout) {
            clearTimeout(this.academicSearchTimeout);
        }

        this.academicSearchTimeout = setTimeout(() => {
            this.refreshAcademicList();
        }, 300);
    },

    async goToAcademicPage(page) {
        this.currentAcademicPage = page;
        this.refreshAcademicList();
    },

    async refreshAcademicList() {
        const content = document.getElementById('app-content');
        const listContainer = document.getElementById('academic-list-container');

        // Destroy existing DataTable before re-render
        UI.destroyDataTable('academic-datatable');

        let items = await DataManager.getAcademicItems();

        // 0. Filter by Status View (Pending/Completed) - Use DataManager helper functions for consistent logic
        if (this.academicStatusView === 'pending') {
            items = items.filter(item => DataManager.isPending(item));
        } else {
            items = items.filter(item => DataManager.isCompleted(item));
        }

        // 0.5. Filter by Progress Type (1=ปกติ, 2=สุดขั้นตอน, 3=งานศาล)
        if (this.academicProgressFilter && this.academicProgressFilter !== 'all') {
            const pType = parseInt(this.academicProgressFilter, 10);
            items = items.filter(item => parseInt(item.progress_type, 10) === pType);
        }

        if (this.academicSearchTerm) {
            const lowerTerm = this.academicSearchTerm.toLowerCase();
            items = items.filter(item =>
                (item.subject && item.subject.toLowerCase().includes(lowerTerm)) ||
                (item.related_person && item.related_person.toLowerCase().includes(lowerTerm)) ||
                (item.seq_no && item.seq_no.toLowerCase().includes(lowerTerm))
            );
        }

        // Auto-reset page if current page becomes empty after refresh
        const maxPage = Math.ceil(items.length / this.academicItemsPerPage) || 1;
        if (this.currentAcademicPage > maxPage) {
            this.currentAcademicPage = maxPage;
        }

        // Sorting (Default to date desc)
        items.sort((a, b) => new Date(b.received_date) - new Date(a.received_date));

        if (listContainer) {
            await UI.updateAcademicList(
                items,
                this.academicSearchTerm,
                this.currentAcademicSubject || 'all',
                this.currentAcademicPage,
                this.academicItemsPerPage
            );
        } else {
            content.innerHTML = await UI.renderAcademicList(
                items,
                this.academicSearchTerm,
                this.currentAcademicSubject || 'all',
                this.currentAcademicPage,
                this.academicItemsPerPage,
                this.academicStatusView
            );

            // Restore input focus
            const searchInput = document.getElementById('academic-search-input');
            if (searchInput && this.academicSearchTerm) {
                searchInput.focus();
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;
            }
        }

        if (typeof AOS !== 'undefined') {
            setTimeout(() => AOS.refresh(), 100);
        }

        // Initialize DataTables after DOM is fully rendered - Remove delay to fix UI glitch
        requestAnimationFrame(() => {
            const tableEl = document.getElementById('academic-datatable');
            if (typeof $ !== 'undefined' && $.fn.DataTable && tableEl) {
                UI.initDataTable('academic-datatable', {
                    order: [[1, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: [5] }
                    ]
                });
            }
        });
    },

    async filterAcademicSubject(subject) {
        this.currentAcademicSubject = subject;
        this.currentAcademicPage = 1;
        this.refreshAcademicList();
    },

    async filterAcademicProgress(progressType) {
        this.academicProgressFilter = progressType;
        this.currentAcademicPage = 1;
        this.refreshAcademicList();
    },

    async searchRegistrationList(term) {
        this.registrationSearchTerm = term;
        this.currentRegistrationPage = 1;

        if (this.registrationSearchTimeout) {
            clearTimeout(this.registrationSearchTimeout);
        }

        this.registrationSearchTimeout = setTimeout(() => {
            this.refreshRegistrationList();
        }, 300);
    },

    async goToRegistrationPage(page) {
        this.currentRegistrationPage = page;
        this.refreshRegistrationList();
    },

    async filterRegistrationSubject(subject) {
        this.currentRegistrationSubject = subject;
        this.currentRegistrationPage = 1;
        this.refreshRegistrationList();
    },

    async filterRegistrationProgress(progressType) {
        this.registrationProgressFilter = progressType;
        this.currentRegistrationPage = 1;
        this.refreshRegistrationList();
    },

    async refreshRegistrationList() {
        const content = document.getElementById('app-content');
        const listContainer = document.getElementById('registration-list-container');

        // Destroy existing DataTable before re-render
        UI.destroyDataTable('registration-datatable');

        // Data Fetching
        let items = await DataManager.getRegistrationItems();

        // Filter by Status View - Use DataManager helper functions for consistent logic
        if (this.registrationStatusView === 'pending') {
            items = items.filter(item => DataManager.isPending(item));
        } else {
            items = items.filter(item => DataManager.isCompleted(item));
        }

        // Filter by Progress Type (1=ปกติ, 2=สุดขั้นตอน, 3=งานศาล)
        if (this.registrationProgressFilter && this.registrationProgressFilter !== 'all') {
            const pType = parseInt(this.registrationProgressFilter, 10);
            items = items.filter(item => parseInt(item.progress_type, 10) === pType);
        }

        // Auto-reset page if current page becomes empty after refresh
        const maxPage = Math.ceil(items.length / this.registrationItemsPerPage) || 1;
        if (this.currentRegistrationPage > maxPage) {
            this.currentRegistrationPage = maxPage;
        }

        if (listContainer) {
            // Partial Update (Optimized - Avoids destroying Input)
            await UI.updateRegistrationList(
                items,
                this.registrationSearchTerm,
                this.currentRegistrationSort,
                this.currentRegistrationFilter,
                this.currentRegistrationSubject || 'all',
                this.currentRegistrationPage,
                this.registrationItemsPerPage
            );
        } else {
            // Full Render (First Load or Navigate)
            content.innerHTML = await UI.renderRegistrationList(
                items,
                this.registrationSearchTerm,
                this.currentRegistrationSort,
                this.currentRegistrationFilter,
                this.currentRegistrationSubject || 'all',
                this.currentRegistrationPage,
                this.registrationItemsPerPage,
                this.registrationStatusView
            );

            // Restore input focus only if needed (safety check for full render)
            const searchInput = document.getElementById('registration-search-input');
            if (searchInput && this.registrationSearchTerm) {
                searchInput.focus();
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;
            }
        }

        if (typeof AOS !== 'undefined') {
            setTimeout(() => AOS.refresh(), 100);
        }

        // Initialize DataTables after DOM is fully rendered - Remove delay to fix UI glitch
        requestAnimationFrame(() => {
            const tableEl = document.getElementById('registration-datatable');
            if (typeof $ !== 'undefined' && $.fn.DataTable && tableEl) {
                UI.initDataTable('registration-datatable', {
                    order: [[1, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: [7] }
                    ]
                });
            }
        });
    },

    async filterSurveyList(type) {
        this.currentSurveyFilter = type;
        this.currentSurveyPage = 1;
        this.refreshSurveyList();
    },

    async sortSurveyList(order) {
        this.currentSurveySort = order;
        this.currentSurveyPage = 1;
        this.refreshSurveyList();
    },

    async searchSurveyList(term) {
        this.surveySearchTerm = term;
        this.currentSurveyPage = 1;

        if (this.surveySearchTimeout) {
            clearTimeout(this.surveySearchTimeout);
        }

        this.surveySearchTimeout = setTimeout(() => {
            this.refreshSurveyList();
        }, 300);
    },

    async filterSurveyType(type) {
        this.currentSurveyFilter = type;
        this.currentSurveyPage = 1;
        this.refreshSurveyList();
    },

    async filterSurveyProgress(progressType) {
        this.surveyProgressFilter = progressType;
        this.currentSurveyPage = 1;
        this.refreshSurveyList();
    },

    async goToSurveyPage(page) {
        this.currentSurveyPage = page;
        this.refreshSurveyList();
    },

    async refreshSurveyList() {
        const content = document.getElementById('app-content');
        const listContainer = document.getElementById('survey-list-container');

        // Destroy existing DataTable before re-render
        UI.destroyDataTable('survey-datatable');

        // Get all items
        let items = await DataManager.getSurveyItems();

        // 0. Filter by Status View - Use DataManager helper functions for consistent logic
        if (this.surveyStatusView === 'pending') {
            items = items.filter(item => DataManager.isPending(item));
        } else {
            items = items.filter(item => DataManager.isCompleted(item));
        }

        // 0.5. Filter by Progress Type (1=ปกติ, 2=สุดขั้นตอน, 3=งานศาล)
        if (this.surveyProgressFilter && this.surveyProgressFilter !== 'all') {
            const pType = parseInt(this.surveyProgressFilter, 10);
            items = items.filter(item => parseInt(item.progress_type, 10) === pType);
        }

        // 1. Filter by Type
        if (this.currentSurveyFilter && this.currentSurveyFilter !== 'all') {
            items = items.filter(item => item.survey_type === this.currentSurveyFilter);
        }

        // 2. Search
        if (this.surveySearchTerm) {
            const lowerTerm = this.surveySearchTerm.toLowerCase();
            items = items.filter(item =>
                (item.applicant && item.applicant.toLowerCase().includes(lowerTerm)) ||
                (item.plot_no && item.plot_no.toLowerCase().includes(lowerTerm)) ||
                (item.received_seq && item.received_seq.toLowerCase().includes(lowerTerm))
            );
        }

        // Auto-reset page if current page becomes empty after refresh
        const maxPage = Math.ceil(items.length / this.surveyItemsPerPage) || 1;
        if (this.currentSurveyPage > maxPage) {
            this.currentSurveyPage = maxPage;
        }

        // 3. Sort
        if (!this.currentSurveySort) this.currentSurveySort = 'desc'; // Default newest first

        items.sort((a, b) => {
            // Helper to parsing dates safely since we have logic in UI but here we just need simple sort?
            // Ideally we should use UI.getSafeDate ?? But app.js doesn't have it.
            // Let's rely on standard Date parsing as before, or use the raw string comparison if format is ISO.
            // But 'received_date' is likely YYYY-MM-DD.
            const dateA = new Date(a.received_date);
            const dateB = new Date(b.received_date);

            if (this.currentSurveySort === 'asc') {
                return dateA - dateB;
            } else {
                return dateB - dateA;
            }
        });

        // Render
        if (listContainer) {
            await UI.updateSurveyList(
                items,
                this.surveySearchTerm,
                this.currentSurveySort,
                this.currentSurveyFilter,
                this.currentSurveyPage,
                this.surveyItemsPerPage
            );
        } else {
            content.innerHTML = await UI.renderSurveyList(
                items,
                this.surveySearchTerm,
                this.currentSurveySort,
                this.currentSurveyFilter,
                this.currentSurveyPage,
                this.surveyItemsPerPage,
                this.surveyStatusView
            );

            // Restore input focus only if needed (safety check for full render)
            const searchInput = document.getElementById('survey-search-input');
            if (searchInput && this.surveySearchTerm) {
                searchInput.focus();
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;
            }
        }

        // Refresh AOS
        if (typeof AOS !== 'undefined') {
            setTimeout(() => AOS.refresh(), 100);
        }

        // Initialize DataTables after DOM is fully rendered - Remove delay to fix UI glitch
        requestAnimationFrame(() => {
            const tableEl = document.getElementById('survey-datatable');
            if (typeof $ !== 'undefined' && $.fn.DataTable && tableEl) {
                UI.initDataTable('survey-datatable', {
                    order: [[1, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: [0, 9] }
                    ]
                });
            }
        });
    },



    async viewSurveyDetail(id) {
        const items = await DataManager.getSurveyItems();
        const item = items.find(i => i.id == id);
        if (item) {
            UI.showSurveyDetail(item);
        }
    },

    async viewRegistrationDetail(id) {
        const items = await DataManager.getRegistrationItems();
        const item = items.find(i => i.id == id);
        if (item && UI.showRegistrationDetail) {
            UI.showRegistrationDetail(item);
        }
    },

    async viewAcademicDetail(id) {
        const items = await DataManager.getAcademicItems();
        const item = items.find(i => i.id == id);
        if (item && UI.showAcademicDetail) {
            UI.showAcademicDetail(item);
        }
    },

    closeDetailModal() {
        const modal = document.getElementById('detail-modal');
        if (modal) {
            // Animation for closing
            modal.querySelector('div[class*="scale-100"]').classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.querySelector('div[class*="scale-100"]').classList.remove('scale-95', 'opacity-0');
            }, 200);
        }
    },

    currentAddType: null,

    openAddModal(type) {
        this.currentAddType = type;
        const formContainer = document.getElementById('add-work-form');
        const modalTitle = document.getElementById('modal-title');

        const titles = {
            'survey': 'เพิ่มงานฝ่ายรังวัด',
            'registration': 'เพิ่มงานฝ่ายทะเบียน',
            'academic': 'เพิ่มงานกลุ่มงานวิชาการ'
        };
        if (modalTitle) modalTitle.innerText = titles[type] || 'เพิ่มงานใหม่';

        if (formContainer && UI.renderAddForm) {
            formContainer.innerHTML = UI.renderAddForm(type);
            document.getElementById('add-work-modal').classList.remove('hidden');
        }
    },

    async handleSaveWork() {
        if (!this.currentAddType) return;

        const form = document.getElementById('add-work-form');
        const formData = new FormData(form);
        formData.append('type', this.currentAddType);

        // Basic validation
        let isValid = true;
        form.querySelectorAll('[required]').forEach(input => {
            if (!input.value) {
                isValid = false;
                input.classList.add('border-red-500');
            } else {
                input.classList.remove('border-red-500');
            }
        });

        if (!isValid) {
            Swal.fire('กรุณากรอกข้อมูล', 'โปรดระบุข้อมูลในช่องที่จำเป็น', 'warning');
            return;
        }

        try {
            const response = await fetch('api/save_work.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.status === 'success') {
                document.getElementById('add-work-modal').classList.add('hidden');
                Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');

                if (this.currentAddType === 'survey') this.refreshSurveyList();
                else if (this.currentAddType === 'registration') this.refreshRegistrationList();
                else if (this.currentAddType === 'academic') this.refreshAcademicList();

            } else {
                Swal.fire('Error', result.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    },

    // === Completed Work Modal Functions ===
    currentCompletedType: null,

    showCompletedWorkModal(type = null) {
        const modalTitle = document.getElementById('completed-modal-title');
        const formContainer = document.getElementById('completed-work-form');

        // ถ้ามี type ที่ระบุมา (จาก department-specific button)
        this.currentCompletedType = type;

        const titles = {
            'survey': 'บันทึกงานเสร็จ - ฝ่ายรังวัด',
            'registration': 'บันทึกงานเสร็จ - ฝ่ายทะเบียน',
            'academic': 'บันทึกงานเสร็จ - กลุ่มงานวิชาการ'
        };

        // ถ้าไม่ได้ระบุ type แต่ user เป็น staff ของแผนกเฉพาะ ให้ตั้งเป็นแผนกนั้น
        const userDept = this.currentUser?.department;
        if (!type && userDept && userDept !== 'all') {
            type = userDept;
            this.currentCompletedType = type;
        }

        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-check-circle mr-3"></i> ${titles[type] || 'บันทึกงานเสร็จ'}`;
        }

        if (formContainer && UI.renderCompletedAddForm) {
            formContainer.innerHTML = UI.renderCompletedAddForm(type);
            document.getElementById('completed-work-modal').classList.remove('hidden');
        }
    },

    updateCompletedFormFields(type) {
        this.currentCompletedType = type;
        const formContainer = document.getElementById('completed-work-form');
        const modalTitle = document.getElementById('completed-modal-title');

        const titles = {
            'survey': 'บันทึกงานเสร็จ - ฝ่ายรังวัด',
            'registration': 'บันทึกงานเสร็จ - ฝ่ายทะเบียน',
            'academic': 'บันทึกงานเสร็จ - กลุ่มงานวิชาการ'
        };

        if (modalTitle) {
            modalTitle.innerHTML = `<i class="fas fa-check-circle mr-3"></i> ${titles[type] || 'บันทึกงานเสร็จ'}`;
        }

        if (formContainer && UI.renderCompletedAddForm) {
            formContainer.innerHTML = UI.renderCompletedAddForm(type);
        }
    },

    async handleSaveCompletedWork() {
        const deptSelect = document.getElementById('completed-dept-select');
        const type = deptSelect?.value || this.currentCompletedType;

        if (!type) {
            Swal.fire('กรุณาเลือกฝ่าย', 'โปรดเลือกฝ่าย/กลุ่มงานก่อนบันทึก', 'warning');
            return;
        }

        const form = document.getElementById('completed-work-form');
        const formData = new FormData(form);
        formData.append('type', type);
        formData.append('is_completed', '1'); // Flag ให้ backend รู้ว่าเป็นงานเสร็จ

        // Basic validation
        let isValid = true;
        form.querySelectorAll('[required]').forEach(input => {
            if (!input.value) {
                isValid = false;
                input.classList.add('border-red-500');
            } else {
                input.classList.remove('border-red-500');
            }
        });

        if (!isValid) {
            Swal.fire('กรุณากรอกข้อมูล', 'โปรดระบุข้อมูลในช่องที่จำเป็น', 'warning');
            return;
        }

        try {
            const response = await fetch('api/save_work.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.status === 'success') {
                document.getElementById('completed-work-modal').classList.add('hidden');
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกงานเสร็จสำเร็จ!',
                    text: 'งานถูกบันทึกและนับว่าเสร็จสิ้นแล้ว',
                    confirmButtonColor: '#10B981'
                });

                // Refresh list ตามแผนก
                if (type === 'survey') this.refreshSurveyList();
                else if (type === 'registration') this.refreshRegistrationList();
                else if (type === 'academic') this.refreshAcademicList();

            } else {
                Swal.fire('Error', result.message || 'เกิดข้อผิดพลาด', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    },

    async quickUpdateStatus(id, type, status) {
        const today = new Date().toISOString().split('T')[0];
        try {
            if (type === 'survey') {
                await DataManager.updateSurveyItem({ id, status_cause: status, completion_date: today });
            } else if (type === 'registration') {
                await DataManager.updateRegistrationItem({ id, status_cause: status, completion_date: today });
            } else if (type === 'academic') {
                await DataManager.updateAcademicItem({ id, status_cause: status, completion_date: today });
            }

            Swal.fire('สำเร็จ', 'อัปเดตสถานะเป็น "เสร็จสิ้น" เรียบร้อยแล้ว', 'success');
            document.getElementById('detail-modal').classList.add('hidden');
            this.refreshLists(type);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถอัปเดตข้อมูลได้', 'error');
        }
    },

    async saveStatusUpdate(id, type) {
        const status = document.getElementById('update-status-input').value;
        const completion_date = document.getElementById('update-completion-date').value;

        try {
            if (type === 'survey') {
                const rv_12 = document.getElementById('update-rv12-input')?.value;
                await DataManager.updateSurveyItem({ id, status_cause: status, completion_date, rv_12 });
            } else if (type === 'registration') {
                await DataManager.updateRegistrationItem({ id, status_cause: status, completion_date });
            } else if (type === 'academic') {
                await DataManager.updateAcademicItem({ id, status_cause: status, completion_date });
            }

            Swal.fire('สำเร็จ', 'บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว', 'success');
            document.getElementById('detail-modal').classList.add('hidden');
            this.refreshLists(type);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    },

    async deleteWork(id, type) {
        const result = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: 'ข้อมูลงานจะถูกลบถาวรและไม่สามารถกู้คืนได้',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i> ลบงาน',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            try {
                const apiEndpoint = `api/${type}.php`;
                const response = await fetch(apiEndpoint, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: id })
                });

                const data = await response.json();
                if (response.ok && data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'ลบสำเร็จ!',
                        text: 'ข้อมูลงานถูกลบเรียบร้อยแล้ว',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    document.getElementById('detail-modal').classList.add('hidden');
                    this.refreshLists(type);
                } else {
                    throw new Error(data.message || 'Delete failed');
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'ไม่สามารถลบข้อมูลได้: ' + error.message, 'error');
            }
        }
    },

    refreshLists(type) {
        if (type === 'survey' || !type) this.refreshSurveyList();
        if (type === 'registration' || !type) this.refreshRegistrationList();
        if (type === 'academic' || !type) this.refreshAcademicList();

        // Always refresh dashboard and report if visible
        const content = document.getElementById('app-content');
        if (content) {
            if (this.currentPage === 'dashboard') UI.renderDashboard().then(html => content.innerHTML = html);
            if (this.currentPage === 'report') UI.renderReport().then(html => content.innerHTML = html);
        }
    },

    async setSurveyStatusView(view) {
        this.surveyStatusView = view;
        this.currentSurveyPage = 1;
        // Show loading indicator while switching
        const content = document.getElementById('app-content');
        content.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-4xl text-indigo-500"></i></div>';
        await this.refreshSurveyList();
    },

    async setRegistrationStatusView(view) {
        this.registrationStatusView = view;
        this.currentRegistrationPage = 1;
        // Show loading indicator while switching
        const content = document.getElementById('app-content');
        content.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-4xl text-emerald-500"></i></div>';
        await this.refreshRegistrationList();
    },

    async setAcademicStatusView(view) {
        this.academicStatusView = view;
        this.currentAcademicPage = 1;
        // Show loading indicator while switching
        const content = document.getElementById('app-content');
        content.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-4xl text-amber-500"></i></div>';
        await this.refreshAcademicList();
    },

    // KPI Report Date Handler
    async updateKPIReport(dateValue) {
        const content = document.getElementById('app-content');
        if (content) {
            content.innerHTML = await UI.renderReport(dateValue);

            // Refresh AOS animations
            if (typeof AOS !== 'undefined') {
                setTimeout(() => AOS.refresh(), 100);
            }
        }
    },

    // Show monthly items modal
    async showMonthlyItems(year, month) {
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const monthName = thaiMonths[month - 1];
        const yearBE = year + 543;

        // Get KPI data with the current report date
        const reportDate = document.getElementById('kpi-report-date')?.value || null;
        const kpiData = await DataManager.getKPIReport(reportDate);

        // Find the month data
        const monthData = kpiData.oldWork.monthlyProgress.find(m => m.yearAD === year && m.monthNum === month);

        if (!monthData || !monthData.items || monthData.items.length === 0) {
            Swal.fire('ไม่มีข้อมูล', `ไม่พบงานที่เสร็จในเดือน ${monthName} ${yearBE}`, 'info');
            return;
        }

        // Build table rows
        const tableRows = monthData.items.map((item, idx) => `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="px-3 py-2 text-center text-sm text-gray-500">${idx + 1}</td>
                <td class="px-3 py-2 text-sm text-gray-600">${item.department || '-'}</td>
                <td class="px-3 py-2 text-sm text-gray-800 font-medium">${item.subject || item.applicant || '-'}</td>
                <td class="px-3 py-2 text-sm text-gray-600">${UI.formatThaiDate(item.received_date)}</td>
                <td class="px-3 py-2 text-sm text-emerald-600 font-medium">${UI.formatThaiDate(item.completion_date)}</td>
            </tr>
        `).join('');

        // Show modal with SweetAlert2
        Swal.fire({
            title: `<i class="fas fa-list-check text-orange-500 mr-2"></i>งานที่เสร็จ ${monthName} ${yearBE}`,
            html: `
                <div class="text-left">
                    <div class="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div class="flex justify-between items-center">
                            <span class="text-orange-700 font-bold">จำนวนทั้งหมด:</span>
                            <span class="text-2xl font-black text-orange-600">${monthData.items.length} งาน</span>
                        </div>
                    </div>
                    <div class="overflow-x-auto max-h-96">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase">ที่</th>
                                    <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase">ฝ่าย</th>
                                    <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase">เรื่อง/ราย</th>
                                    <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase">วันที่รับ</th>
                                    <th class="px-3 py-2 text-xs font-bold text-emerald-600 uppercase">วันที่เสร็จ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `,
            width: 800,
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#F97316',
            customClass: {
                popup: 'rounded-2xl',
                title: 'text-lg font-bold text-gray-800'
            }
        });
    },

    // Export to PDF using Official Template and Browser Print (Professional/Official version)
    async exportToPDF() {
        Swal.fire({
            title: 'กำลังเตรียมเอกสารราชการ...',
            html: 'กรุณารอสักครู่ ระบบกำลังจัดรูปแบบรายงานแบบเป็นทางการ',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const reportDate = document.getElementById('kpi-report-date')?.value || null;
            const kpiData = await DataManager.getKPIReport(reportDate);

            // Generate the professional HTML template
            const reportHtml = UI.renderOfficialPrintTemplate(kpiData);

            // Create a temporary iframe or open a new window for printing
            const printWindow = window.open('', '_blank', 'width=1000,height=800');

            if (!printWindow) {
                throw new Error('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณายอมรับ Pop-up ในเบราว์เซอร์ของคุณ');
            }

            printWindow.document.write(reportHtml);
            printWindow.document.close();

            // Wait for images and fonts to load before printing
            printWindow.onload = function () {
                setTimeout(() => {
                    printWindow.print();
                    // printWindow.close(); // optional: close after print
                }, 500);
            };

            Swal.fire({
                icon: 'success',
                title: 'เตรียมเอกสารสำเร็จ!',
                text: 'กรุณาเลือก "Save as PDF" ในหน้าต่างที่เปิดขึ้นมา เพื่อดาวน์โหลดไฟล์รายงานแบบเป็นทางการ',
                confirmButtonColor: '#10B981'
            });
        } catch (error) {
            console.error('Official PDF Export Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถสร้างรายงานได้: ' + error.message,
                confirmButtonColor: '#EF4444'
            });
        }
    },

    // Export to Excel
    async exportToExcel() {
        Swal.fire({
            title: 'กำลังสร้าง Excel...',
            html: 'กรุณารอสักครู่',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const reportDate = document.getElementById('kpi-report-date')?.value || null;
            const kpiData = await DataManager.getKPIReport(reportDate);

            // Create workbook
            const wb = XLSX.utils.book_new();

            // Sheet 1: Summary
            const summaryData = [
                ['รายงาน KPI งานค้าง - สนง.ที่ดินจังหวัดอ่างทอง'],
                ['วันที่รายงาน: ' + (kpiData.reportDate || new Date().toLocaleDateString('th-TH'))],
                [''],
                ['=== โซน 1: งานเก่า (ก่อน ม.ค. 2569) ==='],
                ['งานเก่าทั้งหมด (Baseline)', kpiData.oldWork.baseline.total],
                ['ดำเนินการเสร็จแล้ว', kpiData.oldWork.summary.totalCompleted],
                ['คงเหลือ', kpiData.oldWork.summary.remaining],
                ['% ลดลง', kpiData.oldWork.summary.currentPercent.toFixed(1) + '%'],
                [''],
                ['=== โซน 2: งานใหม่ (ตั้งแต่ ม.ค. 2569) ==='],
                ['งานใหม่ทั้งหมด', kpiData.newWork.total],
                ['เสร็จแล้ว', kpiData.newWork.completed],
                ['รอดำเนินการ', kpiData.newWork.pending],
                ['เสร็จใน 30 วัน', kpiData.newWork.breakdown.within30Days + ' (' + kpiData.newWork.percentages.within30.toFixed(1) + '%)'],
                ['เสร็จใน 60 วัน', kpiData.newWork.breakdown.within60Days + ' (' + kpiData.newWork.percentages.within60.toFixed(1) + '%)']
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            // Sheet 2: Old Work Monthly
            if (kpiData.oldWork.monthlyProgress && kpiData.oldWork.monthlyProgress.length > 0) {
                const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
                const monthlyHeaders = ['เดือน', 'งานค้างต้นเดือน', 'เสร็จในเดือน', 'งานค้างสิ้นเดือน', '% ลดลง', 'ผลการประเมิน'];
                const monthlyRows = kpiData.oldWork.monthlyProgress.map(m => [
                    thaiMonths[m.monthNum - 1] + ' ' + m.year,
                    m.backlogStart,
                    m.completedThisMonth,
                    m.backlogEnd,
                    m.percentThisMonth.toFixed(1) + '%',
                    m.achieved ? 'บรรลุเป้าหมาย' : 'ไม่บรรลุเป้าหมาย'
                ]);
                const wsMonthly = XLSX.utils.aoa_to_sheet([monthlyHeaders, ...monthlyRows]);
                XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Progress');
            }

            // Sheet 3: Old Work Details (รายละเอียดงานเก่าที่เสร็จแล้ว - เหมือน PDF ภาคผนวก)
            if (kpiData.oldWork.monthlyProgress && kpiData.oldWork.monthlyProgress.length > 0) {
                const oldWorkDetailsHeaders = ['เดือน/ปี', 'ลำดับ', 'ฝ่าย', 'เรื่อง/ผู้ขอ', 'วันที่รับ', 'วันที่เสร็จ'];
                const oldWorkDetailsRows = [];

                kpiData.oldWork.monthlyProgress.forEach(m => {
                    if (m.items && m.items.length > 0) {
                        m.items.forEach((item, idx) => {
                            oldWorkDetailsRows.push([
                                m.month + ' ' + m.year,
                                idx + 1,
                                item.department || '-',
                                item.subject || item.applicant || '-',
                                item.received_date || '-',
                                item.completion_date || '-'
                            ]);
                        });
                    }
                });

                if (oldWorkDetailsRows.length > 0) {
                    const wsOldDetails = XLSX.utils.aoa_to_sheet([oldWorkDetailsHeaders, ...oldWorkDetailsRows]);
                    XLSX.utils.book_append_sheet(wb, wsOldDetails, 'Old Work Details');
                }
            }

            // Sheet 4: New Work Details (รายละเอียดงานใหม่ที่เสร็จแล้ว)
            if (kpiData.newWork.completedItems && kpiData.newWork.completedItems.length > 0) {
                const newWorkDetailsHeaders = ['ลำดับ', 'ฝ่าย', 'เรื่อง/ผู้ขอ', 'วันที่รับ', 'วันที่เสร็จ', 'จำนวนวัน', 'สถานะ'];
                const newWorkDetailsRows = kpiData.newWork.completedItems.map((item, idx) => {
                    const days = item.daysToComplete || '-';
                    let status = 'เสร็จสิ้น';

                    if (typeof days === 'number') {
                        if (days <= 30) {
                            status = 'เสร็จใน 30 วัน ✓';
                        } else if (days <= 60) {
                            status = 'เสร็จใน 60 วัน';
                        } else {
                            status = 'เสร็จเกิน 60 วัน';
                        }
                    }

                    return [
                        idx + 1,
                        item.department || '-',
                        item.subject || item.applicant || '-',
                        item.received_date || '-',
                        item.completion_date || '-',
                        days,
                        status
                    ];
                });

                const wsNewDetails = XLSX.utils.aoa_to_sheet([newWorkDetailsHeaders, ...newWorkDetailsRows]);
                XLSX.utils.book_append_sheet(wb, wsNewDetails, 'New Work Details');
            }

            // Save
            XLSX.writeFile(wb, 'KPI_Report_' + new Date().toISOString().split('T')[0] + '.xlsx');

            Swal.fire({
                icon: 'success',
                title: 'Export Excel สำเร็จ!',
                text: 'ไฟล์ Excel ถูกดาวน์โหลดแล้ว',
                confirmButtonColor: '#10B981'
            });
        } catch (error) {
            console.error('Excel Export Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถสร้าง Excel ได้',
                confirmButtonColor: '#EF4444'
            });
        }
    },

    // ==================== PROGRESS TYPE & HISTORY MANAGEMENT ====================

    // Update progress type
    async updateProgressType(itemId, workType, newType, isChecked) {
        try {
            // If unchecking, set to type 1 (normal)
            const progressType = isChecked ? newType : 1;

            // Get old progress type
            let items;
            if (workType === 'survey') {
                items = await DataManager.getSurveyItems();
            } else if (workType === 'registration') {
                items = await DataManager.getRegistrationItems();
            } else {
                items = await DataManager.getAcademicItems();
            }

            const item = items.find(i => i.id == itemId);
            const oldType = item?.progress_type || 4;

            // Determine table name and API endpoint
            const tableMap = {
                'survey': 'survey_works',
                'registration': 'registration_works',
                'academic': 'academic_works'
            };

            // Call API to update
            const response = await fetch(`api/${workType}.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: itemId,
                    progress_type: progressType
                })
            });

            if (!response.ok) throw new Error('Failed to update progress type');

            // Log to history
            const typeLabels = {
                1: 'งานปกติ',
                2: 'งานสุดขั้นตอน',
                3: 'งานศาล',
                4: 'งานค้าง'
            };

            await this.addStatusHistory(itemId, workType, 'เปลี่ยนหมวดหมู่', typeLabels[oldType], typeLabels[progressType]);

            // Refresh the detail view
            if (workType === 'survey') {
                this.viewSurveyDetail(itemId);
            } else if (workType === 'registration') {
                this.viewRegistrationDetail(itemId);
            } else {
                this.viewAcademicDetail(itemId);
            }

            // Refresh the main list in background (Real-time update)
            this.refreshLists(workType);

            Swal.fire({
                icon: 'success',
                title: 'อัปเดตหมวดหมู่แล้ว!',
                text: `เปลี่ยนเป็น "${typeLabels[progressType]}"`,
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

        } catch (error) {
            console.error('Update progress type error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถอัปเดตหมวดหมู่ได้'
            });
        }
    },

    // Load status history for a work item
    async loadStatusHistory(workId, workType) {
        try {
            const response = await fetch(`api/status_history.php?work_type=${workType}&work_id=${workId}`);
            const history = await response.json();

            const historyList = document.getElementById('history-list');
            if (!historyList) return;

            if (history.length === 0) {
                historyList.innerHTML = UI.renderEmptyHistory();
            } else {
                historyList.innerHTML = history.map(h => UI.formatHistoryItem(h)).join('');
            }
        } catch (error) {
            console.error('Load history error:', error);
            const historyList = document.getElementById('history-list');
            if (historyList) {
                historyList.innerHTML = `
                    <div class="text-center py-4 text-red-500">
                        <i class="fas fa-exclamation-circle mr-2"></i>ไม่สามารถโหลดประวัติได้
                    </div>
                `;
            }
        }
    },

    // Add status history entry
    async addStatusHistory(workId, workType, actionType, oldValue = null, newValue = null, note = null) {
        try {
            const response = await fetch('api/status_history.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_type: workType,
                    work_id: workId,
                    action_type: actionType,
                    old_value: oldValue,
                    new_value: newValue,
                    note: note,
                    changed_by: this.currentUser?.name || this.currentUser?.username || 'ผู้ใช้งาน'
                })
            });

            if (!response.ok) throw new Error('Failed to add history');
            return await response.json();
        } catch (error) {
            console.error('Add history error:', error);
            throw error;
        }
    },

    // Show modal to add history note
    showAddHistoryModal(workId, workType) {
        Swal.fire({
            title: '<i class="fas fa-plus-circle text-amber-500 mr-2"></i> เพิ่มบันทึกประวัติ',
            html: `
                <div class="text-left space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">ประเภทการดำเนินการ</label>
                        <select id="history-action-type" class="w-full border rounded-lg p-2 text-sm">
                            <option value="อัปเดตสถานะ">อัปเดตสถานะ</option>
                            <option value="ติดต่อคู่กรณี">ติดต่อคู่กรณี</option>
                            <option value="ส่งหนังสือ">ส่งหนังสือ</option>
                            <option value="รอเอกสาร">รอเอกสาร</option>
                            <option value="ประชุม/หารือ">ประชุม/หารือ</option>
                            <option value="รอดำเนินการศาล">รอดำเนินการศาล</option>
                            <option value="หมายเหตุอื่นๆ">หมายเหตุอื่นๆ</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">รายละเอียด/หมายเหตุ</label>
                        <textarea id="history-note" rows="3" class="w-full border rounded-lg p-2 text-sm" placeholder="ระบุรายละเอียดการดำเนินการ..."></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-save mr-1"></i> บันทึก',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#F59E0B',
            focusConfirm: false,
            preConfirm: () => {
                const actionType = document.getElementById('history-action-type').value;
                const note = document.getElementById('history-note').value;

                if (!note.trim()) {
                    Swal.showValidationMessage('กรุณาระบุรายละเอียด');
                    return false;
                }

                return { actionType, note };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await this.addStatusHistory(workId, workType, result.value.actionType, null, null, result.value.note);

                    // Reload history
                    await this.loadStatusHistory(workId, workType);

                    Swal.fire({
                        icon: 'success',
                        title: 'บันทึกประวัติแล้ว!',
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'เกิดข้อผิดพลาด',
                        text: error.message || 'ไม่สามารถบันทึกประวัติได้'
                    });
                }
            }
        });
    },

    // Edit a history entry
    async editHistory(historyId, currentActionType, currentNote, workType, workId) {
        const { value: formValues } = await Swal.fire({
            title: '<i class="fas fa-edit text-blue-500 mr-2"></i> แก้ไขประวัติ',
            html: `
                <div class="text-left space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">ประเภทการดำเนินการ</label>
                        <select id="edit-action-type" class="w-full border rounded-lg p-2 text-sm">
                            <option value="อัปเดตสถานะ" ${currentActionType === 'อัปเดตสถานะ' ? 'selected' : ''}>อัปเดตสถานะ</option>
                            <option value="ติดต่อคู่กรณี" ${currentActionType === 'ติดต่อคู่กรณี' ? 'selected' : ''}>ติดต่อคู่กรณี</option>
                            <option value="ส่งหนังสือ" ${currentActionType === 'ส่งหนังสือ' ? 'selected' : ''}>ส่งหนังสือ</option>
                            <option value="รอเอกสาร" ${currentActionType === 'รอเอกสาร' ? 'selected' : ''}>รอเอกสาร</option>
                            <option value="ประชุม/หารือ" ${currentActionType === 'ประชุม/หารือ' ? 'selected' : ''}>ประชุม/หารือ</option>
                            <option value="รอดำเนินการศาล" ${currentActionType === 'รอดำเนินการศาล' ? 'selected' : ''}>รอดำเนินการศาล</option>
                            <option value="เพิ่มหมายเหตุ" ${currentActionType === 'เพิ่มหมายเหตุ' ? 'selected' : ''}>เพิ่มหมายเหตุ</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">หมายเหตุ / รายละเอียด</label>
                        <textarea id="edit-note" rows="3" class="w-full border rounded-lg p-2 text-sm" 
                            placeholder="รายละเอียดเพิ่มเติม...">${currentNote}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-save mr-2"></i> บันทึก',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#3B82F6',
            preConfirm: () => {
                return {
                    actionType: document.getElementById('edit-action-type').value,
                    note: document.getElementById('edit-note').value
                };
            }
        });

        if (formValues) {
            try {
                const response = await fetch('api/status_history.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: historyId,
                        action_type: formValues.actionType,
                        note: formValues.note
                    })
                });

                if (!response.ok) throw new Error('Failed to update history');

                // Reload history
                await this.loadStatusHistory(workId, workType);

                Swal.fire({
                    icon: 'success',
                    title: 'แก้ไขประวัติแล้ว!',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } catch (error) {
                console.error('Edit history error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: error.message || 'ไม่สามารถแก้ไขประวัติได้'
                });
            }
        }
    },

    // Delete a history entry
    async deleteHistory(historyId, workType, workId) {
        const result = await Swal.fire({
            title: '<i class="fas fa-trash text-red-500 mr-2"></i> ลบประวัติ?',
            text: 'คุณต้องการลบรายการประวัตินี้หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-trash mr-2"></i> ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#EF4444'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch('api/status_history.php', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: historyId })
                });

                if (!response.ok) throw new Error('Failed to delete history');

                // Reload history
                await this.loadStatusHistory(workId, workType);

                Swal.fire({
                    icon: 'success',
                    title: 'ลบประวัติแล้ว!',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } catch (error) {
                console.error('Delete history error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: error.message || 'ไม่สามารถลบประวัติได้'
                });
            }
        }
    },

    // ==================== EXCEL/CSV IMPORT ====================

    // Show import modal
    showImportModal(workType, isCompleted = false) {
        const typeLabels = {
            'survey': 'งานฝ่ายรังวัด',
            'registration': 'งานฝ่ายทะเบียน',
            'academic': 'งานกลุ่มงานวิชาการ'
        };

        const typeColors = {
            'survey': 'indigo',
            'registration': 'blue',
            'academic': 'orange'
        };

        const color = isCompleted ? 'green' : (typeColors[workType] || 'emerald');
        const title = isCompleted ? `นำเข้างานที่เสร็จแล้ว (${typeLabels[workType]})` : `นำเข้าข้อมูล${typeLabels[workType]}`;
        const icon = isCompleted ? 'fa-check-double' : 'fa-file-upload';

        Swal.fire({
            title: `<h3 class="text-xl font-bold flex items-center justify-center"><i class="fas ${icon} text-${color}-600 mr-2"></i> ${title}</h3>`,
            html: `
                <div class="text-left space-y-4">
                    <!-- Download Template Section -->
                    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h4 class="font-bold text-gray-700 mb-2 text-sm"><i class="fas fa-download mr-2 text-${color}-500"></i>1. ดาวน์โหลดไฟล์ต้นแบบ</h4>
                        <p class="text-xs text-gray-500 mb-3">ดาวน์โหลดไฟล์ต้นแบบแล้วกรอกข้อมูลตามรูปแบบที่กำหนด</p>
                        <div class="flex gap-2">
                            <button onclick="app.downloadTemplate('${workType}', 'csv')" 
                                class="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition flex items-center">
                                <i class="fas fa-file-csv mr-2"></i> CSV
                            </button>
                            <button onclick="app.downloadTemplate('${workType}', 'xlsx')" 
                                class="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center">
                                <i class="fas fa-file-excel mr-2"></i> Excel
                            </button>
                        </div>
                    </div>

                    <!-- Upload Section -->
                    <div class="bg-${color}-50 p-4 rounded-xl border border-${color}-200">
                        <h4 class="font-bold text-gray-700 mb-2 text-sm"><i class="fas fa-upload mr-2 text-${color}-500"></i>2. อัปโหลดไฟล์ข้อมูล</h4>
                        <p class="text-xs text-gray-500 mb-3">เลือกไฟล์ Excel (.xlsx) หรือ CSV (.csv) ที่กรอกข้อมูลแล้ว</p>
                        <input type="file" id="import-file" 
                            accept=".csv,.xlsx,.xls"
                            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-${color}-500 file:text-white hover:file:bg-${color}-600 cursor-pointer"
                        >
                    </div>

                    ${isCompleted ? `
                    <div class="bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <h4 class="font-bold text-gray-700 mb-2 text-sm"><i class="fas fa-tasks mr-2 text-blue-500"></i>3. ระบุประเภทงาน</h4>
                        <select id="import-progress-type" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm border p-2">
                            <option value="1">งานปกติ / เสร็จสิ้น</option>
                            <option value="2">งานสุดขั้นตอน</option>
                            <option value="3">งานศาล</option>
                        </select>
                    </div>
                    ` : ''}

                    <!-- Mode Selection -->
                    <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <label class="flex items-center cursor-pointer group">
                            <div class="relative">
                                <input type="checkbox" id="import-mode-update" class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-${color}-600"></div>
                            </div>
                            <span class="ml-3 text-sm font-bold text-gray-700 group-hover:text-${color}-600 transition-colors">โหมดอัปเดตสาเหตุค้าง (Update Mode)</span>
                        </label>
                        <p class="text-[10px] text-gray-400 mt-2 ml-14"><i class="fas fa-info-circle mr-1"></i> ใช้เพื่ออัปเดตงานที่มีอยู่แล้วในระบบ โดยเช็คจาก วันที่รับ, ประเภทงาน และชื่อผู้ขอ</p>
                    </div>

                    <!-- Info -->
                    <div class="text-xs text-gray-400">
                        ${isCompleted ? `
                            <p class="text-green-600 font-bold"><i class="fas fa-check-circle mr-1"></i> รายการทั้งหมดจะถูกตั้งสถานะเป็น "เสร็จสิ้น" ทันที</p>
                            <p class="text-green-600 font-bold"><i class="fas fa-calendar-alt mr-1"></i> วันที่เสร็จจะเท่ากับวันที่รับเรื่องในไฟล์</p>
                        ` : `
                            <p><i class="fas fa-info-circle mr-1"></i> งานที่รับเรื่องเกิน 30 วัน จะถูกตั้งค่าเป็น "งานค้าง" อัตโนมัติ</p>
                        `}
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-upload mr-2"></i> นำเข้าข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: isCompleted ? '#10B981' : (color === 'indigo' ? '#6366F1' : color === 'blue' ? '#3B82F6' : '#F97316'),
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                const fileInput = document.getElementById('import-file');
                if (!fileInput.files.length) {
                    Swal.showValidationMessage('กรุณาเลือกไฟล์');
                    return false;
                }
                const progressType = document.getElementById('import-progress-type')?.value || '1';
                const isUpdateMode = document.getElementById('import-mode-update')?.checked || false;
                return this.processImport(workType, fileInput.files[0], isCompleted, progressType, isUpdateMode);
            },
            allowOutsideClick: () => !Swal.isLoading()
        });
    },

    // Process import file
    async processImport(workType, file, isCompleted = false, progressType = '1', isUpdateMode = false) {
        const formData = new FormData();
        formData.append('work_type', workType);
        formData.append('file', file);

        if (isUpdateMode) {
            formData.append('import_mode', 'update');
        }

        // สำหรับการนำเข้างานที่เสร็จแล้ว
        if (isCompleted) {
            const pType = parseInt(progressType, 10);
            if (pType === 1) {
                // งานปกติ/เสร็จสิ้น = งานเสร็จจริงๆ → ใส่ completion_date
                formData.append('is_completed', '1');
                formData.append('progress_type', '1');
            } else if (pType === 2 || pType === 3) {
                // งานสุดขั้นตอน/งานศาล = ยังไม่เสร็จ แค่แยกหมวดหมู่
                // ไม่ใส่ completion_date, แค่ตั้ง progress_type
                formData.append('progress_type', progressType);
            }
        }

        try {
            const response = await fetch('api/import.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'นำเข้าข้อมูลสำเร็จ!',
                    html: `
                        <div class="text-center">
                            <p class="text-2xl font-bold text-emerald-600">${result.inserted || 0} รายการ</p>
                            <p class="text-sm text-gray-500 mb-2">จากทั้งหมด ${result.total} รายการ</p>
                            
                            ${result.updated ? `<p class="text-xs font-bold text-blue-600"><i class="fas fa-edit mr-1"></i> อัปเดต: ${result.updated} รายการ</p>` : ''}
                            ${result.skipped ? `<p class="text-xs font-bold text-amber-500"><i class="fas fa-forward mr-1"></i> ข้าม: ${result.skipped} รายการ</p>` : ''}
                            
                            ${result.errors.length > 0 ? `
                                <div class="mt-3 text-left bg-red-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                                    <p class="text-xs text-red-600 font-bold mb-1">รายการที่มีปัญหา:</p>
                                    ${result.errors.slice(0, 5).map(e => `<p class="text-xs text-red-500">${e}</p>`).join('')}
                                    ${result.errors.length > 5 ? `<p class="text-xs text-red-400">...และอีก ${result.errors.length - 5} รายการ</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `,
                    confirmButtonColor: '#10B981'
                });

                // Refresh the list
                if (workType === 'survey') this.refreshSurveyList();
                else if (workType === 'registration') this.refreshRegistrationList();
                else if (workType === 'academic') this.refreshAcademicList();

                return true;
            } else {
                throw new Error(result.message || 'Import failed');
            }
        } catch (error) {
            Swal.showValidationMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            return false;
        }
    },

    // Download template file
    downloadTemplate(workType, format) {
        window.location.href = `api/template.php?type=${workType}&format=${format}`;
    },

    // ==================== KPI ACTION PLAN ====================

    // Load KPI data from API
    async loadKPIData(date = null) {
        try {
            const today = new Date();
            // Use provided date or current month
            const yearMonth = date
                ? date.slice(0, 7) // YYYY-MM if full date provided
                : today.toISOString().slice(0, 7);

            console.log('Loading KPI Data for:', yearMonth); // Debug

            const response = await fetch(`api/kpi_report.php?years_month=${yearMonth}&department=all`);
            if (!response.ok) throw new Error('Failed to load KPI data');

            return await response.json();
        } catch (error) {
            console.error('Error loading KPI data:', error);
            return {
                autoData: {
                    oldWork: { baseline: 0, completed: 0, pending: 0, monthlyCompleted: [] },
                    newWork: { total: 0, completed: 0, pending: 0 }
                },
                savedData: {},
                breakdown: {}
            };
        }
    },

    // Save KPI Note
    async saveKPINote(yearMonth, dept, note) {
        try {
            const response = await fetch('api/kpi_report.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    years_month: yearMonth,
                    department: dept,
                    notes: note,
                    created_by: 'ผู้ดูแลระบบ'
                })
            });

            if (!response.ok) throw new Error('Failed to save note');

            // Visual feedback
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });

            Toast.fire({
                icon: 'success',
                title: 'บันทึกหมายเหตุเรียบร้อยแล้ว'
            });
        } catch (error) {
            console.error('Error saving KPI note:', error);
            Swal.fire('Error', 'ไม่สามารถบันทึกหมายเหตุได้', 'error');
        }
    },

    // Show modal to save manually completed work today
    async showKPISaveCompletionModal(defaultDept = 'survey') {
        Swal.fire({
            title: 'บันทึกงานเสร็จวันนี้',
            html: `
                <div class="space-y-4 py-4">
                    <div class="flex flex-col gap-1 text-left">
                        <label class="text-sm font-bold text-gray-700">เลือกฝ่าย</label>
                        <select id="swal-dept" class="w-full p-2 border rounded-lg">
                            <option value="survey" ${defaultDept === 'survey' ? 'selected' : ''}>รังวัด</option>
                            <option value="registration" ${defaultDept === 'registration' ? 'selected' : ''}>ทะเบียน</option>
                            <option value="academic" ${defaultDept === 'academic' ? 'selected' : ''}>วิชาการ</option>
                        </select>
                    </div>
                    <div class="flex flex-col gap-1 text-left">
                        <label class="text-sm font-bold text-gray-700">จำนวนงานที่เสร็จ (เรื่อง)</label>
                        <input type="number" id="swal-count" class="w-full p-2 border rounded-lg" value="1" min="1">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก',
            preConfirm: () => {
                return {
                    dept: document.getElementById('swal-dept').value,
                    count: document.getElementById('swal-count').value
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const monthInput = document.getElementById('kpi-report-month');
                const yearMonth = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);

                try {
                    const response = await fetch('api/kpi_report.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            years_month: yearMonth,
                            department: result.value.dept,
                            completed_within_30: parseInt(result.value.count, 10),
                            created_by: this.currentUser?.name || 'ผู้ดูแลระบบ'
                        })
                    });

                    if (!response.ok) throw new Error('Failed to save completion data');

                    Swal.fire({
                        title: 'บันทึกสำเร็จ!',
                        text: 'บันทึกข้อมูลงานเสร็จเรียบร้อยแล้ว',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        this.updateKPIReport(yearMonth + '-01');
                    });
                } catch (error) {
                    console.error('Error saving KPI completion:', error);
                    Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
                }
            }
        });
    },

    // Update KPI Report View based on date selection
    async updateKPIReport(date) {
        try {
            // Show loading state
            const contentDiv = document.getElementById('content-area') || document.getElementById('main-content'); // Adjust selector as needed
            if (contentDiv) {
                // If we are just updating the content inside the report container, we might specifically target that if possible
                // But generally we re-render the whole report view
                // Actually, renderReport in UI returns the HTML string.
                // We need to fetch data first, then call UI.renderKPIActionPlan?
                // Wait, UI.renderReport does the fetching AND returning HTML? No, renderReport calls DataManager (now app.loadKPIData).

                // Let's rely on UI.renderReport to fetch data if we pass the date?
                // In UI.js: renderReport(reportDate) calls fetch.

                // So here we should just re-render the page content
                const html = await UI.renderReport(date);
                contentDiv.innerHTML = html;

                // Re-initialize AOS or other plugins if needed
                if (typeof AOS !== 'undefined') AOS.refresh();
            }
        } catch (error) {
            console.error('Error updating KPI report:', error);
            Swal.fire('Error', 'ไม่สามารถโหลดรายงานได้', 'error');
        }
    },

    // Save KPI Action Plan data
    async saveKPIActionPlan() {
        try {
            const today = new Date();
            const yearMonth = today.toISOString().slice(0, 7); // YYYY-MM

            const data = {
                years_month: yearMonth,
                department: 'all',
                new_work_received: 0, // Calculated automatically in backend or UI, not saved directly from here usually unless we want to override
                new_work_completed: parseInt(document.getElementById('kpi-new-completed')?.value || 0),
                completed_within_30: parseInt(document.getElementById('kpi-within-30')?.value || 0),
                completed_within_60: parseInt(document.getElementById('kpi-within-60')?.value || 0),
                completed_over_60: parseInt(document.getElementById('kpi-over-60')?.value || 0),
                notes: document.getElementById('kpi-notes')?.value || '',
                created_by: this.currentUser?.name || 'ผู้ดูแลระบบ'
            };

            const response = await fetch('api/kpi_report.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
                    text: 'บันทึกข้อมูล KPI เรียบร้อยแล้ว',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error saving KPI data:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถบันทึกข้อมูลได้'
            });
        }
    },

    // ==================== SAME-DAY COMPLETION ====================

    // Show modal for recording same-day completions (งานเกิดเสร็จวันเดียว)
    async showSameDayCompletionModal(workType) {
        const deptNames = {
            survey: 'ฝ่ายรังวัด',
            registration: 'ฝ่ายทะเบียน',
            academic: 'กลุ่มงานวิชาการ'
        };
        const deptName = deptNames[workType] || workType;

        const today = new Date();
        const yearMonth = today.toISOString().slice(0, 7);
        const monthName = today.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

        const canManage = this.canManageSameDayLogs(workType);

        const result = await Swal.fire({
            title: `<i class="fas fa-check-double text-emerald-500 mr-2"></i>งานเกิดเสร็จวันเดียว`,
            html: `
                <div class="text-left">
                    <p class="text-sm text-gray-600 mb-4">
                        บันทึกจำนวนงานที่เกิดและเสร็จในวันเดียว (ไม่นับเป็นงานค้าง)<br>
                        <strong>${deptName}</strong>
                    </p>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">จำนวนงาน (เรื่อง)</label>
                        <input type="number" id="sameday-count" min="0" value="0"
                            class="w-full px-4 py-3 text-xl text-center font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-calendar-alt mr-1 text-gray-400"></i>วันที่บันทึก 
                            <span class="text-xs text-gray-400">(ไม่บังคับ - ถ้าย้อนหลัง)</span>
                        </label>
                        <input type="date" id="sameday-date" value="${today.toISOString().split('T')[0]}"
                            class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    </div>
                    <div class="bg-emerald-50 p-3 rounded-lg text-sm text-emerald-700">
                        <i class="fas fa-info-circle mr-1"></i>
                        งานเหล่านี้จะนับเป็น "งานเสร็จ" ในรายงาน KPI แต่ไม่สร้างรายการใหม่ในฐานข้อมูล
                    </div>
                    ${canManage ? `
                    <div class="mt-4">
                        <button type="button" onclick="app.openSameDayLogsManager('${workType}')"
                            class="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition flex items-center justify-center">
                            <i class="fas fa-pen-to-square mr-2 text-gray-500"></i> แก้ไข/ลบรายการของฝ่าย
                        </button>
                        <p class="text-xs text-gray-400 mt-2 text-center">
                            แก้ไขได้เฉพาะรายการของฝ่ายตนเอง
                        </p>
                    </div>
                    ` : ``}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-save mr-2"></i>บันทึก',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#10B981',
            focusConfirm: false,
            preConfirm: () => {
                const count = parseInt(document.getElementById('sameday-count').value || 0);
                const dateInput = document.getElementById('sameday-date').value;
                const recordDate = dateInput || today.toISOString().split('T')[0];

                if (count <= 0) {
                    Swal.showValidationMessage('จำนวนต้องมากกว่า 0');
                    return false;
                }
                return { count, workType, recordDate };
            }
        });

        if (result.isConfirmed) {
            await this.saveSameDayCompletion(result.value);
        }
    },

    canManageSameDayLogs(workType) {
        const dept = this.currentUser?.department || null;
        const role = this.currentUser?.role || null;
        if (!dept) return false;
        if (role === 'superadmin' || dept === 'all') return true;
        return dept === workType;
    },

    async openSameDayLogsManager(workType, forcedYearMonth = null) {
        try {
            // Resolve department: staff can only manage their own dept
            const userDept = this.currentUser?.department || null;
            const dept = (userDept && userDept !== 'all') ? userDept : workType;

            if (!this.canManageSameDayLogs(dept)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่มีสิทธิ์เข้าถึง',
                    text: 'คุณสามารถจัดการได้เฉพาะรายการของฝ่ายตนเอง',
                    confirmButtonColor: '#F97316'
                });
                return;
            }

            const dateEl = document.getElementById('sameday-date');
            const dateVal = dateEl?.value || new Date().toISOString().slice(0, 10);
            const yearMonth = forcedYearMonth || dateVal.slice(0, 7);

            Swal.fire({
                title: '<i class="fas fa-list-check text-emerald-600 mr-2"></i>จัดการรายการงานเกิดเสร็จวันเดียว',
                html: `<div class="text-sm text-gray-500">กำลังโหลดข้อมูล...</div>`,
                width: 820,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: 'ปิด'
            });

            const data = await this.fetchSameDayLogs(dept, yearMonth);
            const logs = data?.logs || [];
            this._sameDayLogsCache = (this._sameDayLogsCache || {});
            logs.forEach(l => { this._sameDayLogsCache[l.id] = l; });

            const deptNames = {
                survey: 'ฝ่ายรังวัด',
                registration: 'ฝ่ายทะเบียน',
                academic: 'กลุ่มงานวิชาการ'
            };

            const rows = logs.length > 0
                ? logs.map((l, idx) => `
                    <tr class="border-b border-gray-100 hover:bg-gray-50">
                        <td class="px-3 py-2 text-sm text-gray-500 text-center">${idx + 1}</td>
                        <td class="px-3 py-2 text-sm text-gray-700">${l.record_date || '-'}</td>
                        <td class="px-3 py-2 text-sm text-gray-900 font-bold text-center">${l.count || 0}</td>
                        <td class="px-3 py-2 text-sm text-gray-600">${l.notes ? String(l.notes).replace(/</g, '&lt;') : '-'}</td>
                        <td class="px-3 py-2 text-sm text-right whitespace-nowrap">
                            <button class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition"
                                onclick="app.openEditSameDayLog(${l.id}, '${dept}', '${yearMonth}')">
                                <i class="fas fa-pen mr-1"></i>แก้ไข
                            </button>
                            <button class="ml-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-bold hover:bg-red-100 transition"
                                onclick="app.confirmDeleteSameDayLog(${l.id}, '${dept}', '${yearMonth}')">
                                <i class="fas fa-trash mr-1"></i>ลบ
                            </button>
                        </td>
                    </tr>
                `).join('')
                : `
                    <tr>
                        <td colspan="5" class="px-3 py-10 text-center text-gray-500">
                            ไม่พบรายการในเดือนนี้
                        </td>
                    </tr>
                `;

            Swal.fire({
                title: '<i class="fas fa-list-check text-emerald-600 mr-2"></i>จัดการรายการงานเกิดเสร็จวันเดียว',
                width: 820,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: 'ปิด',
                html: `
                    <div class="text-left">
                        <div class="mb-3 flex items-center justify-between gap-3">
                            <div class="text-sm text-gray-600">
                                <span class="font-bold">${deptNames[dept] || dept}</span>
                                <span class="text-gray-400">•</span>
                                <span class="font-medium">${yearMonth}</span>
                            </div>
                            <button class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-bold hover:bg-gray-50 transition"
                                onclick="app.openSameDayLogsManager('${dept}', '${yearMonth}')">
                                <i class="fas fa-rotate-right mr-2 text-gray-400"></i>รีเฟรช
                            </button>
                        </div>
                        <div class="overflow-x-auto border border-gray-200 rounded-xl">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase w-12 text-center">#</th>
                                        <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase w-36">วันที่</th>
                                        <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase w-24 text-center">จำนวน</th>
                                        <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase">หมายเหตุ</th>
                                        <th class="px-3 py-2 text-xs font-bold text-gray-600 uppercase w-56 text-right">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        <div class="mt-3 text-xs text-gray-400">
                            หมายเหตุ: การแก้ไข/ลบ จะปรับยอดในรายงาน KPI ของเดือนนั้นอัตโนมัติ
                        </div>
                    </div>
                `
            });
        } catch (error) {
            console.error('openSameDayLogsManager error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถโหลดรายการได้'
            });
        }
    },

    async fetchSameDayLogs(department, yearMonth) {
        const params = new URLSearchParams();
        if (department) params.set('department', department);
        if (yearMonth) params.set('year_month', yearMonth);

        const res = await fetch(`api/sameday_logs.php?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
            throw new Error(data.error || 'Failed to load logs');
        }
        return data;
    },

    async openEditSameDayLog(id, dept, yearMonth) {
        const log = this._sameDayLogsCache?.[id];
        if (!log) {
            Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: 'ไม่พบรายการที่ต้องการแก้ไข' });
            return;
        }

        const result = await Swal.fire({
            title: '<i class="fas fa-pen text-blue-600 mr-2"></i>แก้ไขรายการ',
            html: `
                <div class="text-left space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">วันที่บันทึก</label>
                        <input type="date" id="edit-sd-date" class="w-full px-3 py-2 border rounded-xl"
                            value="${log.record_date || ''}">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">จำนวนงาน (เรื่อง)</label>
                        <input type="number" id="edit-sd-count" min="1" class="w-full px-3 py-2 border rounded-xl text-center font-bold"
                            value="${log.count || 1}">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">หมายเหตุ (ถ้ามี)</label>
                        <textarea id="edit-sd-notes" rows="2" class="w-full px-3 py-2 border rounded-xl"
                            placeholder="ระบุหมายเหตุ...">${log.notes || ''}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#2563EB',
            preConfirm: () => {
                const record_date = document.getElementById('edit-sd-date').value;
                const count = parseInt(document.getElementById('edit-sd-count').value || 0, 10);
                const notes = document.getElementById('edit-sd-notes').value || null;
                if (!record_date) {
                    Swal.showValidationMessage('กรุณาระบุวันที่');
                    return false;
                }
                if (!count || count <= 0) {
                    Swal.showValidationMessage('จำนวนต้องมากกว่า 0');
                    return false;
                }
                return { record_date, count, notes };
            }
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch('api/sameday_logs.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    record_date: result.value.record_date,
                    department: dept,
                    count: result.value.count,
                    notes: result.value.notes,
                    created_by: this.currentUser?.name || 'ผู้ใช้งาน'
                })
            });

            const data = await res.json();
            if (!res.ok || data.status !== 'success') {
                throw new Error(data.error || 'Update failed');
            }

            Swal.fire({
                icon: 'success',
                title: 'บันทึกการแก้ไขแล้ว',
                timer: 1200,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            // Refresh manager view
            this.openSameDayLogsManager(dept, yearMonth);
        } catch (e) {
            console.error('openEditSameDayLog error:', e);
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: e.message || 'ไม่สามารถแก้ไขได้' });
        }
    },

    async confirmDeleteSameDayLog(id, dept, yearMonth) {
        const log = this._sameDayLogsCache?.[id];
        const dateText = log?.record_date || '-';
        const countText = log?.count || 0;

        const result = await Swal.fire({
            icon: 'warning',
            title: 'ยืนยันการลบ?',
            html: `<div class="text-sm text-gray-600">ต้องการลบรายการวันที่ <b>${dateText}</b> จำนวน <b>${countText}</b> เรื่อง ใช่หรือไม่</div>`,
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#EF4444'
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch('api/sameday_logs.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (!res.ok || data.status !== 'success') {
                throw new Error(data.error || 'Delete failed');
            }

            Swal.fire({
                icon: 'success',
                title: 'ลบรายการแล้ว',
                timer: 1200,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            // Refresh manager view
            this.openSameDayLogsManager(dept, yearMonth);
        } catch (e) {
            console.error('confirmDeleteSameDayLog error:', e);
            Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: e.message || 'ไม่สามารถลบได้' });
        }
    },

    // Save same-day completion count - บันทึกเป็นแต่ละรายการ
    async saveSameDayCompletion(data) {
        try {
            // บันทึกเป็น log แยกแต่ละรายการ (ไม่ใช่อัปเดตรวม)
            const response = await fetch('api/sameday_logs.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    record_date: data.recordDate, // วันที่บันทึกจริง
                    department: data.workType,
                    count: data.count,
                    notes: data.notes || null,
                    created_by: this.currentUser?.name || 'ผู้ดูแลระบบ'
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
                    text: `บันทึกงานเกิดเสร็จวันเดียว ${data.count} เรื่อง`,
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error saving same-day completion:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถบันทึกข้อมูลได้'
            });
        }
    },

    /**
     * Export Department Data to Excel
     * @param {string} type 'survey', 'registration', 'academic'
     */
    async exportDepartmentToExcel(type) {
        const typeLabels = {
            'survey': 'งานฝ่ายรังวัด',
            'registration': 'งานฝ่ายทะเบียน',
            'academic': 'งานกลุ่มงานวิชาการ'
        };

        Swal.fire({
            title: 'กำลังสร้างไฟล์ Excel...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            let items = [];
            let headers = [];
            let fileName = `Export_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;

            if (type === 'survey') {
                items = await DataManager.getSurveyItems();
                // Apply current filters if any
                if (this.surveyStatusView === 'pending') items = items.filter(i => DataManager.isPending(i));
                else if (this.surveyStatusView === 'completed') items = items.filter(i => DataManager.isCompleted(i));

                if (this.currentSurveyFilter && this.currentSurveyFilter !== 'all') {
                    items = items.filter(i => i.survey_type === this.currentSurveyFilter);
                }
                if (this.surveyProgressFilter && this.surveyProgressFilter !== 'all') {
                    const pType = parseInt(this.surveyProgressFilter, 10);
                    items = items.filter(item => parseInt(item.progress_type, 10) === pType);
                }
                if (this.surveySearchTerm) {
                    const lowerTerm = this.surveySearchTerm.toLowerCase();
                    items = items.filter(i =>
                        (i.applicant && i.applicant.toLowerCase().includes(lowerTerm)) ||
                        (i.plot_no && i.plot_no.toLowerCase().includes(lowerTerm)) ||
                        (i.received_seq && i.received_seq.toLowerCase().includes(lowerTerm))
                    );
                }

                headers = ['วันที่รับ', 'เลข รว.12', 'ประเภท', 'ผู้ขอ', 'สรุป', 'คนคุม', 'สถานะ'];
                items = items.map(i => [
                    i.received_date,
                    i.rv_12 || '-',
                    i.survey_type || '-',
                    i.applicant || '-',
                    i.summary || '-',
                    i.men || '-',
                    i.status_cause || (DataManager.isCompleted(i) ? 'เสร็จสิ้น' : 'คงค้าง')
                ]);
            } else if (type === 'registration') {
                items = await DataManager.getRegistrationItems();
                // We don't have all filters for reg yet, but let's apply basic search
                if (this.regSearchTerm) {
                    const lowerTerm = this.regSearchTerm.toLowerCase();
                    items = items.filter(i =>
                        (i.subject && i.subject.toLowerCase().includes(lowerTerm)) ||
                        (i.related_person && i.related_person.toLowerCase().includes(lowerTerm)) ||
                        (i.responsible_person && i.responsible_person.toLowerCase().includes(lowerTerm))
                    );
                }

                headers = ['วันที่รับ', 'เลขลำดับ', 'เรื่อง', 'ผู้เกี่ยวข้อง', 'สรุป', 'สถานะ/สาเหตุ', 'ผู้รับผิดชอบ'];
                items = items.map(i => [
                    i.received_date,
                    i.seq_no || '-',
                    i.subject || '-',
                    i.related_person || '-',
                    i.summary || '-',
                    i.status_cause || (DataManager.isCompleted(i) ? 'เสร็จสิ้น' : 'คงค้าง'),
                    i.responsible_person || '-'
                ]);
            } else if (type === 'academic') {
                items = await DataManager.getAcademicItems();
                // Apply basic search
                if (this.acadSearchTerm) {
                    const lowerTerm = this.acadSearchTerm.toLowerCase();
                    items = items.filter(i =>
                        (i.subject && i.subject.toLowerCase().includes(lowerTerm)) ||
                        (i.applicant_name && i.applicant_name.toLowerCase().includes(lowerTerm))
                    );
                }

                headers = ['วันที่รับ', 'เลขลำดับ', 'เรื่อง', 'เลขบ้าน/ที่ดิน', 'สถานะ/สาเหตุ', 'ผู้รับผิดชอบ'];
                items = items.map(i => [
                    i.received_date,
                    i.seq_no || '-',
                    i.subject || '-',
                    i.house_land_no || '-',
                    i.status_cause || (DataManager.isCompleted(i) ? 'เสร็จสิ้น' : 'คงค้าง'),
                    i.responsible_person || '-'
                ]);
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers, ...items]);
            XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
            XLSX.writeFile(wb, fileName);

            Swal.fire({
                icon: 'success',
                title: 'ส่งออกสำเร็จ',
                text: `บันทึกไฟล์ ${fileName} เรียบร้อยแล้ว`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Export error:', error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถส่งออกข้อมูลได้', 'error');
        }
    },

    /**
     * Initialize Performance Graph on Dashboard
     */
    async initPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas || typeof Chart === 'undefined') return;

        try {
            const response = await fetch('api/trend_stats.php');
            const trendData = await response.json();

            const labels = trendData.map(d => d.month);
            const pendingData = trendData.map(d => d.pending);
            const completedData = trendData.map(d => d.completed);

            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'งานที่เสร็จในเดือนนั้น',
                            data: completedData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            pointBackgroundColor: '#10b981',
                            pointRadius: 4
                        },
                        {
                            label: 'งานคงค้างสะสม',
                            data: pendingData,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.05)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointBackgroundColor: '#f59e0b',
                            pointRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                font: { family: 'Prompt', weight: 'bold' }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });
        } catch (error) {
            console.error('Chart init error:', error);
        }
    }
};

// Start app
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
