// ============================================================
//  Статистика гуртка — дані, таблиця, друк (PDF) та експорт Excel
// ============================================================

// ===================== Supabase init =====================
let supabaseClient = null;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error('Supabase init error', e);
}

// ===================== State =====================
let children = [];
let groups = [];
let currentClubId = null;
let currentClub = null;

// Назви рівнів навчання для кожної групи
const LEVEL_NAMES = {
    'Підготовча': 'Підготовчий, 1 рік',
    'Молодша': 'Основний, 2 рік',
    'Середня': 'Основний, 3 рік',
    'Старша': 'Вищий, 3 рік'
};

// Категорії соціального захисту (для сторінки/аркуша "Соц. незах.")
const SOCIAL_CATEGORIES = [
    'ВПО',
    'багатодітна сім\'я',
    'багатодітна родина',
    'Дитина позбавлена батьківського піклування',
    'малозабезпечена сім\'я'
];

// Кольори категорій для головної таблиці (як у зразку)
const CATEGORY_COLORS = {
    'Дитина позбавлена батьківського піклування': '#FF9999',
    'ВПО': '#FF9999',
    'ООП': '#FF9999',
    'багатодітна сім\'я': '#FFE599',
    'багатодітна родина': '#FFE599',
    '_default_': '#B8CCE4' // інші категорії (Атопічний дерматит, Облік у ендокринолога тощо)
};

// Список навчальних закладів для статистики
const SCHOOL_LIST = [
    'Школа №1', 'Школа №2', 'Школа №3', 'Школа №4', 'Школа №5', 'Школа №6',
    'Школа №7', 'Школа №8', 'Школа №9', 'Міський ліцей', 'Школа №11', 'Школа №12',
    'Школа №14', 'Школа №15', 'Школа №17', 'Школа №18', 'Школа №19', 'Школа №20',
    'д/с', 'Інший заклад освіти', 'Не відвідує закладів освіти'
];

// ===================== Helpers =====================
function $(id) { return document.getElementById(id); }

function showError(msg) {
    alert(msg);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso || '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
}

function calcAge(birthDate) {
    if (!birthDate) return null;
    const b = new Date(birthDate);
    if (isNaN(b)) return null;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
}

function getGroupName(groupId) {
    const g = groups.find(x => x.id === groupId);
    return g ? g.name : '';
}

function genderUk(c) {
    if (c.gender === 'male') return 'хлопець';
    if (c.gender === 'female') return 'дівчина';
    return '';
}

function isNewLabel(c) {
    return c.is_new ? 'н/п' : '';
}

// Нормалізує назву навчального закладу для статистики
function normalizeSchool(school) {
    const s = (school || '').trim();
    if (!s || s === '-') return 'Не відвідує закладів освіти';
    if (s.toUpperCase() === 'ПМЛ') return 'Міський ліцей';
    if (s.toLowerCase() === 'інше') return 'Інший заклад освіти';
    if (SCHOOL_LIST.includes(s)) return s;
    return 'Інший заклад освіти';
}

function isSocialCategory(category) {
    if (!category) return false;
    const cat = category.toLowerCase();
    return SOCIAL_CATEGORIES.some(sc => cat.includes(sc.toLowerCase()));
}

function categoryColor(category) {
    if (!category) return '';
    const trimmed = category.trim();
    if (CATEGORY_COLORS[trimmed]) return CATEGORY_COLORS[trimmed];
    for (const key of Object.keys(CATEGORY_COLORS)) {
        if (key !== '_default_' && trimmed.toLowerCase().includes(key.toLowerCase())) {
            return CATEGORY_COLORS[key];
        }
    }
    return CATEGORY_COLORS['_default_'];
}

// Сортування за ПІБ (українська абетка)
function sortByName(arr) {
    return [...arr].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'uk'));
}

// Сортування за датою народження (від молодших до старших)
function sortByBirthDesc(arr) {
    return [...arr].sort((a, b) => new Date(b.birth_date) - new Date(a.birth_date));
}

// Сортування за навчальним закладом, потім ПІБ
function sortBySchool(arr) {
    return [...arr].sort((a, b) => {
        const sa = (a.school || '').trim();
        const sb = (b.school || '').trim();
        if (sa === sb) return (a.full_name || '').localeCompare(b.full_name || '', 'uk');
        if (!sa || sa === '-') return -1;
        if (!sb || sb === '-') return 1;
        return sa.localeCompare(sb, 'uk');
    });
}

function formatParents(c) {
    const parts = [];
    if (c.mother) parts.push(c.mother.replace(/\s+/g, ' ').trim());
    if (c.father) parts.push(c.father.replace(/\s+/g, ' ').trim());
    return parts.join('; ');
}

// ===================== Auth =====================
async function checkAuth() {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

async function logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// ===================== Data loading =====================
async function loadChildren() {
    if (!supabaseClient) return;
    let query = supabaseClient.from('children').select('*').order('full_name', { ascending: true });
    if (currentClubId) query = query.eq('club_id', currentClubId);
    const { data, error } = await query;
    if (error) { showError('Помилка завантаження дітей: ' + error.message); return; }
    children = data || [];
}

async function loadGroups() {
    if (!supabaseClient) return;
    let query = supabaseClient.from('groups').select('*').order('id', { ascending: true });
    if (currentClubId) query = query.eq('club_id', currentClubId);
    const { data, error } = await query;
    if (error) { showError('Помилка завантаження груп: ' + error.message); return; }
    groups = data || [];
}

async function loadClubInfo() {
    if (!supabaseClient || !currentClubId) return;
    const { data, error } = await supabaseClient.from('clubs').select('*').eq('id', currentClubId).maybeSingle();
    if (error) { console.error('Помилка завантаження гуртка:', error.message); return; }
    currentClub = data;
}

// ===================== Rendering (екранна таблиця) =====================
function renderChildrenTable() {
    const tbody = $('children-tbody');
    if (!tbody) return;
    const search = ($('search-input')?.value || '').toLowerCase();
    const groupFilter = $('group-filter')?.value || '';
    const categoryFilter = $('category-filter')?.value || '';

    const filtered = children.filter(c => {
        if (search && !(c.full_name || '').toLowerCase().includes(search)) return false;
        if (groupFilter && String(c.group_id) !== groupFilter) return false;
        if (categoryFilter && (c.category || '') !== categoryFilter) return false;
        return true;
    });

    tbody.innerHTML = '';
    filtered.forEach((c, i) => {
        const tr = document.createElement('tr');
        const color = categoryColor(c.category);
        if (color) tr.style.backgroundColor = color;
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${escapeHtml(c.full_name || '')}</td>
            <td>${isNewLabel(c)}</td>
            <td>${c.birth_date ? calcAge(c.birth_date) : ''}</td>
            <td>${escapeHtml(c.school || '')}</td>
            <td>${genderUk(c)}</td>
            <td>${escapeHtml(getGroupName(c.group_id))}</td>
            <td>${formatDate(c.birth_date)}</td>
            <td>${escapeHtml(c.mother || '')}</td>
            <td>${escapeHtml(c.father || '')}</td>
            <td>${escapeHtml(c.address || '')}</td>
            <td>${escapeHtml(c.category || '')}</td>
            <td>
                <button class="btn-edit" data-id="${c.id}">✏️</button>
                <button class="btn-delete" data-id="${c.id}">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderGroupFilter() {
    const select = $('group-filter');
    if (!select) return;
    select.innerHTML = '<option value="">Всі групи</option>';
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        select.appendChild(opt);
    });
}

function renderCategoryFilter() {
    const select = $('category-filter');
    if (!select) return;
    select.innerHTML = '<option value="">Всі категорії</option>';
    const cats = [...new Set(children.map(c => c.category).filter(Boolean))];
    cats.sort((a, b) => a.localeCompare(b, 'uk'));
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

function renderClubInfo() {
    const el = $('club-details');
    if (!el) return;
    if (currentClub) {
        el.innerHTML = `<strong>${escapeHtml(currentClub.name || '')}</strong>` +
            (currentClub.description ? `<br><span>${escapeHtml(currentClub.description)}</span>` : '');
    } else {
        el.innerHTML = '<em>Гурток не вибрано</em>';
    }
}

// ===================== Статистика =====================
function getGroupsWithOrder() {
    // Групи у фіксованому порядку рівнів, потім решта
    const order = ['Підготовча', 'Молодша', 'Середня', 'Старша'];
    return [...groups].sort((a, b) => {
        const ia = order.indexOf(a.name);
        const ib = order.indexOf(b.name);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.id - b.id;
    });
}

function buildStatistics() {
    const year = new Date().getFullYear();

    // Таблиця 1: кількість дітей по групах
    const levelRows = getGroupsWithOrder().map(g => ({
        'Рівень навчання': LEVEL_NAMES[g.name] || g.name,
        'Назва групи': g.name,
        'Кількість дітей в групі': children.filter(c => c.group_id === g.id).length
    }));

    // Таблиця 2: навчальні заклади
    const schoolCounts = {};
    SCHOOL_LIST.forEach(s => schoolCounts[s] = 0);
    children.forEach(c => {
        schoolCounts[normalizeSchool(c.school)]++;
    });

    // Таблиця 3: розподіл за віком та статтю
    const ageHeaders = ['<= 6', '7 років', '8 років', '9 років', '10 років', '11 років',
        '12 років', '13 років', '14 років', '15 років', '16 років', '17 років', '18>='];
    const girls = children.filter(c => c.gender === 'female');
    const boys = children.filter(c => c.gender === 'male');

    function parseAgeHeader(h) {
        if (h === '<= 6') return { min: 0, max: 6 };
        if (h === '18>=') return { min: 18, max: 200 };
        const n = parseInt(h);
        return { min: n, max: n };
    }

    function countByAge(list, range) {
        return list.filter(c => {
            const age = calcAge(c.birth_date);
            return age !== null && age >= range.min && age <= range.max;
        }).length;
    }

    const girlsRow = { '': 'З них дівчат' };
    const boysRow = { '': 'З них хлопців' };
    const totalRow = { '': 'Разом' };
    let girlsTotal = 0, boysTotal = 0;
    ageHeaders.forEach(h => {
        const range = parseAgeHeader(h);
        const g = countByAge(girls, range);
        const b = countByAge(boys, range);
        girlsRow[h] = g;
        boysRow[h] = b;
        totalRow[h] = g + b;
        girlsTotal += g;
        boysTotal += b;
    });
    girlsRow['Всього'] = girlsTotal;
    boysRow['Всього'] = boysTotal;
    totalRow['Всього'] = girlsTotal + boysTotal;

    // Таблиця 4: діти за роками народження та дошкільнята
    const yearCols = [year - 8, year - 7, year - 6, year - 5];
    const yearCounts = yearCols.map(y => ({
        label: `Діти ${y}р.н`,
        count: children.filter(c => c.birth_date && new Date(c.birth_date).getFullYear() === y).length
    }));
    const full6 = children.filter(c => c.birth_date && new Date(c.birth_date).getFullYear() === year - 6).length;
    const full5 = children.filter(c => c.birth_date && new Date(c.birth_date).getFullYear() === year - 5).length;
    const full4 = children.filter(c => c.birth_date && new Date(c.birth_date).getFullYear() === year - 4).length;

    return {
        levelRows,
        schoolCounts,
        ageHeaders,
        girlsRow, boysRow, totalRow,
        yearCounts,
        full6, full5, full4,
        preschoolTotal: full6 + full5 + full4,
        total: children.length
    };
}

// ===================== Друк / PDF =====================
// Формує сторінки: головна (загальний список), сторінки всіх груп,
// статистичні дані, соц. незах., ООП — і відкриває діалог друку
// (в ньому можна зберегти документ як PDF).
function buildPrintDocument() {
    const stats = buildStatistics();
    let html = '';

    // Сторінка 1: Загальний список
    html += `<div class="print-page">` + buildGeneralTableHtml() + `</div>`;

    // Сторінки груп (всі групи)
    getGroupsWithOrder().forEach(g => {
        html += `<div class="print-page">` + buildGroupTableHtml(g) + `</div>`;
    });

    // Сторінка: Статистичні дані
    html += `<div class="print-page">` + buildStatsHtml(stats) + `</div>`;

    // Сторінка: Соц. незах.
    html += `<div class="print-page">` + buildSocialHtml() + `</div>`;

    // Сторінка: ООП
    html += `<div class="print-page">` + buildOopHtml() + `</div>`;

    return html;
}

function buildGeneralTableHtml() {
    const sorted = sortByName(children);
    let rows = '';
    sorted.forEach((c, i) => {
        const color = categoryColor(c.category);
        const style = color ? ` style="background:${color}"` : '';
        rows += `<tr${style}>
            <td class="num">${i + 1}</td>
            <td>${escapeHtml(c.full_name || '')}</td>
            <td class="center">${isNewLabel(c)}</td>
            <td class="num">${c.birth_date ? calcAge(c.birth_date) : ''}</td>
            <td class="center">${escapeHtml(c.school || '')}</td>
            <td class="center">${genderUk(c)}</td>
            <td class="center">${escapeHtml(getGroupName(c.group_id))}</td>
            <td class="center">${formatDate(c.birth_date)}</td>
            <td>${escapeHtml(c.mother || '')}</td>
            <td>${escapeHtml(c.father || '')}</td>
            <td>${escapeHtml(c.address || '')}</td>
            <td>${escapeHtml(c.category || '')}</td>
        </tr>`;
    });
    return `
        <table class="print-table general-table">
            <thead>
                <tr>
                    <th>№</th><th>ПІБ</th><th>Новоприбулі</th><th>Вік (років)</th>
                    <th>Навчальний заклад</th><th>Стать</th><th>Група</th>
                    <th>Дата народження</th><th>Мати</th><th>Батько</th>
                    <th>Домашня адреса</th><th>Категорія</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function buildGroupTableHtml(group) {
    const list = sortByBirthDesc(children.filter(c => c.group_id === group.id));
    let rows = '';
    list.forEach((c, i) => {
        rows += `<tr>
            <td class="num">${i + 1}</td>
            <td>${escapeHtml(c.full_name || '')}</td>
            <td class="center">${isNewLabel(c)}</td>
            <td class="num">${c.birth_date ? calcAge(c.birth_date) : ''}</td>
        </tr>`;
    });
    const level = LEVEL_NAMES[group.name] || group.name;
    return `
        <table class="print-table group-table">
            <thead>
                <tr><th class="idx">Індекс</th><th>ПІБ</th><th>Новоприбулі</th><th>Вік (років)</th></tr>
            </thead>
            <tbody>
                ${rows}
                <tr class="footer-row">
                    <td class="center"><strong>${escapeHtml(level)}</strong></td>
                    <td class="center"><strong>${escapeHtml(group.name)}</strong></td>
                    <td class="center"></td>
                    <td class="num"><strong>${list.length}</strong></td>
                </tr>
            </tbody>
        </table>`;
}

function buildStatsHtml(stats) {
    // Таблиця 1: групи
    let t1 = '';
    stats.levelRows.forEach(r => {
        t1 += `<tr><td>${escapeHtml(r['Рівень навчання'])}</td><td class="center">${escapeHtml(r['Назва групи'])}</td><td class="num">${r['Кількість дітей в групі']}</td></tr>`;
    });
    t1 += `<tr><td colspan="2"><strong>Всього дітей в гуртку:</strong></td><td class="num"><strong>${stats.total}</strong></td></tr>`;

    // Таблиця 2: навчальні заклади
    let t2head = '', t2vals = '';
    SCHOOL_LIST.forEach(s => {
        t2head += `<th>${escapeHtml(s)}</th>`;
        t2vals += `<td class="num">${stats.schoolCounts[s]}</td>`;
    });
    const t2 = `
        <table class="print-table stats-school">
            <tr><th>Навчальний заклад (ліцеї, гімназії, ЗДО)</th>${t2head}</tr>
            <tr><td><strong>Кількість дітей</strong></td>${t2vals}</tr>
            <tr><td><strong>Всього:</strong></td><td class="num" colspan="${SCHOOL_LIST.length}"><strong>${stats.total}</strong></td></tr>
        </table>`;

    // Таблиця 3: вік і стать
    let t3head = '<th></th>', t3g = '<td><strong>З них дівчат</strong></td>',
        t3b = '<td><strong>З них хлопців</strong></td>', t3t = '<td><strong>Разом</strong></td>';
    stats.ageHeaders.forEach(h => {
        t3head += `<th>${escapeHtml(h)}</th>`;
        t3g += `<td class="num">${stats.girlsRow[h]}</td>`;
        t3b += `<td class="num">${stats.boysRow[h]}</td>`;
        t3t += `<td class="num">${stats.totalRow[h]}</td>`;
    });
    t3head += '<th>Всього</th>';
    t3g += `<td class="num"><strong>${stats.girlsRow['Всього']}</strong></td>`;
    t3b += `<td class="num"><strong>${stats.boysRow['Всього']}</strong></td>`;
    t3t += `<td class="num"><strong>${stats.totalRow['Всього']}</strong></td>`;
    const t3 = `<table class="print-table stats-age"><tr>${t3head}</tr><tr>${t3g}</tr><tr>${t3b}</tr><tr>${t3t}</tr></table>`;

    // Таблиця 4: роки народження та дошкільнята
    const t4 = `
        <table class="print-table stats-years">
            <tr>
                ${stats.yearCounts.map(yc => `<th>${escapeHtml(yc.label)}</th>`).join('')}
                <th>Всього в т/о</th>
                <th>Повних 6р.</th>
                <th>Повних 5р.</th>
                <th>Повних 4р.</th>
                <th>Всього дітей дошкільного віку</th>
            </tr>
            <tr>
                ${stats.yearCounts.map(yc => `<td class="num">${yc.count}</td>`).join('')}
                <td class="num"><strong>${stats.total}</strong></td>
                <td class="num">${stats.full6}</td>
                <td class="num">${stats.full5}</td>
                <td class="num">${stats.full4}</td>
                <td class="num"><strong>${stats.preschoolTotal}</strong></td>
            </tr>
        </table>`;

    const clubName = currentClub && currentClub.name ? currentClub.name : 'клубу бального танцю "Вікторія"';
    return `
        <div class="stats-title">
            <div>СТАТИСТИЧНІ ДАНІ</div>
            <div>${escapeHtml(clubName)}</div>
        </div>
        <table class="print-table stats-levels">
            <thead><tr><th>Рівень навчання</th><th>Назва групи</th><th>Кількість дітей в групі</th></tr></thead>
            <tbody>${t1}</tbody>
        </table>
        ${t2}
        ${t3}
        ${t4}`;
}

function buildSocialHtml() {
    const list = sortByBirthDesc(children.filter(c => isSocialCategory(c.category)));
    let rows = '';
    list.forEach((c, i) => {
        rows += `<tr>
            <td class="num">${i + 1}</td>
            <td>${escapeHtml(c.full_name || '')}</td>
            <td class="center">${isNewLabel(c)}</td>
            <td class="center">${formatDate(c.birth_date)}</td>
            <td class="center">${escapeHtml(c.school || '')}</td>
            <td class="center">${escapeHtml(c.category || '')}</td>
            <td>${escapeHtml(c.address || '')}</td>
            <td>${escapeHtml(formatParents(c))}</td>
        </tr>`;
    });
    return `
        <div class="list-title">Список дітей соціально незахищених категорій</div>
        <table class="print-table list-table">
            <thead>
                <tr>
                    <th>№</th><th>ПІБ</th><th>Новоприбулі</th><th>Дата народження</th>
                    <th>Навчальний заклад</th><th>Категорія</th><th>Домашня адреса</th><th>Дані про батьків/опікунів</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function buildOopHtml() {
    const list = sortByBirthDesc(children.filter(c => c.category));
    let rows = '';
    list.forEach((c, i) => {
        rows += `<tr>
            <td class="num">${i + 1}</td>
            <td class="center">${isNewLabel(c)}</td>
            <td>${escapeHtml(c.full_name || '')}</td>
            <td class="center">${formatDate(c.birth_date)}</td>
            <td class="center">${escapeHtml(c.school || '')}</td>
            <td class="center">${escapeHtml(c.category || '')}</td>
            <td>${escapeHtml(c.address || '')}</td>
            <td>${escapeHtml(formatParents(c))}</td>
        </tr>`;
    });
    return `
        <div class="list-title">Список дітей з особливими освітніми проблемами</div>
        <table class="print-table list-table">
            <thead>
                <tr>
                    <th>№</th><th>Новоприбулі</th><th>ПІБ</th><th>Дата народження</th>
                    <th>Навчальний заклад</th><th>Категорія</th><th>Домашня адреса</th><th>Дані про батьків/опікунів</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function printDocument() {
    const container = $('print-container');
    if (!container) return;
    if (!children.length) { showError('Немає даних для друку'); return; }
    container.innerHTML = buildPrintDocument();
    window.print();
}

function exportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Бібліотеку XLSX не завантажено. Перевірте інтернет-з\'єднання.');
        return;
    }
    if (!rawStudentsData || !rawStudentsData.length) {
        alert('Немає даних для експорту');
        return;
    }

    const wb = XLSX.utils.book_new();
    const activeStudents = rawStudentsData.filter(s => s.arhive !== true);
    
    // Допоміжні функції внутрішньо для експорту
    const sortByName = (list) => [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const formatParents = (c) => {
        const m = [c.mother, c.mother_telephone].filter(x => x && x !== '—').join(' ');
        const f = [c.father, c.father_telephone].filter(x => x && x !== '—').join(' ');
        return [m ? `Мати: ${m}` : '', f ? `Батько: ${f}` : ''].filter(Boolean).join('; ');
    };

    const generalCols = [{ wch: 5 }, { wch: 32 }, { wch: 11 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 34 }, { wch: 34 }, { wch: 28 }, { wch: 30 }];

    // 1. Аркуш: Загальний
    const generalRows = sortByName(activeStudents).map((c, i) => ({
        '№': i + 1,
        'ПІБ': c.name || '',
        'Новоприбулі': c.new ? 'н/п' : '',
        'Вік (років)': c.bithday ? calculateAge(c.bithday) : '',
        'Навчальний заклад': c.school?.title || '',
        'Стать': c.sex?.title || '',
        'Група': c.group?.title || '',
        'Дата народження': formatDate(c.bithday),
        'Мати': [c.mother, c.mother_telephone].filter(x => x && x !== '—').join(' '),
        'Батько': [c.father, c.father_telephone].filter(x => x && x !== '—').join(' '),
        'Домашня адреса': c.address || '',
        'Категорія': c.category || ''
    }));
    const wsGeneral = XLSX.utils.json_to_sheet(generalRows);
    wsGeneral['!cols'] = generalCols;
    XLSX.utils.book_append_sheet(wb, wsGeneral, 'Загальний');

    // 2. Аркуші груп
    const order = ['Підготовча', 'Молодша', 'Середня', 'Старша'];
    const groupsList = [...dictionaries.group].sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));

    groupsList.forEach(g => {
        const list = sortByAge(activeStudents.filter(c => c.group_id === g.id));
        const rows = list.map((c, i) => ({
            'Індекс': i + 1,
            'ПІБ': c.name || '',
            'Новоприбулі': c.new ? 'н/п' : '',
            'Вік (років)': c.bithday ? calculateAge(c.bithday) : '',
            'Навчальний заклад': c.school?.title || '',
            'Стать': c.sex?.title || '',
            'Мати': [c.mother, c.mother_telephone].filter(x => x && x !== '—').join(' '),
            'Батько': [c.father, c.father_telephone].filter(x => x && x !== '—').join(' '),
            'Домашня адреса': c.address || '',
            'Категорія': c.category || ''
        }));
        
        const docName = docGroupNames[g.title] || g.title;
        rows.push({
            'Індекс': docName,
            'ПІБ': g.title,
            'Вік (років)': list.length,
            'Домашня адреса': 'дітей'
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 11 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 34 }, { wch: 34 }, { wch: 28 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, g.title);
    });

    // 3. Аркуш: С вік
    const byAgeRows = sortByAge(activeStudents).map((c, i) => ({
        '№': i + 1,
        'ПІБ': c.name || '',
        'Новоприбулі': c.new ? 'н/п' : '',
        'Вік (років)': c.bithday ? calculateAge(c.bithday) : '',
        'Навчальний заклад': c.school?.title || '',
        'Стать': c.sex?.title || '',
        'Група': c.group?.title || '',
        'Дата народження': formatDate(c.bithday),
        'Мати': [c.mother, c.mother_telephone].filter(x => x && x !== '—').join(' '),
        'Батько': [c.father, c.father_telephone].filter(x => x && x !== '—').join(' '),
        'Домашня адреса': c.address || '',
        'Категорія': c.category || ''
    }));
    const wsByAge = XLSX.utils.json_to_sheet(byAgeRows);
    wsByAge['!cols'] = generalCols;
    XLSX.utils.book_append_sheet(wb, wsByAge, 'С вік');

    // 4. Аркуш: С НЗ (за навчальним закладом)
    const bySchoolRows = [...activeStudents].sort((a,b) => (a.school?.title || '').localeCompare(b.school?.title || '')).map((c, i) => ({
        '№': i + 1,
        'ПІБ': c.name || '',
        'Новоприбулі': c.new ? 'н/п' : '',
        'Вік (років)': c.bithday ? calculateAge(c.bithday) : '',
        'Навчальний заклад': c.school?.title || '',
        'Стать': c.sex?.title || '',
        'Група': c.group?.title || '',
        'Дата народження': formatDate(c.bithday),
        'Мати': [c.mother, c.mother_telephone].filter(x => x && x !== '—').join(' '),
        'Батько': [c.father, c.father_telephone].filter(x => x && x !== '—').join(' '),
        'Домашня адреса': c.address || '',
        'Категорія': c.category || ''
    }));
    const wsBySchool = XLSX.utils.json_to_sheet(bySchoolRows);
    wsBySchool['!cols'] = generalCols;
    XLSX.utils.book_append_sheet(wb, wsBySchool, 'С НЗ');

    // 5. Аркуш: Соц. незах.
    const socialList = sortByAge(activeStudents.filter(c => c.socially_vulnerable === true));
    const socialRows = socialList.map((c, i) => ({
        '№': i + 1,
        'ПІБ': c.name || '',
        'Новоприбулі': c.new ? 'н/п' : '',
        'Дата народження': formatDate(c.bithday),
        'Навчальний заклад': c.school?.title || '',
        'Категорія': c.category || '',
        'Домашня адреса': c.address || '',
        'Дані про батьків/опікунів': formatParents(c)
    }));
    const wsSocial = XLSX.utils.json_to_sheet(socialRows);
    wsSocial['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 11 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsSocial, 'Соц. незах.');

    // 6. Аркуш: ООП
    const oopList = sortByAge(activeStudents.filter(c => c.oop === true));
    const oopRows = oopList.map((c, i) => ({
        '№': i + 1,
        'Новоприбулі': c.new ? 'н/п' : '',
        'ПІБ': c.name || '',
        'Дата народження': formatDate(c.bithday),
        'Навчальний заклад': c.school?.title || '',
        'Категорія': c.category || '',
        'Домашня адреса': c.address || '',
        'Дані про батьків/опікунів': formatParents(c)
    }));
    const wsOop = XLSX.utils.json_to_sheet(oopRows);
    wsOop['!cols'] = [{ wch: 5 }, { wch: 11 }, { wch: 32 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsOop, 'ООП');

    const fileName = (currentClub?.title || 'звіт_статистики').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}