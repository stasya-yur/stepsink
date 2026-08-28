const SUPABASE_URL = 'https://ehkjwiwouwkvdaoqzjkv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SBrt_x_uF1qcCGc18OsdDQ_UFp58tw9';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AUTH_STORAGE_KEY = 'statistic_app_user';

async function getCurrentUser() {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (e) {
        return null;
    }
}

function setCurrentUser(user) {
    if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }
}

async function checkAuthAndRedirect() {
    const user = await getCurrentUser();
    const currentPage = window.location.pathname.split("/").pop();

    if (!user && currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
    } else if (user && (currentPage === 'index.html' || currentPage === '')) {
        window.location.href = 'club.html';
    }
    return user;
}

async function customLogin(login, password) {
    const { data: users, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('login', login)
        .eq('password', password)
        .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) throw new Error('Невірний логін або пароль');

    const user = users[0];
    setCurrentUser({ id: user.id, login: user.login });
    return user;
}

async function customRegister(login, password) {
    const { data: existing, error: checkError } = await supabaseClient
        .from('users')
        .select('id')
        .eq('login', login)
        .limit(1);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) throw new Error('Користувач з таким логіном вже існує');

    const { data: newUsers, error: insertError } = await supabaseClient
        .from('users')
        .insert([{ login, password }])
        .select();

    if (insertError) throw insertError;
    if (!newUsers || newUsers.length === 0) throw new Error('Помилка створення користувача');

    const user = newUsers[0];
    setCurrentUser({ id: user.id, login: user.login });
    return user;
}

async function customLogout() {
    setCurrentUser(null);
}
