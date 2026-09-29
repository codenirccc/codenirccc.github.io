const KEY = 'mcworld';

export function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

export function save(state) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
    } catch (e) {
        return false;
    }
}

export function clear() {
    try {
        localStorage.removeItem(KEY);
    } catch (e) {
        void e;
    }
}
