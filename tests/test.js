/* ============================================================
   test.js — эталон себестоимости

   Раньше здесь сверялись цифры с исходным Excel и правильным ответом
   было «совпало 63». С 30.08.2026 это больше не мерило: в Excel масса
   воска округлялась до десятков (280 мл давали 270 г вместо 266), и
   владелец решила считать без округления. Расчёт разошёлся с файлом
   намеренно — во всех изделиях, где есть воск.

   Поэтому сверка теперь идёт с ЭТАЛОНОМ — снимком себестоимости всех
   изделий, снятым с заведомо исправной версии (tests/эталон.json).
   Любая случайная правка расчёта его сдвинет, и тест это покажет.

   Если расчёт изменили НАМЕРЕННО и новые цифры верны — обновите эталон:

       node tests/test.js --обновить

   Расхождения с Excel печатаются справочно и ошибкой не считаются.

   Запуск:  node tests/test.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const T = require('./harness.js');

const ЭТАЛОН = path.join(__dirname, 'эталон.json');
const обновить = process.argv.includes('--обновить') || process.argv.includes('--update');

const app = T.loadApp();
const S = T.withSeed(app);

const снимок = () => {
  const o = {};
  for (const r of S.recipes) o[r.n] = +app.calc(r, 'lot').cost.toFixed(4);
  return o;
};

T.head('Пример из Excel загрузился');
T.check(S.materials.length === 481, 'материалов: 481 (сейчас ' + S.materials.length + ')');
T.check(S.recipes.length === 71, 'изделий: 71 (сейчас ' + S.recipes.length + ')');

const сейчас = снимок();

if (обновить || !fs.existsSync(ЭТАЛОН)) {
  fs.writeFileSync(ЭТАЛОН, JSON.stringify(сейчас, null, 1), 'utf8');
  console.log('\n  Эталон записан: tests/эталон.json — ' + Object.keys(сейчас).length + ' изделий.');
  if (!обновить) console.log('  Эталона не было, поэтому он создан из текущего расчёта.');
  console.log('  Проверьте глазами несколько цифр и закоммитьте файл вместе с index.html.\n');
} else {
  T.head('Себестоимость против эталона');
  const было = JSON.parse(fs.readFileSync(ЭТАЛОН, 'utf8'));
  const имена = [...new Set([...Object.keys(было), ...Object.keys(сейчас)])];
  const сдвиг = [], пропали = [], новые = [];
  for (const n of имена) {
    if (!(n in сейчас)) { пропали.push(n); continue; }
    if (!(n in было)) { новые.push(n); continue; }
    if (Math.abs(было[n] - сейчас[n]) > 0.005) сдвиг.push({ n, было: было[n], стало: сейчас[n] });
  }
  console.log('  изделий в эталоне: ' + Object.keys(было).length + ', сошлось: ' + (имена.length - сдвиг.length - пропали.length - новые.length));
  for (const x of сдвиг) {
    const d = x.стало - x.было;
    console.log('  ' + x.n + ': было ' + x.было.toFixed(2) + ' ₽, стало ' + x.стало.toFixed(2) + ' ₽ (' + (d > 0 ? '+' : '') + d.toFixed(2) + ')');
  }
  T.check(сдвиг.length === 0, 'себестоимость не сдвинулась' +
    (сдвиг.length ? ' — разошлось изделий: ' + сдвиг.length + '. Если правка была намеренной: node tests/test.js --обновить' : ''));
  T.check(пропали.length === 0, 'ни одно изделие не пропало' + (пропали.length ? ' (нет: ' + пропали.join(', ') + ')' : ''));
  T.check(новые.length === 0, 'новых изделий в примере не появилось' + (новые.length ? ' (добавились: ' + новые.join(', ') + ')' : ''));
}

T.head('Цена продажи');
const r0 = S.recipes[0];
const c0 = app.calc(r0).cost;
const p0 = app.priceOf(r0, c0);
T.check(p0 >= c0 * 3, 'цена продажи не ниже себестоимости × 3');
T.check(p0 % 10 === 0, 'округлена вверх до 10 ₽ (получилось ' + p0 + ')');

T.head('Справочно: расхождение с исходным Excel');
console.log('  Это НЕ ошибка: Excel округлял массу воска до десятков, теперь округления нет.');
let близко = 0; const далеко = [];
for (const r of S.recipes) {
  if (r.xl == null) continue;
  const c = app.calc(r, 'lot').cost, d = c - r.xl;
  if (Math.abs(d) <= Math.abs(r.xl) * 0.03) близко++;
  else далеко.push({ n: r.n, наше: +c.toFixed(2), excel: +Number(r.xl).toFixed(2), d: +d.toFixed(2) });
}
console.log('  в пределах 3 % от цифры Excel: ' + близко + ' из 71');
for (const x of далеко.slice(0, 10)) {
  console.log('    ' + x.n + ': у нас ' + x.наше + ' ₽, в Excel ' + x.excel + ' ₽ (' + (x.d > 0 ? '+' : '') + x.d + ')');
}
if (далеко.length > 10) console.log('    …и ещё ' + (далеко.length - 10));

T.done('эталон себестоимости');
