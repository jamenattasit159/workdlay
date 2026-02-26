/**
 * Admin Settings Manager
 */
const AdminSettings = {
    async init() {
        console.log('Admin Settings Page Initialized');

        // 1. Load Current Settings
        await this.loadSettings();

        // 2. Event Listeners
        document.getElementById('btn-save-lockdown').addEventListener('click', () => this.saveLockdown());
        document.getElementById('btn-save-progress-assign').addEventListener('click', () => this.saveProgressAssign());
    },

    async loadSettings() {
        Swal.fire({
            title: 'กำลังโหลด...',
            didOpen: () => Swal.showLoading()
        });

        const settings = await DataManager.getSystemSettings();
        Swal.close();

        if (settings) {
            this.renderSettings(settings);
        } else {
            Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลการตั้งค่าได้', 'error');
        }
    },

    renderSettings(settings) {
        // Lockdown
        const status = settings.lockdown_status || 'auto';
        const radio = document.querySelector(`input[name="lockdown-mode"][value="${status}"]`);
        if (radio) radio.checked = true;
        this.updateBadge(status);

        // Progress Type Assignment
        const assignMode = settings.progress_type_assign || 'restricted';
        const assignRadio = document.querySelector(`input[name="progress-assign-mode"][value="${assignMode}"]`);
        if (assignRadio) assignRadio.checked = true;
        this.updateProgressAssignBadge(assignMode);
    },

    updateBadge(status) {
        const badge = document.getElementById('current-status');
        const labels = {
            'auto': { text: 'อัตโนมัติ (AUTO)', class: 'bg-slate-100 text-slate-600' },
            'unlocked': { text: 'ปลดล็อค (UNLOCKED)', class: 'bg-emerald-100 text-emerald-600' },
            'locked': { text: 'ล็อค (LOCKED)', class: 'bg-rose-100 text-rose-600' }
        };

        const config = labels[status] || labels.auto;
        badge.textContent = config.text;
        badge.className = `px-3 py-1 rounded-full text-xs font-bold ${config.class} uppercase tracking-wider`;
    },

    updateProgressAssignBadge(mode) {
        const labels = {
            'allowed': { text: 'อนุญาต (ALLOWED)', class: 'bg-purple-100 text-purple-600' },
            'restricted': { text: 'จำกัดสิทธิ์ (RESTRICTED)', class: 'bg-rose-100 text-rose-600' }
        };
        const config = labels[mode] || labels.restricted;
        ['progress-assign-badge', 'progress-assign-badge-bottom'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = config.text;
                el.className = `px-3 py-1 rounded-full text-xs font-bold ${config.class} uppercase tracking-wider`;
            }
        });
    },

    async saveLockdown() {
        const selected = document.querySelector('input[name="lockdown-mode"]:checked').value;

        Swal.fire({
            title: 'ยืนยันการเปลี่ยนค่า?',
            text: `ต้องการเปลี่ยนระบบ Lockdown เป็น: ${selected.toUpperCase()}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const success = await DataManager.updateSystemSetting('lockdown_status', selected);
                if (success) {
                    this.updateBadge(selected);
                    Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าเรียบร้อยแล้ว', 'success');
                } else {
                    Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
                }
            }
        });
    },

    async saveProgressAssign() {
        const selected = document.querySelector('input[name="progress-assign-mode"]:checked').value;
        const labelText = selected === 'allowed' ? 'อนุญาต (ALLOWED)' : 'จำกัดสิทธิ์ (RESTRICTED)';

        Swal.fire({
            title: 'ยืนยันการเปลี่ยนค่า?',
            text: `ต้องการเปลี่ยนการกำหนดหมวดหมู่งานเป็น: ${labelText}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const success = await DataManager.updateSystemSetting('progress_type_assign', selected);
                if (success) {
                    this.updateProgressAssignBadge(selected);
                    Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าเรียบร้อยแล้ว', 'success');
                } else {
                    Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => AdminSettings.init());
