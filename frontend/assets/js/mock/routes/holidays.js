/**
 * ДЗ 1: свята.
 *   GET  /holidays?year=     → список (будь-який залогінений користувач)
 *   POST /holidays           {date, title} → 201 (адмін)
 *   DELETE /holidays/{id}    → 204 (адмін, додатково до ДЗ)
 */
(function () {
    const { route, http, validate } = TT.mock;

    route('GET', '/holidays', ({ db, query }) => {
        const list = db.holidays
            .filter((h) => !query.year || h.date.startsWith(`${query.year}-`))
            .sort((a, b) => a.date.localeCompare(b.date));
        return http.json(list);
    });

    route('POST', '/holidays', ({ db, body }) => {
        const data = validate(body, { date: 'required|date', title: 'required|min:2|max:255' });
        if (db.holidays.some((h) => h.date === data.date)) {
            throw http.validation({ date: 'Holiday for this date already exists' });
        }
        const holiday = { id: TT.mock.db.nextId('holidays'), date: data.date, title: data.title.trim() };
        db.holidays.push(holiday);
        return http.json(holiday, 201);
    }, { admin: true });

    route('DELETE', '/holidays/{id}', ({ db, params }) => {
        const index = db.holidays.findIndex((h) => h.id === Number(params.id));
        if (index === -1) throw http.notFound('Holiday not found');
        db.holidays.splice(index, 1);
        return http.noContent();
    }, { admin: true });
})();
