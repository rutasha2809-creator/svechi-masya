/* ============================================================
   auth-test.js — восстановление пароля и копии базы

   Сеть в тестах отключена: вместо fetch подставляем свою функцию
   и смотрим, куда и с чем приложение собиралось пойти.
   ============================================================ */
const T = require('./harness.js');
const app = T.loadApp();
T.withSeed(app);

/* --- перехват сети --- */
let вызовы = [];
function сеть(ответ) {
  вызовы = [];
  app.fetch = (url, opts) => {
    вызовы.push({ url: String(url), opts: opts || {} });
    return Promise.resolve(Object.assign({ ok: true, json: () => Promise.resolve({}) }, ответ || {}));
  };
}
const поле = id => app.document.getElementById(id);

T.head('Ссылка из письма распознаётся');
app.location.hash = '#access_token=ТОКЕН123&expires_in=3600&type=recovery';
let r = app.recoveryLink();
T.check(!!r && r.tok === 'ТОКЕН123', 'из адреса взят токен восстановления');

app.location.hash = '#error=access_denied&error_description=Email+link+is+invalid+or+has+expired';
r = app.recoveryLink();
T.check(!!r && /invalid|expired/i.test(r.err || ''), 'протухшая ссылка распознаётся как ошибка, а не как вход');

app.location.hash = '';
T.check(app.recoveryLink() === null, 'обычное открытие страницы за восстановление не принимается');

app.location.hash = '#access_token=ТОКЕН&type=signup';
T.check(app.recoveryLink() === null, 'чужая метка (не recovery) игнорируется');

T.head('Запрос письма');
сеть();
app.gateShow(); app.gateForgot();
поле('g-rmail').value = ' masya@example.com ';
app.doGateForgot();
T.check(вызовы.length === 1, 'запрос ушёл один');
const u = (вызовы[0] || {}).url || '';
T.check(/\/auth\/v1\/recover/.test(u), 'адрес запроса — recover');
T.check(/redirect_to=/.test(u), 'указано, куда вернуть человека после письма');
T.check(/"email":"masya@example.com"/.test(String((вызовы[0].opts || {}).body || '')),
  'почта отправлена без лишних пробелов');

T.head('Новый пароль');
сеть();
app.gateNewPass('ТОКЕН123');
поле('g-p1').value = 'коротк';
поле('g-p2').value = 'коротк';
поле('g-p1').value = '12345';
поле('g-p2').value = '12345';
app.doNewPass();
T.check(вызовы.length === 0, 'пароль короче шести знаков не отправляется');

сеть();
поле('g-p1').value = 'новыйпароль';
поле('g-p2').value = 'другойпароль';
app.doNewPass();
T.check(вызовы.length === 0, 'несовпадающие пароли не отправляются');

сеть();
поле('g-p1').value = 'новыйпароль';
поле('g-p2').value = 'новыйпароль';
app.doNewPass();
T.check(вызовы.length === 1, 'запрос на смену пароля ушёл');
const o = (вызовы[0] || {}).opts || {};
T.check(/\/auth\/v1\/user/.test((вызовы[0] || {}).url || '') && o.method === 'PUT', 'адрес и метод верные');
T.check(String((o.headers || {}).Authorization || '') === 'Bearer ТОКЕН123',
  'пароль меняется по токену из письма, а не по старой сессии');

T.head('Копии базы');
const src = require('fs').readFileSync(T.FILE, 'utf8');
T.check(/const BK_KEEP=14/.test(src), 'храним последние 14 копий');
T.check(/app_backups/.test(src), 'копии складываются в отдельную таблицу app_backups');
T.check(!/app_backups[^']*select=[^']*\bdata\b/.test(src.match(/function bkList[\s\S]*?\n}/)[0]),
  'список копий тянет только даты, без самих данных (иначе сгорит бесплатный трафик)');

/* Без общей базы копии не делаются: локальному режиму некуда их класть. */
app.MODE = 'local';
сеть();
return Promise.resolve()
  .then(() => app.bkMake(true))
  .then(ok => {
    T.check(ok === false && вызовы.length === 0, 'в локальном режиме копия не делается');
    T.done('вход и копии базы');
  });
