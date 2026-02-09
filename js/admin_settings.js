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
        const status = settings.lockdown_status || 'auto';

        // Set Radio Button
        const radio = document.querySelector(`input[name="lockdown-mode"][value="${status}"]`);
        if (radio) radio.checked = true;

        // Update Status Badge
        this.updateBadge(status);
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
    }
};

document.addEventListener('DOMContentLoaded', () => AdminSettings.init());
