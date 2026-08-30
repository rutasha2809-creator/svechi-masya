/* ============================================================
   Общий загрузчик для всех тестов.

   Достаёт из index.html скрипт приложения, обрезает его по метке
   /* --- старт --- *​/ (всё, что ниже неё, — запуск интерфейса,
   тестам он не нужен) и выполняет остаток в Node с заглушками
   вместо браузера. Так тесты работают без установки чего-либо:
   нужен только node.

   ВАЖНО для того, кто правит index.html:
   метка «/* --- старт --- *​/» перед строкой S=load() должна остаться
   на месте. Без неё тесты не запустятся и честно об этом скажут.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');

const MARK = '/* --- ' + 'старт' + ' --- */';

function loadApp() {
  if (!fs.existsSync(FILE)) {
    fail('Не найден файл index.html рядом с папкой tests.\nОжидался здесь: ' + FILE);
  }
  const html = fs.readFileSync(FILE, 'utf8');

  const blocks = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || [];
  if (!blocks.length) fail('В index.html не нашлось ни одного блока <script>.');
  // берём самый крупный блок — это и есть приложение
  let src = '';
  for (const b of blocks) {
    const body = b.replace(/^<script\b[^>]*>/, '').replace(/<\/script>$/, '');
    if (body.length > src.length) src = body;
  }

  const cut = src.indexOf(MARK);
  if (cut < 0) {
    fail(
      'В index.html пропала метка ' + MARK + '\n' +
      'Она стоит перед строкой S=load() и отделяет расчёты от запуска интерфейса.\n' +
      'Верните метку на место — тесты снова заработают.'
    );
  }
  src = src.slice(0, cut);

  // Значения, объявленные через const/let, снаружи не видны — выносим нужные наружу.
  src += `
;(function(){
  var out = globalThis;
  Object.defineProperty(out,'S',{get:function(){return S},set:function(v){S=v},configurable:true});
  out.SEED=SEED; out.DEF_SET=DEF_SET; out.MAT=MAT; out.REC=REC;
  out.rnd=rnd; out.fmt=fmt; out.QTYRULES=QTYRULES; out.MONTHS=MONTHS;
  out.byName=byName; out.PACK_G=PACK_G;
})();
// Заглушки интерфейса: тесты дёргают действия приложения напрямую,
// рисовать при этом нечего и в облако ходить не надо.
render=function(){};
toast=function(t){ globalThis.__toasts.push(String(t)) };
paint=function(){}; back=function(){}; closeAll=function(){ stack=[] };
cloudSchedule=function(){}; syncBadge=function(){}; startPoll=function(){}; stopPoll=function(){};
;(function(){
  var out=globalThis;
  out.__toasts=[];
  out.doBuy=doBuy; out.consume=consume; out.newLot=newLot;
  out.conv=conv; out.baseOf=baseOf; out.stockOf=stockOf; out.valueOf_=valueOf;
  out.sortedLots=sortedLots; out.activeLot=activeLot; out.lotById=lotById; out.matPrice=matPrice;
  out.syncStock=syncStock; out.save=save; out.allCats=allCats; out.usage=usage; out.canMake=canMake;
  Object.defineProperty(out,'buyRows',{get:function(){return buyRows},set:function(v){buyRows=v},configurable:true});
  Object.defineProperty(out,'D',{get:function(){return D},set:function(v){D=v},configurable:true});
  Object.defineProperty(out,'Did',{get:function(){return Did},set:function(v){Did=v},configurable:true});
  Object.defineProperty(out,'tab_',{get:function(){return tab_},set:function(v){tab_=v},configurable:true});
  Object.defineProperty(out,'pickState',{get:function(){return pickState},set:function(v){pickState=v},configurable:true});
  Object.defineProperty(out,'pickRec',{get:function(){return pickRec},set:function(v){pickRec=v},configurable:true});
  Object.defineProperty(out,'ordId',{get:function(){return ordId},set:function(v){ordId=v},configurable:true});
  Object.defineProperty(out,'avgYM',{get:function(){return avgYM},set:function(v){avgYM=v},configurable:true});
  /* синхронизация с общей базой — нужна sync-test.js */
  Object.defineProperty(out,'CL',{get:function(){return CL},set:function(v){CL=v},configurable:true});
  Object.defineProperty(out,'MODE',{get:function(){return MODE},set:function(v){MODE=v},configurable:true});
  Object.defineProperty(out,'AU',{get:function(){return AU},set:function(v){AU=v},configurable:true});
})();`;

  // --- заглушки браузера: ровно столько, сколько нужно расчётам ---
  const store = {};
  const noop = () => {};
  const el = () => ({
    innerHTML: '', value: '', style: {}, classList: { add: noop, remove: noop, toggle: noop },
    appendChild: noop, addEventListener: noop, focus: noop, click: noop, remove: noop,
    querySelector: () => null, querySelectorAll: () => [],
  });
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, Date, JSON, Number, String, Array, Object, Boolean, RegExp, Error, Set, Map,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    Promise, fetch: () => Promise.reject(new Error('сеть в тестах отключена')),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    navigator: { onLine: true },
    location: { href: 'file:///index.html', hash: '', search: '' },
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: cb => setTimeout(cb, 0),
    confirm: () => true,
    alert: noop,
    prompt: () => null,
    document: {
      hidden: false,
      body: el(), documentElement: el(),
      // поля экрана: тест выставляет значение как пользователь — document.getElementById('mk-qty').value='3'
      getElementById: id => (els[id] || (els[id] = el())),
      querySelector: () => null, querySelectorAll: () => [],
      createElement: el, addEventListener: noop,
    },
  };
  const els = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: 'index.html (скрипт приложения)' });
  } catch (e) {
    fail('Скрипт приложения не выполнился: ' + e.message);
  }
  return sandbox;
}

/* Свежее состояние из SEED — то же, что кнопка «Загрузить пример из Excel» */
function withSeed(app) {
  const S = JSON.parse(JSON.stringify(app.SEED));
  S.settings = Object.assign({}, app.DEF_SET, S.settings || {});
  S.log = S.log || [];
  app.S = S;
  return S;
}

/* Пустое состояние — как у мастера, который только открыл приложение */
function withEmpty(app) {
  const S = { materials: [], recipes: [], cats: [], settings: Object.assign({}, app.DEF_SET), log: [], v: 2 };
  app.S = S;
  return S;
}

// ---------- вывод ----------
let failed = 0;
const ok = s => console.log('  ok    ' + s);
const bad = s => { failed++; console.log('  ОШИБКА ' + s); };

function check(cond, what) { cond ? ok(what) : bad(what); }

function near(actual, expected, tol, what) {
  const a = Number(actual), e = Number(expected);
  if (Math.abs(a - e) <= tol) ok(what + ' = ' + a);
  else bad(what + ': получилось ' + a + ', а должно быть ' + e);
}

function head(title) { console.log('\n=== ' + title + ' ==='); }

function done(title) {
  console.log('');
  if (failed) {
    console.log('ИТОГ: ' + title + ' — ошибок: ' + failed);
    process.exit(1);
  }
  console.log('ИТОГ: ' + title + ' — всё сошлось');
  process.exit(0);
}

function fail(msg) { console.log('\nНЕ УДАЛОСЬ ЗАПУСТИТЬ ТЕСТ\n' + msg + '\n'); process.exit(2); }

module.exports = { loadApp, withSeed, withEmpty, check, near, ok, bad, head, done, fail, ROOT, FILE };
