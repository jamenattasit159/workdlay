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

    init() {
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

        // Define which elements to hide for each department
        const menuMappings = {
            'survey': ['nav-registration_list', 'nav-academic_list', 'nav-report', 'nav-import-registration', 'nav-import-academic'],
            'registration': ['nav-survey_list', 'nav-academic_list', 'nav-report', 'nav-import-survey', 'nav-import-academic'],
            'academic': ['nav-survey_list', 'nav-registration_list', 'nav-report', 'nav-import-survey', 'nav-import-registration']
        };

        // Show all menus first (reset)
        document.querySelectorAll('.nav-item, .nav-import-btn').forEach(el => {
            el.style.display = '';
        });

        // If department-specific user, hide other department menus
        if (userDept !== 'all' && menuMappings[userDept]) {
            menuMappings[userDept].forEach(menuId => {
                const el = document.getElementById(menuId);
                if (el) el.style.display = 'none';
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
            // Staff can only access their department's page and dashboard
            const allowedPages = {
                'survey': ['dashboard', 'survey_list', 'survey_form'],
                'registration': ['dashboard', 'registration_list', 'registration_form'],
                'academic': ['dashboard', 'academic_list', 'academic_form']
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

        // Reset active nav state
        document.querySelectorAll('.nav-item').forEach(el => {
            el.className = 'nav-item w-full flex items-center p-3 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-all duration-300 text-left group text-gray-600';
            const iconDiv = el.querySelector('div');
            if (iconDiv) iconDiv.className = 'p-2 bg-gray-100 rounded-lg group-hover:bg-emerald-100 mr-3 transition-colors text-gray-400 group-hover:text-emerald-600';
        });

        const activeNav = document.getElementById(`nav-${page}`);
        if (activeNav) {
            // Check for specific colors based on page type (Survey=Indigo, Registration=Blue?)
            // For now, defaulting to standard active style or specific overrides if I added classes
            if (page === 'survey_list') {
                activeNav.className = 'nav-item w-full flex items-center p-3 rounded-lg bg-indigo-50 text-indigo-700 font-bold shadow-sm transition-all duration-300 text-left group border-l-4 border-indigo-500';
                const iconDiv = activeNav.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-2 bg-indigo-100 rounded-lg mr-3 transition-colors text-indigo-600';
            } else if (page === 'registration_list') {
                activeNav.className = 'nav-item w-full flex items-center p-3 rounded-lg bg-blue-50 text-blue-700 font-bold shadow-sm transition-all duration-300 text-left group border-l-4 border-blue-500';
                const iconDiv = activeNav.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-2 bg-blue-100 rounded-lg mr-3 transition-colors text-blue-600';
            } else if (page === 'academic_list') {
                activeNav.className = 'nav-item w-full flex items-center p-3 rounded-lg bg-orange-50 text-orange-700 font-bold shadow-sm transition-all duration-300 text-left group border-l-4 border-orange-500';
                const iconDiv = activeNav.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-2 bg-orange-100 rounded-lg mr-3 transition-colors text-orange-600';
            } else if (page === 'sync_page') {
                activeNav.className = 'nav-item w-full flex items-center p-3 rounded-lg bg-purple-50 text-purple-700 font-bold shadow-sm transition-all duration-300 text-left group border-l-4 border-purple-500';
                const iconDiv = activeNav.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-2 bg-purple-100 rounded-lg mr-3 transition-colors text-purple-600';
            } else {
                activeNav.className = 'nav-item w-full flex items-center p-3 rounded-lg bg-emerald-50 text-emerald-700 font-bold shadow-sm transition-all duration-300 text-left group border-l-4 border-emerald-500';
                const iconDiv = activeNav.querySelector('div');
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
        } else if (page === 'report') {
            title.innerText = 'รายงานสรุปงาน';
            content.innerHTML = await UI.renderReport();
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

        let items = await DataManager.getAcademicItems();

        // 0. Filter by Status View (Pending/Completed) - Use DataManager helper functions for consistent logic
        if (this.academicStatusView === 'pending') {
            items = items.filter(item => DataManager.isPending(item));
        } else {
            items = items.filter(item => DataManager.isCompleted(item));
        }

        if (this.academicSearchTerm) {
            const lowerTerm = this.academicSearchTerm.toLowerCase();
            items = items.filter(item =>
                (item.subject && item.subject.toLowerCase().includes(lowerTerm)) ||
                (item.related_person && item.related_person.toLowerCase().includes(lowerTerm)) ||
                (item.seq_no && item.seq_no.toLowerCase().includes(lowerTerm))
            );
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

        // Initialize DataTables
        setTimeout(() => {
            if (typeof $ !== 'undefined' && $.fn.DataTable) {
                UI.initDataTable('academic-datatable', {
                    order: [[1, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: [5] }
                    ]
                });
            }
        }, 150);
    },

    async filterAcademicSubject(subject) {
        this.currentAcademicSubject = subject;
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

    async refreshRegistrationList() {
        const content = document.getElementById('app-content');
        const listContainer = document.getElementById('registration-list-container');

        // Data Fetching
        let items = await DataManager.getRegistrationItems();

        // Filter by Status View - Use DataManager helper functions for consistent logic
        if (this.registrationStatusView === 'pending') {
            items = items.filter(item => DataManager.isPending(item));
        } else {
            items = items.filter(item => DataManager.isCompleted(item));
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

        // Initialize DataTables
        setTimeout(() => {
            if (typeof $ !== 'undefined' && $.fn.DataTable) {
                UI.initDataTable('registration-datatable', {
                    order: [[1, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: [7] }
                    ]
                });
            }
        }, 150);
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

    async goToSurveyPage(page) {
        this.currentSurveyPage = page;
        this.refreshSurveyList();
    },

    async refreshSurveyList() {
        const content = document.getElementById('app-content');
        const listContainer = document.getElementById('survey-list-container');

        // Get all items
        let items = await DataManager.getSurveyItems();

        // 0. Filter by Status View - Use DataManager helper functions for consistent logic
        if (this.surveyStatusView === 'pending') {
            items = items.filter(item => DataManager.isPending(item));
        } else {
            items = items.filter(item => DataManager.isCompleted(item));
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

        // Initialize DataTables (after DOM is ready)
        setTimeout(() => {
            if (typeof $ !== 'undefined' && $.fn.DataTable) {
                UI.initDataTable('survey-datatable', {
                    order: [[1, 'desc']],
                    columnDefs: [
                        { orderable: false, targets: [0, 8] }
                    ]
                });
            }
        }, 150);
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
                await DataManager.updateSurveyItem({ id, status_cause: status, completion_date });
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

    setSurveyStatusView(view) {
        this.surveyStatusView = view;
        this.currentSurveyPage = 1;
        // Force full render by clearing content (so the tab buttons get updated)
        document.getElementById('app-content').innerHTML = '';
        this.refreshSurveyList();
    },

    setRegistrationStatusView(view) {
        this.registrationStatusView = view;
        this.currentRegistrationPage = 1;
        // Force full render by clearing content (so the tab buttons get updated)
        document.getElementById('app-content').innerHTML = '';
        this.refreshRegistrationList();
    },

    setAcademicStatusView(view) {
        this.academicStatusView = view;
        this.currentAcademicPage = 1;
        // Force full render by clearing content (so the tab buttons get updated)
        document.getElementById('app-content').innerHTML = '';
        this.refreshAcademicList();
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

    // ==================== EXCEL/CSV IMPORT ====================

    // Show import modal
    showImportModal(workType) {
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

        const color = typeColors[workType] || 'emerald';

        Swal.fire({
            title: `<i class="fas fa-file-upload text-${color}-500 mr-2"></i> นำเข้าข้อมูล${typeLabels[workType]}`,
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

                    <!-- Info -->
                    <div class="text-xs text-gray-400">
                        <p><i class="fas fa-info-circle mr-1"></i> งานที่รับเรื่องเกิน 30 วัน จะถูกตั้งค่าเป็น "งานค้าง" อัตโนมัติ</p>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-upload mr-2"></i> นำเข้าข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: color === 'indigo' ? '#6366F1' : color === 'blue' ? '#3B82F6' : '#F97316',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                const fileInput = document.getElementById('import-file');
                if (!fileInput.files.length) {
                    Swal.showValidationMessage('กรุณาเลือกไฟล์');
                    return false;
                }
                return this.processImport(workType, fileInput.files[0]);
            },
            allowOutsideClick: () => !Swal.isLoading()
        });
    },

    // Process import file
    async processImport(workType, file) {
        const formData = new FormData();
        formData.append('work_type', workType);
        formData.append('file', file);

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
                            <p class="text-2xl font-bold text-emerald-600">${result.inserted} รายการ</p>
                            <p class="text-sm text-gray-500">จากทั้งหมด ${result.total} รายการ</p>
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
    }
};

// Start app
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
