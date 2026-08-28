let currentUser = null;
let currentClubId = null;
let currentClub = null;
let currentTab = 'all';
let rawStudentsData = [];
let dictionaries = { school: [], sex: [], group: [] };
let editingStudentId = null;
let studentToDeleteId = null;
let studentToArchiveId = null;
const ROW_COLORS = ['none', 'red', 'blue', 'yellow', 'green', 'purple'];

let docGroupNames = {
    'Підготовча': localStorage.getItem('doc_prep') || 'Підготовчий, 1 рік',
    'Молодша': localStorage.getItem('doc_junior') || 'Основний, 2 рік',
    'Середня': localStorage.getItem('doc_middle') || 'Основний, 3 рік',
    'Старша': localStorage.getItem('doc_senior') || 'Вищий, 3 рік'
};

const SCHOOL_COLUMNS_CONFIG = [
    { title: 'Школа № 1', match: ['школа № 1', 'школа №1', 'школа 1'] },
    { title: 'Школа № 2', match: ['школа № 2', 'школа №2', 'школа 2'] },
    { title: 'Школа № 3', match: ['школа № 3', 'школа №3', 'школа 3'] },
    { title: 'Школа № 4', match: ['школа № 4', 'школа №4', 'школа 4'] },
    { title: 'Школа № 5', match: ['школа № 5', 'школа №5', 'школа 5'] },
    { title: 'Школа № 6', match: ['школа № 6', 'школа №6', 'школа 6'] },
    { title: 'Школа № 7', match: ['школа № 7', 'школа №7', 'школа 7'] },
    { title: 'Школа № 8', match: ['школа № 8', 'школа №8', 'школа 8'] },
    { title: 'Школа № 9', match: ['школа № 9', 'школа №9', 'школа 9'] },
    { title: 'Міський ліцей', match: ['міський ліцей', 'ПМЛ'] },
    { title: 'Школа № 11', match: ['школа № 11', 'школа №11', 'школа 11'] },
    { title: 'Школа № 12', match: ['школа № 12', 'школа №12', 'школа 12'] },
    { title: 'Школа № 14', match: ['школа № 14', 'школа №14', 'школа 14'] },
    { title: 'Школа № 15', match: ['школа № 15', 'школа №15', 'школа 15'] },
    { title: 'Школа № 17', match: ['школа № 17', 'школа №17', 'школа 17'] },
    { title: 'Школа № 18', match: ['школа № 18', 'школа №18', 'школа 18'] },
    { title: 'Школа № 19', match: ['школа № 19', 'школа №19', 'школа 19'] },
    { title: 'Школа № 20', match: ['школа № 20', 'школа №20', 'школа 20'] },
    { title: 'Д/с', match: ['д/с', 'д/садок', 'садок', 'дошкільний'] },
    { title: 'Інший заклад освіти', match: ['інший заклад освіти', 'інше', 'інший'] },
    { title: 'Не відвідує закладів', match: ['не відвідує закладів', 'не відвідує', '—', ''] }
];

function getSchoolCount(activeStudents, schoolConfig) {
    if (schoolConfig.title === 'Не відвідує закладів') {
        return activeStudents.filter(s => s.school_id === 1 || !s.school || !s.school.title).length;
    }
    return activeStudents.filter(s => {
        const schoolTitle = (s.school?.title || '').trim().toLowerCase();
        return schoolConfig.match.some(m => schoolTitle === m || schoolTitle.includes(m));
    }).length;
}

function sortByAge(studentsList) {
    return [...studentsList].sort((a, b) => {
        const dateA = a.bithday ? new Date(a.bithday).getTime() : 0;
        const dateB = b.bithday ? new Date(b.bithday).getTime() : 0;
        return dateB - dateA; // Сортування від наймолодших до найстарших
    });
}

function loadDocNamesIntoInputs() {
    document.getElementById('doc-name-prep').value = docGroupNames['Підготовча'];
    document.getElementById('doc-name-junior').value = docGroupNames['Молодша'];
    document.getElementById('doc-name-middle').value = docGroupNames['Середня'];
    document.getElementById('doc-name-senior').value = docGroupNames['Старша'];
}

function saveDocNames() {
    docGroupNames['Підготовча'] = document.getElementById('doc-name-prep').value.trim();
    docGroupNames['Молодша'] = document.getElementById('doc-name-junior').value.trim();
    docGroupNames['Середня'] = document.getElementById('doc-name-middle').value.trim();
    docGroupNames['Старша'] = document.getElementById('doc-name-senior').value.trim();

    localStorage.setItem('doc_prep', docGroupNames['Підготовча']);
    localStorage.setItem('doc_junior', docGroupNames['Молодша']);
    localStorage.setItem('doc_middle', docGroupNames['Середня']);
    localStorage.setItem('doc_senior', docGroupNames['Старша']);

    renderTable();
}

function updateDocNameInline(groupTitle, newName) {
    docGroupNames[groupTitle] = newName.trim();
    if (groupTitle === 'Підготовча') localStorage.setItem('doc_prep', newName.trim());
    if (groupTitle === 'Молодша') localStorage.setItem('doc_junior', newName.trim());
    if (groupTitle === 'Середня') localStorage.setItem('doc_middle', newName.trim());
    if (groupTitle === 'Старша') localStorage.setItem('doc_senior', newName.trim());
    loadDocNamesIntoInputs();
}

function setRowColorInForm(color) {
    const c = (color && ROW_COLORS.includes(color)) ? color : 'none';
    document.getElementById('sf-row_color').value = c;
    document.querySelectorAll('#sf-row-color-picker .color-dot').forEach(dot => {
        if (dot.dataset.color === c) dot.style.outline = '2px solid #333';
        else dot.style.outline = '';
    });
}

async function saveStudentRowColor(studentId, color) {
    const c = (color && ROW_COLORS.includes(color)) ? color : 'none';
    try {
        await supabaseClient.from('students').update({ row_color: c }).eq('id', studentId);
        const s = rawStudentsData.find(x => x.id === studentId);
        if (s) s.row_color = c;
        const tr = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (tr) {
            ROW_COLORS.forEach(k => { if (k !== 'none') tr.classList.remove('row-' + k); });
            if (c !== 'none') tr.classList.add('row-' + c);
        }
    } catch (e) {
        console.warn('Помилка зміни кольору:', e);
    }
}

function calculateAge(birthdayStr) {
    if (!birthdayStr) return null;
    const birth = new Date(birthdayStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso || '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
}

function orDash(val) {
    return (val && String(val).trim() !== '') ? val : '—';
}

async function loadDictionaries() {
    const [s, sx, g] = await Promise.all([
        supabaseClient.from('school').select('*').order('title'),
        supabaseClient.from('sex').select('*').order('id'),
        supabaseClient.from('group').select('*').order('id')
    ]);
    dictionaries.school = s.data || [];
    dictionaries.sex = sx.data || [];
    dictionaries.group = g.data || [];
}

function populateStudentFormSelects() {
    const fill = (id, list) => {
        const el = document.getElementById(id);
        el.innerHTML = '<option value="">-- оберіть --</option>' +
            list.map(i => `<option value="${i.id}">${i.title}</option>`).join('');
    };
    fill('sf-school_id', dictionaries.school);
    fill('sf-sex_id', dictionaries.sex);
    fill('sf-group_id', dictionaries.group);
}

async function loadUserClubs() {
    const { data: userLinks } = await supabaseClient.from('user_club').select('club_id').eq('user_id', currentUser.id);
    if (!userLinks || userLinks.length === 0) return [];
    const clubIds = userLinks.map(l => l.club_id);
    const { data: clubs } = await supabaseClient.from('club').select('*').in('id', clubIds);
    return clubs || [];
}

function renderClubSelect(clubs) {
    const clubSelect = document.getElementById('club-select');
    document.getElementById('add-student-btn').style.display = clubs.length ? '' : 'none';

    if (clubs.length > 0) {
        clubSelect.innerHTML = clubs.map(c =>
            `<option value="${c.id}" ${c.id === currentClubId ? 'selected' : ''}>${c.title}</option>`
        ).join('');
        if (!currentClubId) currentClubId = clubs[0].id;
        currentClub = clubs.find(c => c.id === currentClubId) || clubs[0];
        currentClubId = currentClub.id;
        document.getElementById('current-club-title').innerText = currentClub.title;
        document.getElementById('edit-club-title').value = currentClub.title;
        fetchStudents();
    } else {
        clubSelect.innerHTML = '';
        currentClubId = null;
        document.getElementById('current-club-title').innerText = "Немає підключених клубів";
        rawStudentsData = [];
        renderTable();
    }
}

function changeClub(val) {
    currentClubId = parseInt(val);
    const clubs = Array.from(document.getElementById('club-select').options);
    const sel = clubs.find(o => parseInt(o.value) === currentClubId);
    if (sel) {
        document.getElementById('current-club-title').innerText = sel.text;
        document.getElementById('edit-club-title').value = sel.text;
    }
    fetchStudents();
}

async function updateClubTitle() {
    const newTitle = document.getElementById('edit-club-title').value.trim();
    if (!newTitle || !currentClubId) return;

    try {
        const { error } = await supabaseClient.from('club').update({ title: newTitle }).eq('id', currentClubId);
        if (error) throw error;
        document.getElementById('current-club-title').innerText = newTitle;
        const clubs = await loadUserClubs();
        renderClubSelect(clubs);
    } catch (err) {
        alert('Помилка оновлення назви: ' + err.message);
    }
}

async function fetchStudents() {
    if (!currentClubId) { rawStudentsData = []; renderTable(); return; }
    const { data: clubLinks } = await supabaseClient.from('students_club').select('student_id').eq('club_id', currentClubId);
    if (!clubLinks || clubLinks.length === 0) { rawStudentsData = []; renderTable(); return; }

    const studentIds = clubLinks.map(l => l.student_id);
    const { data: students, error } = await supabaseClient.from('students')
        .select('*, school(title), sex(title), group(title)')
        .in('id', studentIds);

    if (error) { console.error("Помилка завантаження:", error); return; }
    rawStudentsData = students || [];
    renderTable();
}

function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTable();
}

function renderTable() {
    const container = document.getElementById('dynamic-content');
    const heading = document.getElementById('tab-heading');
    let filtered = rawStudentsData;

    if (currentTab === 'archive') {
        filtered = filtered.filter(s => s.arhive === true);
        heading.innerText = "Архівний список";
    } else if (currentTab === 'stats') {
        heading.innerText = "Статистичні дані";
    } else {
        filtered = filtered.filter(s => s.arhive !== true);
        if (currentTab === 'prep') filtered = filtered.filter(s => s.group?.title === 'Підготовча');
        else if (currentTab === 'junior') filtered = filtered.filter(s => s.group?.title === 'Молодша');
        else if (currentTab === 'middle') filtered = filtered.filter(s => s.group?.title === 'Середня');
        else if (currentTab === 'senior') filtered = filtered.filter(s => s.group?.title === 'Старша');
        else if (currentTab === 'social') filtered = filtered.filter(s => s.socially_vulnerable === true);
        else if (currentTab === 'oop') filtered = filtered.filter(s => s.oop === true);
        heading.innerText = "Список учнів";
    }

    if (currentTab === 'stats') {
        renderFullStatsView(container, rawStudentsData.filter(s => s.arhive !== true));
        filterTable();
        return;
    }

    const isGroupTab = ['prep', 'junior', 'middle', 'senior'].includes(currentTab);
    filtered = sortByAge(filtered);

    let currentGroupTitle = '';
    if (currentTab === 'prep') currentGroupTitle = 'Підготовча';
    if (currentTab === 'junior') currentGroupTitle = 'Молодша';
    if (currentTab === 'middle') currentGroupTitle = 'Середня';
    if (currentTab === 'senior') currentGroupTitle = 'Старша';

    let tableHtml = `
        <table class="data-table" id="main-students-table">
            <thead>
                <tr>
                    <th>№</th><th>ПІБ</th><th>Новоприбулі</th><th>Вік</th>
                    <th>Навчальний заклад</th><th>Стать</th>
                    ${!isGroupTab ? '<th>Група</th>' : ''}
                    <th>Мати</th><th>Батько</th><th>Домашня адреса</th>
                    <th>Категорія</th><th>Дії</th>
                </tr>
            </thead>
            <tbody id="table-body">`;

    tableHtml += filtered.map((s, idx) => {
        const motherLine = [s.mother, s.mother_telephone].filter(x => x && x.trim()).join(' ');
        const fatherLine = [s.father, s.father_telephone].filter(x => x && x.trim()).join(' ');
        const rowColor = (s.row_color && ROW_COLORS.includes(s.row_color) && s.row_color !== 'none') ? 'row-' + s.row_color : '';
        const quickColorDots = ROW_COLORS.map(c => `<span class="color-dot ${c}" title="${c}" onclick="saveStudentRowColor(${s.id}, '${c}')"></span>`).join('');
        
        return `
        <tr data-student-id="${s.id}" class="${rowColor}">
            <td>${idx + 1}</td>
            <td><strong>${s.name}</strong></td>
            <td>${s.new ? 'н/п' : ''}</td>
            <td>${calculateAge(s.bithday) || ''}</td>
            <td>${orDash(s.school?.title)}</td>
            <td>${orDash(s.sex?.title)}</td>
            ${!isGroupTab ? `<td>${orDash(s.group?.title)}</td>` : ''}
            <td>${orDash(motherLine)}</td>
            <td>${orDash(fatherLine)}</td>
            <td>${orDash(s.address)}</td>
            <td>${orDash(s.category)}</td>
            <td class="action-btns">
                <div class="color-dots">${quickColorDots}</div>
                <div style="margin-top: 4px;">
                    ${currentTab === 'archive' ? `
                        <button class="btn btn-danger btn-icon-inline" onclick="openDeleteModal(${s.id}, '${s.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button>
                    ` : `
                        <button class="btn btn-primary btn-icon-inline" onclick="openEditStudentModal(${s.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-warning btn-icon-inline" onclick="openArchiveModal(${s.id}, '${s.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-box-archive"></i></button>
                    `}
                </div>
            </td>
        </tr>`;
    }).join('');

    tableHtml += `</tbody></table>`;

    if (isGroupTab) {
        const docName = docGroupNames[currentGroupTitle] || currentGroupTitle;
        tableHtml += `
            <div class="group-summary-footer">
                <div><input type="text" value="${docName}" onchange="updateDocNameInline('${currentGroupTitle}', this.value)" style="padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-weight: bold; width: 190px; text-align: center;" title="Змінити документальну назву"></div>
                <div>${currentGroupTitle}</div>
                <div>${filtered.length} дітей</div>
            </div>`;
    }

    container.innerHTML = tableHtml;
    filterTable();
}

function filterTable() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#table-body tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

function exportStudentsToExcel() {
    const active = rawStudentsData.filter(s => s.arhive !== true);
    
    let excelContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"></head>
    <body><table border="1">
    <thead>
        <tr style="background-color: #f2f2f2;">
            <th>№</th><th>ПІБ</th><th>Новоприбулі</th><th>Вік</th><th>Навчальний заклад</th>
            <th>Стать</th><th>Група</th><th>Мати</th><th>Батько</th><th>Адреса</th><th>Категорія</th>
        </tr>
    </thead>
    <tbody>`;

    active.forEach((c, idx) => {
        excelContent += `<tr>
            <td>${idx + 1}</td>
            <td>${c.name || ''}</td>
            <td>${c.new ? 'н/п' : ''}</td>
            <td>${calculateAge(c.bithday) || ''}</td>
            <td>${c.school?.title || ''}</td>
            <td>${c.sex?.title || ''}</td>
            <td>${c.group?.title || ''}</td>
            <td>${[c.mother, c.mother_telephone].filter(x => x && x !== '—').join(' ')}</td>
            <td>${[c.father, c.father_telephone].filter(x => x && x !== '—').join(' ')}</td>
            <td>${c.address || ''}</td>
            <td>${c.category || ''}</td>
        </tr>`;
    });

    excelContent += `</tbody></table></body></html>`;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${(currentClub?.title || 'Звіт').replace(/[\\/:*?"<>|]/g, '_')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Решта стандартних функцій ініціалізації
function toggleDrawer(open) {
    document.getElementById('right-drawer').classList.toggle('open', open);
    document.getElementById('drawer-overlay').classList.toggle('active', open);
}

async function initPage() {
    currentUser = await checkAuthAndRedirect();
    if (!currentUser) return;

    loadDocNamesIntoInputs();
    await loadDictionaries();
    const clubs = await loadUserClubs();
    renderClubSelect(clubs);

    document.querySelectorAll('#sf-row-color-picker .color-dot').forEach(dot => {
        dot.addEventListener('click', () => setRowColorInForm(dot.dataset.color));
    });
}
function printDocument() {
    const printContents = document.getElementById('printable-area').innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    
    // Переініціалізація обробників подій після відновлення DOM
    initPage();
}



initPage();