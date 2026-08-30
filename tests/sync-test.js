/* ============================================================
   sync-test.js — удалённое не должно возвращаться

   Случай из жизни: завели тестовое изделие, удалили, обновили
   страницу — изделие вернулось. Причина: правка ложится в этот
   браузер сразу, а в общую базу уходит через 1,2 секунды. Если
   страницу закрыли раньше, запуск слепо забирал общую базу и
   затирал ею то, что человек только что сделал.

   Проверяем:
     — удаление сразу помечается как «неотправленное»;
     — удаление тут же уходит в базу, не дожидаясь секунды;
     — на запуске неотправленные правки НЕ затираются общей базой:
       если базу никто не трогал — досылаем своё;
       если трогал — показываем выбор, но данные не подменяем;
     — когда всё отправлено, запуск спокойно берёт версию из базы.
   ============================================================ */
const T = require('./harness.js');
const app = T.loadApp();
const S = T.withEmpty(app);

/* Изображаем облако: одна строка с данными и номером версии. */
let облако = { version: 7, data: { materials: [], recipes: [{ id: 'r-тест', n: 'ТЕСТ', c: 'Ароматизация', p: {}, l: [], mk: [], en: [], tl: [] }], settings: {}, log: [] } };
let запросов = { pull: 0, push: 0 };

app.MODE = 'cloud';
app.AU = { access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 3600000, name: 'мастер' };
app.ensureToken = () => Promise.resolve(true);
app.render = () => {};
app.cloudPull = silent => { запросов.pull++; return Promise.resolve({ data: JSON.parse(JSON.stringify(облако.data)), version: облако.version }); };
app.cloudPush = force => {
  запросов.push++;
  облако = { version: облако.version + 1, data: JSON.parse(JSON.stringify(app.S)) };
  app.CL.ver = облако.version;
  app.syncMark(false, облако.version);
  return Promise.resolve();
};
const состояние = () => app.syncState();

T.head('Правка помечается как неотправленная');
/* В тестах отправка в облако заглушена, поэтому саму пометку смотрим в коде:
   cloudSchedule() обязан ставить признак «есть неотправленное» ДО задержки. */
const src = require('fs').readFileSync(T.FILE, 'utf8');
const планировщик = src.slice(src.indexOf('function cloudSchedule('), src.indexOf('function cloudFlush('));
T.check(/syncMark\(true\)/.test(планировщик), 'cloudSchedule помечает правку неотправленной сразу');
T.check(/pushTimer=setTimeout/.test(планировщик), 'и только потом откладывает отправку');
app.syncMark(true, 7);
T.check(состояние().dirty === true, 'пометка сохраняется между запусками страницы');
app.syncMark(false, 7);
app.CL.ver = 7;
S.recipes.push({ id: 'r-тест', n: 'ТЕСТ', c: 'Ароматизация', p: {}, l: [], mk: [], en: [], tl: [] });

T.head('Удаление уходит в базу сразу');
app.Did = 'r-тест';
app.D = JSON.parse(JSON.stringify(S.recipes[0]));
запросов.push = 0;
app.delRecipe();
T.check(S.recipes.length === 0, 'изделие удалено из данных');
T.check(запросов.push === 1, 'отправка не ждёт секунду, а идёт сразу');
T.check(состояние().dirty === false, 'после отправки неотправленного не осталось');

/* Дальше — самое важное: что делает запуск. */
function запуск() { return app.cloudBoot(); }
app.startPoll = () => {}; app.syncBadge = () => {}; app.bkAuto = () => {};

T.head('Запуск не затирает неотправленное удаление');
/* Мастер удалил изделие и сразу закрыл вкладку: локально пусто,
   в облаке ещё лежит старая версия с изделием. */
app.S = { materials: [], recipes: [], cats: [], settings: {}, log: [], v: 2 };
облако = { version: 7, data: { materials: [], recipes: [{ id: 'r-тест', n: 'ТЕСТ' }], settings: {}, log: [] } };
app.syncMark(true, 7);
запросов.push = 0;
return запуск().then(() => {
  T.check(app.S.recipes.length === 0, 'изделие НЕ вернулось из общей базы');
  T.check(запросов.push === 1, 'вместо этого своё удаление дослано в базу');
  T.check(облако.data.recipes.length === 0, 'в общей базе изделия тоже больше нет');

  T.head('Если базу за это время правил кто-то ещё');
  app.S = { materials: [], recipes: [], cats: [], settings: {}, log: [], v: 2 };
  облако = { version: 9, data: { materials: [], recipes: [{ id: 'r-чужое', n: 'ЧУЖОЕ' }], settings: {}, log: [] } };
  app.syncMark(true, 7);           // мы остановились на 7, а в базе уже 9
  запросов.push = 0;
  app.CL.conflict = false;
  return запуск();
}).then(() => {
  T.check(app.CL.conflict === true, 'показан выбор, чью версию оставить');
  T.check(app.S.recipes.length === 0, 'молча чужой версией не затёрло');
  T.check(запросов.push === 0, 'и молча своей тоже не перезаписало');

  T.head('Когда всё отправлено, берём версию из базы');
  app.S = { materials: [], recipes: [], cats: [], settings: {}, log: [], v: 2 };
  облако = { version: 11, data: { materials: [{ id: 'm1', g: 'wax', n: 'Воск', u: 'г', p: 1, s: 0, lots: [] }], recipes: [{ id: 'r-новое', n: 'НОВОЕ' }], settings: {}, log: [] } };
  app.syncMark(false, 9);
  app.CL.conflict = false;
  return запуск();
}).then(() => {
  T.check(app.S.recipes.length === 1 && app.S.recipes[0].id === 'r-новое', 'данные подтянулись из общей базы');
  T.check(app.CL.ver === 11, 'номер версии запомнен');
  T.check(состояние().dirty === false, 'неотправленного нет');
  T.done('синхронизация и удаления');
});
