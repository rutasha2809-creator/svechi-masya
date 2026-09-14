/* ============================================================
   syntax-test.js — целостность самого файла index.html

   Страница собирается склейкой кусков, и одна опечатка в шаблонной
   строке роняет её целиком: браузер открывает белый экран, а в
   консоли — одна строчка ошибки. Проверять это надо ПЕРВЫМ делом,
   до всех расчётов.

   Запуск:  node tests/syntax-test.js
   ============================================================ */
const fs = require('fs');
const T = require('./harness.js');

T.head('Файл на месте');
const html = fs.readFileSync(T.FILE, 'utf8');
T.check(html.length > 100000, 'index.html не пустой и не обрезан: ' + Math.round(html.length / 1024) + ' КБ');

T.head('Разметка');
T.check(/<!doctype html>/i.test(html), 'есть <!doctype html>');
T.check(/<html[^>]*lang=["']ru["']/i.test(html), 'язык страницы — русский');
T.check(/<meta[^>]*viewport/i.test(html), 'есть meta viewport (иначе на телефоне всё мелкое)');
T.check(/<meta[^>]*charset=["']?utf-8/i.test(html), 'кодировка utf-8');
T.check(html.includes('</html>'), 'файл дописан до конца — есть </html>');

T.head('Скрипт приложения');
const blocks = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || [];
T.check(blocks.length >= 1, 'блок <script> найден');
let src = '';
for (const b of blocks) {
  const body = b.replace(/^<script\b[^>]*>/, '').replace(/<\/script>$/, '');
  if (body.length > src.length) src = body;
}
T.check(src.length > 100000, 'скрипт не обрезан: ' + Math.round(src.length / 1024) + ' КБ');

let синтаксисОК = true;
try {
  new Function(src);
  T.ok('синтаксис скрипта в порядке');
} catch (e) {
  синтаксисОК = false;
  T.bad('СИНТАКСИЧЕСКАЯ ОШИБКА — страница не откроется вообще: ' + e.message);
}

T.head('Метка для тестов');
T.check(src.includes('/* --- ' + 'старт' + ' --- */'),
  'метка «/* --- старт --- */» на месте (по ней тесты отделяют расчёты от запуска интерфейса)');

T.head('Ничего не потерялось');
const должноБыть = {
  'справочник материалов (SEED)': 'const SEED=',
  'расчёт себестоимости': 'function calc(',
  'производные величины': 'function derive(',
  'цена продажи': 'function priceOf(',
  'партии материала': 'function sortedLots(',
  'списание со склада': 'function consume(',
  'ведомость по средневзвешенной': 'function ledger(',
  'средняя цена за месяц': 'function avgPrice(',
  'списание материалов': 'function shipDo(',
  'журнал движений': 'function renderLog(',
  'закупка': 'function doBuy(',
  'синхронизация с общей базой': 'function cloudSchedule(',
};
for (const имя in должноБыть) T.check(src.includes(должноБыть[имя]), имя);

T.head('Разделы справочника доступны на компьютере');
/* Ряд разделов («все», «Воск», «Гипс и смеси», …) на телефоне листается
   пальцем, а на компьютере горизонтальной прокрутки мышью нет — правые
   разделы становились недоступны. На широком экране ряд должен переноситься. */
T.check(/\.chips\{[^}]*overflow-x:auto/.test(html), 'на узком экране ряд разделов листается');
T.check(/@media\(min-width:\d+px\)\{\.chips\{[^}]*flex-wrap:wrap/.test(html),
  'на широком экране ряд разделов переносится на несколько строк');

T.head('Выбора партии в строке состава нет');
/* Владелец просила убрать список закупок из строки состава и больше его
   не возвращать: цена берётся сама, от партии «в работе», а закупки
   расходуются по очереди от самой старой. Эти четыре проверки — сторож.
   Если кто-то вернёт выбор партии, здесь будет ошибка. */
T.check(!/pickLot\s*\(/.test(src), 'функции выбора партии нет');
T.check(!/toggleLot\s*\(/.test(src), 'ссылки «взять из другой закупки» нет');
T.check(!/function matPrice\(m,\s*lotId\)/.test(src), 'matPrice не принимает выбранную партию');
T.check(!/matPrice\(m,\s*l\.lot\)/.test(src), 'расчёт не спрашивает партию у строки состава');

T.head('Вкладки на месте');
/* Отчёты переехали из «Ещё» на свою вкладку (14.09.2026): ведомость и сверка
   с Excel — это отчёты, а не настройки. Сама вкладка «Ещё» переименована. */
for (const [имя, метка] of [['Изделия', 'prod'], ['Склад', 'stock'], ['Заказы', 'orders'],
                            ['Отчёты', 'rep'], ['Параметры', 'more']]) {
  T.check(new RegExp('data-s="' + метка + '"').test(html), 'кнопка вкладки: ' + имя);
  T.check(new RegExp('<section id="s-' + метка + '"').test(html), 'раздел вкладки: ' + имя);
}
T.check(!/>Ещё<\/button>/.test(html), 'вкладки «Ещё» больше нет');
T.check(html.indexOf('Ведомость по средневзвешенной') > html.indexOf('<section id="s-rep"')
     && html.indexOf('Ведомость по средневзвешенной') < html.indexOf('<section id="s-more"'),
  'ведомость лежит во вкладке «Отчёты»');
T.check(html.indexOf('id="verify-card"') > html.indexOf('<section id="s-rep"')
     && html.indexOf('id="verify-card"') < html.indexOf('<section id="s-more"'),
  'сверка с Excel лежит там же');
T.check(src.includes('function renderVerify('), 'сверка рисуется своей функцией');
T.check(/if\(tab_==='rep'\)renderVerify\(\)/.test(src), 'и вызывается при открытии вкладки');

T.head('Служебное — под шестерёнкой, а не во вкладке');
/* Данные приложения, резервная копия и общая база мастеру каждый день не нужны:
   они живут в шторке под шестерёнкой в шапке (14.09.2026). */
T.check(/class="gear"/.test(html), 'шестерёнка есть в шапке');
T.check(/onclick="openAdmin\(\)"/.test(html), 'она открывает служебный раздел');
T.check(src.includes('function adminView('), 'служебный раздел собирается своей функцией');
T.check(src.includes('function dataBoxHtml(') && src.includes('function cloudBoxHtml('),
  'данные приложения и общая база вынесены в функции разметки');
const более = html.slice(html.indexOf('<section id="s-more"'), html.indexOf('</section>', html.indexOf('<section id="s-more"')));
for (const имя of ['Данные приложения', 'Резервная копия', 'Общая база'])
  T.check(!более.includes(имя), 'во вкладке «Параметры» больше нет: ' + имя);

T.head('Списки на «Складе» сворачиваются');
/* Материалов много: когда нужна только история закупок, длинный список мешает.
   Оба списка сворачиваются, выбор помнится между запусками (14.09.2026). */
T.check(/onclick="foldStock\('mat'\)"/.test(html), 'заголовок «Материалы» — переключатель');
T.check(/onclick="foldStock\('log'\)"/.test(html), 'заголовок истории — тоже переключатель');
T.check(/id="mat-wrap"/.test(html) && /id="log-wrap"/.test(html), 'у обоих списков есть свой контейнер');
T.check(src.includes('function foldStock(') && src.includes('function applyFold('),
  'свёртывание живёт в своих функциях');
T.check(src.includes("lsSet(UKEY"), 'выбор сохраняется между запусками');
T.check(/applyFold\('mat'/.test(src) && /applyFold\('log'/.test(src),
  'состояние применяется при отрисовке обоих списков');

T.head('Ключи от общей базы');
T.check(src.includes('ahjfdswfafiborxplndr.supabase.co'), 'адрес общей базы на месте');
T.check(src.includes('sb_publishable_'), 'открытый ключ на месте');
T.check(!/sb_secret_/.test(html), 'СЕКРЕТНОГО ключа в файле нет — и не должно быть');

T.head('Приложение стартует пустым');
T.check(/S=load\(\)/.test(html), 'состояние поднимается через load()');
T.check(!/S=SEED/.test(html.replace(/\s/g, '')), 'пример из Excel НЕ подставляется автоматически');

if (!синтаксисОК) console.log('\n  Остальные тесты запускать бессмысленно, пока не исправлен синтаксис.');
T.done('целостность файла');
