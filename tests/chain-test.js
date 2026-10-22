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
   Воск за вычетом отдушки = 190 / 108 × 100 = 175,9 → 176 г
   Отдушка = 190 − 176 = 14 г. Всё в целых граммах.             */
const свеча = {
  id: 'r-цилиндр', n: 'Свеча «Цилиндр»', c: 'Формовые свечи',
  p: { volWax_A: 200, fragrPct_A: 8 },
  wr: { A: 'ROUND(vol*0.95,0)' },
  l: [
    { r: 1, lb: 'воск', g: 'wax', m: воск.id, q: { type: 'param', key: 'waxNet_A' }, cf: 'mul' },
    { r: 2, lb: 'отдушка', g: 'fragrance', m: отдушка.id, q: { type: 'param', key: 'fragrMass_A' }, cf: 'mul' },
    { r: 3, lb: 'фитиль', g: 'wick', m: фитиль.id, q: { type: 'const', value: 15 }, cf: 'mul' },
  ],
  en: [{ r: 5, rate: 1.7, h: 0.5, kw: 2 }],
  tl: [{ r: 6, lb: 'амортизация формы', m: форма.id }],
  ex: 0,
};
S.recipes.push(свеча);

const d = app.calc(свеча).d;
const waxNet = 176, fragr = 190 - waxNet;   // 190 / 108 × 100 = 175,9 → 176
T.near(d.waxRaw_A, 190, 0.0001, 'масса воска сырая, г (200 × 0,95)');
T.near(d.waxNet_A, waxNet, 0.0001, 'воск за вычетом отдушки, г (190 / 108 × 100 → 176)');
T.near(d.fragrMass_A, fragr, 0.0001, 'отдушка, г');
T.check(Number.isInteger(d.waxNet_A) && Number.isInteger(d.fragrMass_A), 'граммы целые');

const воскР = waxNet * 0.5;
const отдушкаР = fragr * 3;
const фитильР = 15 * 0.3;       // 4,5
const электро = 1.7 * 0.5 * 2;  // 1,7
const аморт = 120;              // сумма из карточки формы
/* Упаковки в составе изделия нет: коробки, ленты и открытки выбираются
   в заказе. Прямые = материалы + энергия + амортизация. */
const прямые = воскР + отдушкаР + фитильР + электро + аморт;
const опр = прямые * 0.10;
const охр = прямые * 0.02;

const { cost, det } = app.calc(свеча);
T.near(det.find(x => x.lb === 'воск').c, воскР, 0.01, 'воск, ₽');
T.near(det.find(x => x.lb === 'отдушка').c, отдушкаР, 0.01, 'отдушка, ₽');
T.near(det.find(x => x.lb === 'фитиль').c, фитильР, 0.01, 'фитиль, ₽');
T.near(det.find(x => x.k === 'e').c, электро, 0.01, 'электроэнергия, ₽ (2 кВт × 0,5 ч × 1,7 ₽)');
T.near(det.find(x => x.k === 't').c, аморт, 0.01, 'амортизация формы — строкой, из карточки предмета, ₽');
T.near(app.calc(свеча).прямые, прямые, 0.01, 'прямые затраты, ₽');
T.near(det.find(x => x.acc === 'opr').c, опр, 0.01, 'общепроизводственные 10 % от прямых, ₽');
T.near(det.find(x => x.acc === 'ohr').c, охр, 0.01, 'общехозяйственные 2 % от прямых, ₽');
T.near(cost, прямые + опр + охр, 0.01, 'СЕБЕСТОИМОСТЬ, ₽');

T.head('Шаг 6. Цена продажи');
T.near(app.priceOf(свеча, cost), Math.ceil(cost * 3 / 10) * 10, 0.01, 'цена продажи, ₽ (×3, вверх до 10 ₽)');
свеча.coef = 4;
T.near(app.priceOf(свеча, cost), Math.ceil(cost * 4 / 10) * 10, 0.01, 'своя наценка изделия ×4 перебивает общую');
delete свеча.coef;

T.head('Шаг 7. Что списывается со склада');
const расход = app.usage(свеча);
T.near(расход[воск.id], waxNet, 0.0001, 'воск, г');
T.check(!(коробка.id in расход), 'коробки в списании изделия нет — упаковка идёт заказом');
T.check(!(форма.id in расход), 'форма в списание НЕ попадает — она только в амортизации');

T.head('Шаг 8. Выпуск партии');
app.makeBatch(свеча, 10);
T.near(app.stockOf(воск), 5000 - waxNet * 10, 0.0001, 'воска осталось, г');
T.near(app.stockOf(фитиль), 1000 - 150, 0.0001, 'фитиля осталось, см');
T.near(app.stockOf(коробка), 50, 0.0001, 'коробки не тронуты — они списываются заказом, шт');
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
T.check(поднос.l.length === 5, 'сразу заведены пять строк — гипс, вода, TiO2, СВВ, краситель');
T.check(поднос.l[0].q.type === 'gypsumMass', 'первая строка считается как масса гипса');
T.check(поднос.l[1].q.type === 'water', 'вторая — вода');
T.check(поднос.l[2].q.type === 'tio2', 'третья — диоксид титана');
T.check(поднос.l[3].q.type === 'svv', 'четвёртая — СВВ');
T.check(поднос.l[4].q.type === 'dye', 'пятая — краситель');

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

T.head('Коэффициенты воды, TiO2, СВВ и красителя — из карточки смеси');
/* Задача владельца (02.10.2026): у каждой смеси свой расход воды, диоксида
   титана, СВВ и красителя — задаётся один раз в карточке материала, а не
   руками в каждом изделии. Строки TiO2/СВВ/краситель были заведены пустыми
   при создании изделия (Шаг 9б) — сейчас в них подставится материал и, раз
   процент в карточке ещё не задан, их масса должна остаться нулевой. */
T.check(поднос.l[2].m == null, 'TiO2 без материала, пока владелец его не выбрал');
T.near(app.calc(поднос).d.tio2, 0, 0.0001, 'TiO2 = 0, пока % не задан в карточке');
T.near(app.calc(поднос).d.svv, 0, 0.0001, 'СВВ = 0, пока % не задан в карточке');
T.near(app.calc(поднос).d.dye, 0, 0.0001, 'краситель = 0, пока % не задан в карточке');

app.document.getElementById('m-n').value = смесь.n;
app.document.getElementById('m-g').value = 'gypsum';
app.document.getElementById('m-u').value = 'г';
app.document.getElementById('m-min').value = '0';
app.document.getElementById('m-coef').value = '1.65';
app.document.getElementById('m-water').value = '20';
app.document.getElementById('m-tio2').value = '3';
app.document.getElementById('m-svv').value = '1';
app.document.getElementById('m-dye').value = '0.5';
app.matSave(смесь.id);
T.near(смесь.x.water, 20, 0.0001, 'свой % воды сохранился');
T.near(смесь.x.tio2, 3, 0.0001, '% диоксида титана сохранился');
T.near(смесь.x.svv, 1, 0.0001, '% СВВ сохранился');
T.near(смесь.x.dye, 0.5, 0.0001, '% красителя сохранился');

const тио2 = мат('gypsum::tio2', 'dye', 'Диоксид титана', 'г', 'кг');
тио2.p = 1;
поднос.l[2].m = тио2.id;
const свв = мат('gypsum::svv', 'dye', 'СВВ', 'г', 'кг');
свв.p = 2;
поднос.l[3].m = свв.id;
const пигмент = мат('gypsum::dye', 'dye', 'Краситель', 'г', 'кг');
пигмент.p = 3;
поднос.l[4].m = пигмент.id;

const рп2 = app.calc(поднос);
/* Сухой пигмент входит В общую массу смеси (формула владельца от 22.10.2026).
   Общая масса 495 г, добавки 3 + 1 + 0,5 = 4,5 % от чистого гипса:
   гипс = 495 / 104,5 × 100 = 473,7 → 474 г; добавки = 495 − 474 = 21 г,
   делятся по процентам: TiO2 21×3/4,5 = 14, СВВ 21×1/4,5 = 4,67 → 5,
   краситель забирает остаток 21 − 14 − 5 = 2. Вода — 20 % от всей смеси.  */
T.near(рп2.d.mix, 495, 0.0001, 'общая масса сухой смеси, г (300 мл × 1,65)');
T.near(рп2.d.gypsum, 474, 0.0001, 'чистый гипс = общая масса / 104,5 × 100, г');
T.check(рп2.d.gypsum + рп2.d.tio2 + рп2.d.svv + рп2.d.dye === 495, 'гипс + добавки в сумме дают ровно общую массу');
T.near(рп2.d.water, 99, 0.0001, 'вода = 20 % от всей массы смеси (из карточки), г');
T.near(рп2.d.tio2, 14, 0.0001, 'TiO2 — своя доля добавок, г');
T.near(рп2.d.svv, 5, 0.0001, 'СВВ = 1 % от гипса, округлено до целых граммов');
T.near(рп2.d.dye, 2, 0.0001, 'краситель = 0,5 % от гипса, округлено до целых граммов');
T.near(рп2.det.find(x => x.lb === 'диоксид титана').c, 14 * 1, 0.05, 'TiO2 в деньгах — списывается по цене своего материала, ₽');
T.near(рп2.det.find(x => x.lb === 'СВВ').c, 5 * 2, 0.05, 'СВВ в деньгах, ₽');
T.near(рп2.det.find(x => x.lb === 'краситель').c, 2 * 3, 0.05, 'краситель в деньгах, ₽');
T.near(рп2.det.find(x => x.lb === 'вода').c, 0, 0.0001, 'вода по-прежнему бесплатная');

/* У другой смеси, где проценты не заданы, та же строка TiO2 (без материала)
   остаётся нулевой — коэффициенты не текут из одного изделия в другое. */
/* Три равные добавки по 1 %: 495 / 103 × 100 = 480,6 → 481; добавок 14 г,
   каждой по 4,67 → 5, 5 и остаток 4 — сумма сходится ровно, без лишнего грамма. */
смесь.x.water = 25; смесь.x.tio2 = 1; смесь.x.svv = 1; смесь.x.dye = 1;
const рп4 = app.calc(поднос);
T.check(рп4.d.gypsum === 481 && рп4.d.tio2 === 5 && рп4.d.svv === 5 && рп4.d.dye === 4, 'три добавки: 481 + 5 + 5 + 4, последняя забирает остаток');
T.check(рп4.d.gypsum + рп4.d.tio2 + рп4.d.svv + рп4.d.dye === 495, 'и в сумме ровно 495 г');
/* Пример владельца из файла: форма 100 мл, коэффициент 1,65, пигмент 5 %. */
смесь.x.water = 25; смесь.x.tio2 = 5; смесь.x.svv = 0; смесь.x.dye = 0;
поднос.p.volGypsum_A = 100;
const рп3 = app.calc(поднос);
T.near(рп3.d.mix, 165, 0.0001, 'пример владельца: общая масса 165 г');
T.near(рп3.d.gypsum, 157, 0.0001, 'гипс 157 г');
T.near(рп3.d.tio2, 8, 0.0001, 'пигмент 8 г');
T.near(рп3.d.water, 41, 0.0001, 'вода 41 г');
поднос.p.volGypsum_A = 300;
смесь.x.water = null; смесь.x.tio2 = 0; смесь.x.svv = 0; смесь.x.dye = 0;
смесь.x.water = undefined;
T.near(app.calc(поднос).d.water, 124, 0.0001, 'без своего % вода возвращается к 25 % по умолчанию');

T.head('Новый гипсовый материал — коэффициенты сразу при создании');
/* Задача владельца (06.10.2026): видов гипса несколько, и все коэффициенты
   (смесь, вода, TiO2, СВВ, краситель) нужно проставлять сразу в форме
   «Новый материал», а не потом в карточке. */
const экранНовогоМатериала = app.newMatView();
T.check(/id="n-coef"/.test(экранНовогоМатериала) && /id="n-water"/.test(экранНовогоМатериала) && /id="n-tio2"/.test(экранНовогоМатериала)
  && /id="n-svv"/.test(экранНовогоМатериала) && /id="n-dye"/.test(экранНовогоМатериала), 'в форме нового материала есть все пять полей');
const gd = id => app.document.getElementById(id);
gd('n-n').value = 'Фрипласт тест'; gd('n-g').value = 'gypsum'; gd('n-u').value = 'г'; gd('n-bu').value = 'г';
gd('n-pq').value = ''; gd('n-pp').value = ''; gd('n-s').value = ''; gd('n-p').value = '';
gd('n-coef').value = '1.8'; gd('n-water').value = '22'; gd('n-tio2').value = '4';
gd('n-svv').value = '0.8'; gd('n-dye').value = '0.3';
app.createMat();
const фрип = S.materials.find(m => m.n === 'Фрипласт тест');
T.check(!!фрип, 'гипсовый материал создан');
T.near(фрип.x.coef, 1.8, 0.0001, 'коэффициент смеси записан при создании');
T.near(фрип.x.water, 22, 0.0001, '% воды записан при создании');
T.near(фрип.x.tio2, 4, 0.0001, '% TiO2 записан при создании');
T.near(фрип.x.svv, 0.8, 0.0001, '% СВВ записан при создании');
T.near(фрип.x.dye, 0.3, 0.0001, '% красителя записан при создании');

gd('n-n').value = 'Воск тест'; gd('n-g').value = 'wax';
app.createMat();
const воскТест = S.materials.find(m => m.n === 'Воск тест');
T.check(Object.keys(воскТест.x).length === 0, 'у негипсового материала коэффициенты не создаются');

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
{
  T.head('Список изделий — по категориям, внутри по алфавиту');
  const сохр = app.S.recipes;
  app.S.recipes = [{id:901,n:'Б',c:'Я-кат',l:[]},{id:902,n:'Б',c:'А-кат',l:[]},{id:903,n:'А',c:'Я-кат',l:[]},{id:904,n:'А',c:'А-кат',l:[]}];
  app.fProd = 'все'; app.renderProd();
  const html = app.document.getElementById('list-prod').innerHTML;
  const поз = id => html.indexOf("openRecipe('" + id + "')");
  const порядок = [904,902,903,901].map(поз);
  T.check(порядок.every(x => x >= 0) && порядок[0] < порядок[1] && порядок[1] < порядок[2] && порядок[2] < порядок[3], 'сначала категория А, потом Я; внутри — по алфавиту');
  app.S.recipes = сохр;
}
экран('Склад', app.renderStock);
экран('Журнал движений', app.renderLog);
экран('Ещё', app.renderMore);
экран('Карточка изделия', app.recipeView);
экран('Строка состава', () => app.lineView(1));
экран('Карточка материала', () => app.matView(воск.id));
экран('Карточка партии', () => app.lotView(воск.id, app.sortedLots(воск)[0].id));
экран('Новый материал', app.newMatView);
экран('Закупка', () => { app.buyRows = [{ id: воск.id, q: '', s: '', u: null }]; return app.buyView(); });
экран('Ведомость по средневзвешенной', app.avgBody);
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

T.head('Шаг 10б. Калькулятор — расчёт без списания со склада');
{
  const склад0 = JSON.stringify(S.materials.map(m => [m.id, m.s, (m.lots || []).map(l => l.q)]));
  const журнал0 = (S.log || []).length;
  const изд0 = S.recipes.length;
  app.closeAll();
  app.newCalc();
  T.check(app.stack.length === 1, 'экран нового расчёта открылся');
  const экр = app.newRecipeView();
  T.check(экр.includes('Новый расчёт') && экр.includes('Создать расчёт'), 'на экране нового расчёта свои надписи');
  gd('r-n').value = 'Расчёт для проверки';
  gd('r-c').value = 'Декор';
  app.setNewKind('wax');
  app.createRecipe();
  const р = (S.calcs || []).find(x => x.n === 'Расчёт для проверки');
  T.check(!!р, 'расчёт создан и лежит в S.calcs');
  T.check(S.recipes.length === изд0, 'в список изделий расчёт не попал');
  T.check(!S.recipes.some(x => x.n === 'Расчёт для проверки'), 'среди изделий расчёта нет');
  T.check(app.__toasts.includes('Расчёт создан'), 'после создания показано подтверждение');
  T.check(app.Dcalc === true, 'карточка открыта как расчёт');

  // состав из склада, цена и наценка считаются как у изделия
  app.D.l.push({ r: 1, lb: 'воск', g: 'wax', m: воск.id, q: { type: 'const', value: 100 }, fp: 0, cf: 'mul' });
  app.D.coef = 3;
  const рс = app.calc(app.D);
  T.check(рс.cost > 0, 'себестоимость расчёта считается по ценам склада: ' + рс.cost.toFixed(2));
  T.near(app.priceOf(app.D, рс.cost), Math.ceil(рс.cost * 3 / 10) * 10, 10, 'цена продажи — себестоимость × наценка с округлением');
  T.check(app.recipeView().includes('Сделать изделием'), 'в карточке расчёта есть «Сделать изделием»');
  T.check(app.recipeView().includes('Удалить расчёт'), 'и «Удалить расчёт»');
  T.check(!app.recipeView().includes('Вернуть исходный состав'), 'исходного состава из Excel у расчёта нет');
  T.check(app.dirty(), 'правки не сохранены — карточка это видит');
  app.saveDraft();
  T.check(!app.dirty(), 'после «Сохранить» правок нет');
  T.check(app.calcs().find(x => x.id === р.id).l.length === 1, 'состав расчёта сохранился в S.calcs');
  T.check(S.recipes.every(x => x.l.length !== 1 || x.n !== 'Расчёт для проверки'), 'в изделия правки не просочились');

  // сохранение и перезагрузка
  app.save(true);
  const после = JSON.parse(app.localStorage.getItem('masya_cost_v1'));
  T.check((после.calcs || []).some(x => x.n === 'Расчёт для проверки'), 'расчёт сохраняется вместе с базой');

  // экран «Калькулятор»
  app.closeAll();
  app.renderCalc();
  const списокК = gd('list-calc').innerHTML;
  T.check(списокК.includes('Расчёт для проверки') && списокК.includes('₽'), 'расчёт виден в списке «Калькулятора» со стоимостью');
  app.openRecipe(р.id, true);
  T.check(app.D.n === 'Расчёт для проверки' && app.Dcalc, 'из списка расчёт открывается');

  // копия
  app.dupRecipe();
  T.check(app.calcs().length === 2 && S.recipes.length === изд0, 'копия расчёта создана в «Калькуляторе», изделий не прибавилось');
  app.delRecipe();
  T.check(app.calcs().length === 1, 'копия удалена (с вопросом)');

  // сделать изделием
  app.openRecipe(р.id, true);
  app.calcToProduct();
  const изд = S.recipes.find(x => x.n === 'Расчёт для проверки');
  T.check(!!изд && S.recipes.length === изд0 + 1, 'из расчёта получилось изделие');
  T.check(изд.id !== р.id && изд.l.length === 1 && изд.l[0].m === воск.id, 'в изделии тот же состав, новый номер');
  T.check(app.calcs().some(x => x.id === р.id), 'сам расчёт остался в «Калькуляторе»');
  T.check(app.Dcalc === false, 'открыто как обычное изделие');
  T.check(app.__toasts.includes('Изделие создано'), 'показано подтверждение «Изделие создано»');

  // склад и журнал не тронуты
  const склад1 = JSON.stringify(S.materials.map(m => [m.id, m.s, (m.lots || []).map(l => l.q)]));
  T.check(склад0 === склад1, 'остатки на складе не изменились');
  T.check((S.log || []).length === журнал0, 'в журнале движений ничего не появилось');

  // удаление расчёта
  let спросили = 0; const был = app.confirm; app.confirm = () => { спросили++; return false; };
  app.openRecipe(р.id, true); app.delRecipe();
  T.check(спросили === 1 && app.calcs().some(x => x.id === р.id), 'на вопрос «Удалить?» ответили «нет» — расчёт на месте');
  app.confirm = () => { спросили++; return true; };
  app.delRecipe();
  T.check(!app.calcs().some(x => x.id === р.id), 'ответили «да» — расчёт удалён');
  T.check(S.recipes.some(x => x.n === 'Расчёт для проверки'), 'созданное из него изделие осталось');
  app.confirm = был;
  экран('Калькулятор', app.renderCalc);
  app.closeAll();
}

T.head('Шаг 10в. Заготовка в составе изделия — «из состава» и «со склада»');
{
  const гипсЗ = мат('gypsum::заг', 'gypsum', 'Гипс заг', 'г', 'кг');
  const кашпо = мат('box::кашпо', 'box', 'Кашпо', 'шт', 'шт');
  app.buyRows = [{ id: гипсЗ.id, q: '10', s: '1000', u: 'кг' }, { id: кашпо.id, q: '20', s: '1000', u: 'шт' }];
  app.doBuy();
  const пуст = (id, n, l) => ({ id, n, c: 'Формовые свечи', p: {}, l, en: [], tl: [], mk: [], ex: 0 });
  const заг = пуст('r-заг', 'Заготовка чаша', [{ r: 1, lb: 'гипс', g: 'gypsum', m: гипсЗ.id, q: { type: 'const', value: 200 }, cf: 'mul' }]);
  const итог = пуст('r-итог', 'Свеча в чаше', [
    { r: 1, lb: 'Заготовка чаша', g: 'rec', m: 'rec::r-заг', q: { type: 'const', value: 2 }, cf: 'mul' },
    { r: 2, lb: 'кашпо', g: 'box', m: кашпо.id, q: { type: 'const', value: 1 }, cf: 'mul' }]);
  S.recipes.push(заг, итог);
  const k = (app.accPct('opr') + app.accPct('ohr')) / 100;
  const цЗаг = app.calc(заг).cost;
  T.near(цЗаг, 20 * (1 + k), 0.001, 'заготовка сама: 200 г × 0,1 ₽ плюс ОПР и ОХР');
  const цИтог = app.calc(итог).cost;
  T.near(цИтог, 40 * (1 + k) + 50, 0.001, 'итоговое изделие: заготовки ×2 (прямые затраты) + кашпо; ОПР/ОХР начислены один раз');
  const u = app.usage(итог);
  T.near(u[гипсЗ.id], 400, 0.0001, 'расход по составу: материалы 2 заготовок — 400 г гипса');
  T.near(u[кашпо.id], 1, 0.0001, 'и кашпо — 1 шт');
  T.check(!Object.keys(u).some(x => x.startsWith('rec::')), 'в расходе нет «виртуальных» позиций — только настоящие материалы');
  T.check(app.canMake(итог).n === 20, 'хватит на 20 штук (упирается в кашпо)');

  // списание одним действием
  T.check(app.shipCheck([{ rid: итог.id, q: 3 }]).ok, 'проверка перед списанием проходит');
  const запись = app.shipDo([{ rid: итог.id, q: 3 }], 'Заказ с заготовками');
  T.near(app.stockOf(гипсЗ), 10000 - 1200, 0.001, 'списан гипс заготовок: 3 × 2 × 200 г');
  T.near(app.stockOf(кашпо), 17, 0.001, 'и кашпо: 3 шт');
  T.near(запись.cost, цИтог * 3, 0.01, 'себестоимость заказа — 3 итоговых изделия');
  T.check(!S.materials.some(m => m.id === 'fg::r-заг'), 'заготовка на склад не приходовалась');

  // режим «со склада»
  app.D = JSON.parse(JSON.stringify(итог)); app.Did = итог.id; app.Dcalc = false;
  app.setRecMode(1, 'fg');
  T.check(app.D.l[0].m === 'rec::r-заг', 'заготовок на складе нет — «со склада» не включается');
  app.shipDo([{ rid: заг.id, q: 5 }], 'Заготовки для своих', null, true);
  const fgm = S.materials.find(m => m.id === 'fg::r-заг');
  T.check(!!fgm && app.stockOf(fgm) === 5, 'после заказа «для своих» заготовки на складе: 5 шт');
  T.check(app.recLineView(1, app.D.l[0]).includes('Со склада') && !/disabled/.test(app.recLineView(1, app.D.l[0]).split('Со склада')[0].split('<button').pop()), 'кнопка «Со склада» стала доступной');
  app.setRecMode(1, 'fg');
  T.check(app.D.l[0].m === 'fg::r-заг' && app.D.l[0].g === fgm.g, 'переключили на «со склада»');
  const цФг = app.calc(app.D);
  T.check(цФг.det[0].mid === 'fg::r-заг' && цФг.det[0].up > 0, 'цена заготовки — по цене партии на складе');
  const uФг = app.usage(app.D);
  T.check(uФг['fg::r-заг'] === 2 && !(гипсЗ.id in uФг), 'расход: 2 готовые заготовки, гипс не списывается');
  app.setRecMode(1, 'rec');
  T.check(app.D.l[0].m === 'rec::r-заг' && app.D.l[0].g === 'rec', 'и обратно «из состава»');
  Object.assign(итог, JSON.parse(JSON.stringify(app.D)));
  app.setRecMode(1, 'fg'); Object.assign(итог, JSON.parse(JSON.stringify(app.D)));
  const гипсДо = app.stockOf(гипсЗ);
  app.shipDo([{ rid: итог.id, q: 2 }], 'Со склада');
  T.check(app.stockOf(fgm) === 1, 'со склада ушли 4 заготовки (2 × 2), осталась 1');
  T.near(app.stockOf(гипсЗ), гипсДо, 0.001, 'гипс при этом не тронут');

  // выбор в списке материалов изделия
  app.Did = 'r-итог'; app.Dcalc = false;
  app.pickState = { cb: () => {}, group: 'rec', q: '', multi: true, sel: [], opt: { groups: ['gypsum', 'box'], withRecs: true } };
  const спис = app.pickRender('Материалы изделия');
  T.check(спис.includes('Изделия'), 'в выборе материалов есть раздел «Изделия»');
  T.check(спис.includes('Заготовка чаша'), 'заготовка в списке есть');
  T.check(!спис.includes('Свеча в чаше'), 'само изделие в своём списке не показывается');
  app.pickState.group = 'все';
  T.check(!app.pickRender('Материалы изделия').includes('Заготовка чаша'), 'в общем списке материалов заготовок нет — только в разделе «Изделия»');
  app.pickState = null;

  // добавление строкой
  app.D = пуст('r-н', 'Новое с заготовкой', []); app.Did = null;
  app.addLine('mat');
  app.pickState.sel = ['rec::r-заг'];
  app.pickDone();
  T.check(app.D.l.length === 1 && app.D.l[0].m === 'fg::r-заг', 'заготовка есть на складе — строка сразу «со склада»');
  S.materials.find(m => m.id === 'fg::r-заг').lots.forEach(l => { l.q = 0 }); app.syncStock(fgm);
  app.D = пуст('r-н', 'Новое с заготовкой', []);
  app.addLine('mat'); app.pickState.sel = ['rec::r-заг']; app.pickDone();
  T.check(app.D.l[0].m === 'rec::r-заг', 'на складе нет — строка «из состава»');
  app.setRecMode(1, 'fg');
  T.check(app.D.l[0].m === 'rec::r-заг', 'заготовки израсходованы — «со склада» не включается (позиция на складе есть, остаток 0)');
  T.check(app.recipeView().length > 0, 'карточка изделия с заготовкой строится');

  // калькулятор
  app.D = JSON.parse(JSON.stringify(итог)); app.Did = 'r-итог'; app.Dcalc = false;
  app.D.id = 'c-итог'; app.calcs().push(app.D); app.Did = 'c-итог'; app.Dcalc = true;
  T.check(app.recipeView().includes('Сделать изделием'), 'в «Калькуляторе» расчёт с заготовкой открывается');
  app.calcs().pop(); app.Dcalc = false;

  // изделия, ссылающиеся друг на друга, не зависают
  const A = пуст('r-A', 'Круг А', [{ r: 1, lb: 'б', g: 'rec', m: 'rec::r-B', q: { type: 'const', value: 1 }, cf: 'mul' }]);
  const B = пуст('r-B', 'Круг Б', [{ r: 1, lb: 'а', g: 'rec', m: 'rec::r-A', q: { type: 'const', value: 1 }, cf: 'mul' }]);
  S.recipes.push(A, B);
  let зациклилось = false; try { app.calc(A); app.usage(A); } catch (e) { зациклилось = true; }
  T.check(!зациклилось, 'изделия, входящие друг в друга, не зацикливают расчёт');
  S.recipes = S.recipes.filter(x => x.id !== 'r-A' && x.id !== 'r-B');

  // удаление заготовки, которая используется
  let текст = ''; const был2 = app.confirm; app.confirm = t => { текст = t; return false; };
  app.D = JSON.parse(JSON.stringify(заг)); app.Did = заг.id; app.Dcalc = false;
  app.delRecipe();
  T.check(текст.includes('Свеча в чаше'), 'при удалении заготовки предупреждение называет изделие, где она используется');
  T.check(S.recipes.some(x => x.id === 'r-заг'), 'на «нет» заготовка осталась');
  app.confirm = был2;
  app.closeAll();
}

T.head('Копия материала в карточке');
{
  const оригинал = S.materials.find(m => m.id === смесь.id);
  оригинал.x = { coef: 1.7, water: 22, tio2: 4, svv: 1, dye: 0.5 };
  оригинал.lots = [app.newLot(500, 0.1, {})]; app.syncStock(оригинал);
  const было = S.materials.length, лотов = (оригинал.lots || []).length;
  app.stack = [() => '']; 
  app.dupMat(оригинал.id);
  const к = S.materials.find(m => m.n === оригинал.n + ' (копия)');
  T.check(!!к && S.materials.length === было + 1, 'копия материала появилась');
  T.check(к.id !== оригинал.id, 'у копии свой номер');
  T.check(к.g === оригинал.g && к.u === оригинал.u && к.bu === оригинал.bu, 'раздел и единицы те же');
  T.check(JSON.stringify(к.x) === JSON.stringify(оригинал.x), 'коэффициенты смеси скопированы');
  T.check(к.x !== оригинал.x, 'и это отдельная копия — правка копии не трогает оригинал');
  T.check((к.lots || []).length === 0 && !(к.s > 0), 'остатков и закупок у копии нет');
  T.check((оригинал.lots || []).length === лотов, 'у оригинала закупки на месте');
  T.check(app.__toasts.includes('Копия создана'), 'показано подтверждение «Копия создана»');
  T.check(app.matView(к.id).includes('Сделать копию'), 'в карточке материала есть кнопка «Сделать копию»');
  app.dupMat(к.id);
  T.check(S.materials.some(m => m.n === оригинал.n + ' (копия) (копия)'), 'копию копии тоже можно сделать');
  S.materials = S.materials.filter(m => !/\(копия\)/.test(m.n));
}

T.head('Шаг 11. Сохранение и загрузка');
app.save(true);
const копия = JSON.parse(app.localStorage.getItem('masya_cost_v1'));
T.check(копия.materials.length === S.materials.length, 'состояние сохранилось: материалов ' + S.materials.length);
T.check(копия.recipes.length === S.recipes.length, 'состояние сохранилось: изделий ' + S.recipes.length);
T.check(копия.log.length > 0, 'журнал сохранился');

T.done('вся цепочка');
