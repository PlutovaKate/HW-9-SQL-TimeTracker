/**
 * Налаштування фронтенду.
 *
 * USE_MOCK = true  — усі запити обробляє мок-сервер у браузері (assets/js/mock/*).
 * USE_MOCK = false — запити йдуть на справжній API (API_BASE).
 *
 * Перемкнути можна і без редагування файлу: кнопка «API» → перемикач Mock / Live
 * (значення зберігається в localStorage і має пріоритет над USE_MOCK нижче).
 */
window.TT = window.TT || {};

/** Безпечна обгортка над localStorage: у приватному режимі він може кидати винятки. */
TT.store = {
    get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            // немає доступу до сховища: працюємо без збереження
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            // ігноруємо
        }
    },
};

TT.config = {
    API_BASE: 'http://localhost:8080/api',
    USE_MOCK: false,
    MOCK_DELAY: [150, 400],
    LATE_TOLERANCE: 10,
};

const mockOverride = TT.store.get('tt_use_mock');
if (typeof mockOverride === 'boolean') {
    TT.config.USE_MOCK = mockOverride;
}
