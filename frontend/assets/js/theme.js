// Підключається в <head>, щоб тема застосувалась до першого малювання сторінки (без «блимання»).
(function () {
    let theme = null;
    try {
        theme = JSON.parse(localStorage.getItem('tt_theme'));
    } catch (e) {
        theme = null;
    }
    if (theme !== 'light' && theme !== 'dark') {
        theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-bs-theme', theme);
})();
