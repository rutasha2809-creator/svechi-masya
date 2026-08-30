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
  'выпуск партии': 'function doMake(',
  'закупка': 'function doBuy(',
  'синхронизация с общей базой': 'function cloudSchedule(',
};
for (const имя in должноБыть) T.check(src.includes(должноБыть[имя]), имя);

T.head('Ключи от общей базы');
T.check(src.includes('ahjfdswfafiborxplndr.supabase.co'), 'адрес общей базы на месте');
T.check(src.includes('sb_publishable_'), 'открытый ключ на месте');
T.check(!/sb_secret_/.test(html), 'СЕКРЕТНОГО ключа в файле нет — и не должно быть');

T.head('Приложение стартует пустым');
T.check(/S=load\(\)/.test(html), 'состояние поднимается через load()');
T.check(!/S=SEED/.test(html.replace(/\s/g, '')), 'пример из Excel НЕ подставляется автоматически');

if (!синтаксисОК) console.log('\n  Остальные тесты запускать бессмысленно, пока не исправлен синтаксис.');
T.done('целостность файла');
