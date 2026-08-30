/* ============================================================
   chain-test.js — вся цепочка на пустом приложении

   Проходит путь мастера с нуля, как если бы приложение только что
   открыли: завести материалы → закупить → создать категорию →
   собрать изделие → добавить электроэнергию, амортизацию и наценки →
   выпустить партию → увидеть списание и ведомость.

   Плюс проверка, что все экраны строятся без ошибок.

   Запуск:  node tests/chain-test.js
   ============================================================ */
const T = require('./harness.js');

const app = T.loadApp();
const S = T.withEmpty(app);

T.head('Шаг 1. Пустое приложение');
T.check(S.materials.length === 0, 'материалов нет');
T.check(S.recipes.length === 0, 'изделий нет');
T.check(S.settings.coef === 3, 'коэффициент цены по умолчанию ×3');
T.check(S.settings.round === 10, 'округление цены до 10 ₽');
T.check(app.costBase() === 'lot', 'себестоимость по умолчанию считается по партии');

T.head('Шаг 2. Завели материалы');
const мат = (id, g, n, u, bu) => {
  const m = { id, g, n, u, bu: bu || u, p: 0, s: 0, min: 0, x: {}, lots: [] };
  S.materials.push(m);
  return m;
};
const воск = мат('wax::соевый', 'wax', 'Воск соевый', 'г', 'кг');
const фитиль = мат('wick::хб', 'wick', 'Фитиль хлопковый', 'см', 'м');
const отдушка = мат('fragrance::ваниль', 'fragrance', 'Отдушка ваниль', 'г', 'г');
const коробка = мат('box::крафт', 'box', 'Коробка крафт', 'шт', 'шт');
const форма = мат('mold_wax::цилиндр', 'mold_wax', 'Форма цилиндр', 'исп.', 'шт');
T.check(S.materials.length === 5, 'материалов стало 5');

T.head('Шаг 3. Закупка');
app.buyRows = [
  { id: воск.id, q: '5', s: '2500', u: 'кг' },   // 5000 г по 0,50 ₽
  { id: фитиль.id, q: '10', s: '300', u: 'м' },  // 1000 см по 0,30 ₽
  { id: отдушка.id, q: '500', s: '1500', u: 'г' },
  { id: коробка.id, q: '50', s: '2000', u: 'шт' },
];
app.doBuy();
T.near(app.stockOf(воск), 5000, 0.0001, 'воска на складе, г');
T.near(app.matPrice(воск), 0.5, 0.0001, 'цена воска, ₽/г');
T.near(app.stockOf(фитиль), 1000, 0.0001, 'фитиля на складе, см');
T.near(app.matPrice(фитиль), 0.3, 0.0001, 'цена фитиля, ₽/см');
T.near(app.matPrice(коробка), 40, 0.0001, 'цена коробки, ₽/шт');
T.check(S.log.filter(e => e.t === 'buy').length === 4, 'в журнале 4 записи о закупке');

// форму купили отдельно: она идёт в амортизацию, а не в списание
форма.p = 120;

T.head('Шаг 4. Категория');
S.cats.push('Формовые свечи');
T.check(app.allCats().includes('Формовые свечи'), 'категория появилась в списке');

T.head('Шаг 5. Изделие');
/* Свеча в форме 200 мл, отдушка 8 %.
   Масса воска сырая = 200 × 0,95 = 190 г
   Воск за вычетом отдушки = 190 / 108 × 100 = 175,93 г
   Отдушка = 190 − 175,93 = 14,07 г. Округления нет нигде.      */
const свеча = {
  id: 'r-цилиндр', n: 'Свеча «Цилиндр»', c: 'Формовые свечи',
  p: { volWax_A: 200, fragrPct_A: 8 },
  wr: { A: 'ROUND(vol*0.95,0)' },
  l: [
    { r: 1, lb: 'воск', g: 'wax', m: воск.id, q: { type: 'param', key: 'waxNet_A' }, cf: 'mul' },
    { r: 2, lb: 'отдушка', g: 'fragrance', m: отдушка.id, q: { type: 'param', key: 'fragrMass_A' }, cf: 'mul' },
    { r: 3, lb: 'фитиль', g: 'wick', m: фитиль.id, q: { type: 'const', value: 15 }, cf: 'mul' },
    { r: 4, lb: 'упаковка', g: 'box', m: коробка.id, q: { type: 'const', value: 1 }, cf: 'mul' },
  ],
  en: [{ r: 5, rate: 1.7, h: 0.5, kw: 2 }],
  tl: [{ r: 6, lb: 'амортизация формы', m: форма.id }],
  mk: [{ r: 7, lb: 'Расходники', pct: 0.1, k: 'all' }],
  ex: 0,
};
S.recipes.push(свеча);

const d = app.calc(свеча).d;
const waxNet = 190 / 108 * 100, fragr = 190 - waxNet;
T.near(d.waxRaw_A, 190, 0.0001, 'масса воска сырая, г (200 × 0,95, без округления)');
T.near(d.waxNet_A, waxNet, 0.0001, 'воск за вычетом отдушки, г (190 / 108 × 100)');
T.near(d.fragrMass_A, fragr, 0.0001, 'отдушка, г');

const воскР = waxNet * 0.5;
const отдушкаР = fragr * 3;
const фитильР = 15 * 0.3;       // 4,5
const коробкаР = 40;
const электро = 1.7 * 0.5 * 2;  // 1,7
const аморт = 120;              // сумма из карточки формы
const база = воскР + отдушкаР + фитильР + коробкаР + электро + аморт;
const расходники = база * 0.1;

const { cost, det } = app.calc(свеча);
T.near(det.find(x => x.lb === 'воск').c, воскР, 0.01, 'воск, ₽');
T.near(det.find(x => x.lb === 'отдушка').c, отдушкаР, 0.01, 'отдушка, ₽');
T.near(det.find(x => x.lb === 'фитиль').c, фитильР, 0.01, 'фитиль, ₽');
T.near(det.find(x => x.lb === 'упаковка').c, коробкаР, 0.01, 'коробка, ₽');
T.near(det.find(x => x.k === 'e').c, электро, 0.01, 'электроэнергия, ₽ (2 кВт × 0,5 ч × 1,7 ₽)');
T.near(det.find(x => x.k === 't').c, аморт, 0.01, 'амортизация формы — строкой, из карточки предмета, ₽');
T.near(det.find(x => x.k === 'k').c, расходники, 0.01, 'расходники 10 % от всего выше, ₽');
T.near(cost, база + расходники, 0.01, 'СЕБЕСТОИМОСТЬ, ₽');

T.head('Шаг 6. Цена продажи');
T.near(app.priceOf(свеча, cost), Math.ceil(cost * 3 / 10) * 10, 0.01, 'цена продажи, ₽ (×3, вверх до 10 ₽)');
свеча.coef = 4;
T.near(app.priceOf(свеча, cost), Math.ceil(cost * 4 / 10) * 10, 0.01, 'своя наценка изделия ×4 перебивает общую');
delete свеча.coef;

T.head('Шаг 7. Что списывается со склада');
const расход = app.usage(свеча);
T.near(расход[воск.id], waxNet, 0.0001, 'воск, г');
T.near(расход[коробка.id], 1, 0.0001, 'коробка, шт');
T.check(!(форма.id in расход), 'форма в списание НЕ попадает — она только в амортизации');

T.head('Шаг 8. Выпуск партии');
app.document.getElementById('mk-rec').value = свеча.id;
app.document.getElementById('mk-qty').value = '10';
app.doMake();
T.near(app.stockOf(воск), 5000 - waxNet * 10, 0.0001, 'воска осталось, г');
T.near(app.stockOf(фитиль), 1000 - 150, 0.0001, 'фитиля осталось, см');
T.near(app.stockOf(коробка), 40, 0.0001, 'коробок осталось, шт');
T.near(форма.p, 120, 0.0001, 'форма со склада не списана');
const выпуск = S.log.find(e => e.t === 'make');
T.near(выпуск.cost, cost * 10, 0.05, 'себестоимость выпуска зафиксирована в журнале, ₽');
T.check(выпуск.base === 'lot', 'в журнале записано, по какой базе считали');

T.head('Шаг 9. Ведомость по средневзвешенной');
const строка = app.ledgerAt(воск, app.curYM());
T.check(!!строка, 'строка за текущий месяц есть');
T.near(строка.iq, 5000, 0.0001, 'закуплено воска за месяц, г');
T.near(строка.wq, waxNet * 10, 0.001, 'списано воска за месяц, г');
T.near(строка.avg, 0.5, 0.0001, 'средняя цена воска за месяц, ₽/г');
T.near(строка.cq, 5000 - waxNet * 10, 0.001, 'остаток на конец месяца, г');

T.head('Шаг 9б. Новое изделие — тип задаёт параметры');
/* Раньше любое новое изделие получало восковые параметры, и у гипсового
   подноса просили заполнить объём формы для воска, отдушку и фитиль. */
S.cats.push('Декор');
app.document.getElementById('r-n').value = 'Овальный поднос из гипса';
app.document.getElementById('r-c').value = 'Декор';
app.setNewKind('gyps');
app.createRecipe();
const поднос = S.recipes.find(r => r.n === 'Овальный поднос из гипса');
T.check(!!поднос, 'гипсовое изделие создано');
T.check(!('volWax_A' in поднос.p), 'объёма формы для воска у гипсового изделия нет');
T.check(!('fragrPct_A' in поднос.p), 'отдушки нет');
T.check(!('wickLen_A' in поднос.p), 'длины фитиля нет');
T.check('volGypsum_A' in поднос.p, 'зато есть объём формы для гипса');
T.check(!поднос.wr, 'формулы усадки воска нет');
T.check(поднос.l.length === 2, 'сразу заведены две строки — гипс и вода');
T.check(поднос.l[0].q.type === 'gypsumMass', 'первая строка считается как масса гипса');
T.check(поднос.l[1].q.type === 'water', 'вторая — вода');

const смесь = мат('gypsum::скульптор', 'gypsum', 'СКУЛЬПТОР', 'г', 'кг');
смесь.p = 0.05; смесь.x = { coef: 1.65 };
поднос.l[0].m = смесь.id; поднос.l[1].m = смесь.id;
поднос.p.volGypsum_A = 300;
const рп = app.calc(поднос);
T.near(рп.d.gypsum, 495, 0.0001, 'масса гипса = 300 мл × 1,65, г');
T.near(рп.d.water, 124, 0.0001, 'вода = 25 % от гипса, г');
T.near(рп.det.find(x => x.lb === 'гипс').c, 24.75, 0.01, 'гипс в деньгах, ₽');
T.near(рп.det.find(x => x.lb === 'вода').c, 0, 0.0001, 'вода бесплатная');

app.document.getElementById('r-n').value = 'Свеча тестовая 2';
app.setNewKind('wax');
app.createRecipe();
const свеча2 = S.recipes.find(r => r.n === 'Свеча тестовая 2');
T.check('volWax_A' in свеча2.p && 'fragrPct_A' in свеча2.p, 'у воскового изделия восковые параметры на месте');
T.check(!!свеча2.wr, 'и формула усадки воска');

app.document.getElementById('r-n').value = 'Набор';
app.setNewKind('other');
app.createRecipe();
const набор = S.recipes.find(r => r.n === 'Набор');
T.check(Object.keys(набор.p).length === 0, 'у прочего изделия параметров расчёта нет');
T.check(набор.l.length === 0, 'и пустой состав');

T.head('Коэффициент смеси правится в карточке материала');
T.check(/Коэффициент смеси/.test(app.matView(смесь.id)), 'поле есть у материалов из раздела гипса');
T.check(!/Коэффициент смеси/.test(app.matView(воск.id)), 'у воска такого поля нет');
app.document.getElementById('m-n').value = смесь.n;
app.document.getElementById('m-g').value = 'gypsum';
app.document.getElementById('m-u').value = 'г';
app.document.getElementById('m-min').value = '0';
app.document.getElementById('m-coef').value = '1.95';
app.matSave(смесь.id);
T.near(смесь.x.coef, 1.95, 0.0001, 'коэффициент сохранился (акрил)');
T.near(app.calc(поднос).d.gypsum, 300 * 1.95, 0.0001, 'масса гипса пересчиталась, г');
смесь.x.coef = 1.65;

T.head('Шаг 10. Все экраны строятся');
const экран = (имя, fn) => {
  try {
    const html = fn();
    T.check(typeof html === 'string' ? html.length > 0 : true, имя);
  } catch (e) {
    T.bad(имя + ' — упал: ' + e.message);
  }
};
app.D = свеча; app.Did = свеча.id;
экран('Изделия', app.renderProd);
экран('Склад', app.renderStock);
экран('Выпуск', app.renderMake);
экран('Ещё', app.renderMore);
экран('Карточка изделия', app.recipeView);
экран('Строка состава', () => app.lineView(1));
экран('Карточка материала', () => app.matView(воск.id));
экран('Карточка партии', () => app.lotView(воск.id, app.sortedLots(воск)[0].id));
экран('Новый материал', app.newMatView);
экран('Закупка', () => { app.buyRows = [{ id: воск.id, q: '', s: '', u: null }]; return app.buyView(); });
экран('Ведомость по средневзвешенной', app.avgView);
экран('Разделы справочника', app.groupsView);
экран('Категории', app.catsView);
экран('Новое изделие', app.newRecipeView);
экран('Новое изделие — гипсовое', () => { app.setNewKind('gyps'); return app.newRecipeView(); });
экран('Карточка гипсового изделия', () => { app.D = поднос; app.Did = поднос.id; const h = app.recipeView(); app.D = свеча; app.Did = свеча.id; return h; });
экран('Выбор нескольких позиций', () => {
  app.pickMany('Материалы', 'все', () => {});
  app.pickToggle(воск.id); app.pickToggle(коробка.id);
  return app.pickRender('Материалы');
});

T.head('Шаг 11. Сохранение и загрузка');
app.save(true);
const копия = JSON.parse(app.localStorage.getItem('masya_cost_v1'));
T.check(копия.materials.length === S.materials.length, 'состояние сохранилось: материалов ' + S.materials.length);
T.check(копия.recipes.length === S.recipes.length, 'состояние сохранилось: изделий ' + S.recipes.length);
T.check(копия.log.length > 0, 'журнал сохранился');

T.done('вся цепочка');
