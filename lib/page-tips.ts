'use client';
import { supabase } from './supabase';

// Page tips: a short card shown the first time an account opens each main
// page — what the page is for and how to use it well. Rendered by
// components/PageTip.tsx, which each page puts in its header (it's also the
// "?" button that reopens the tip).
//
// Seen ids + the on/off switch are per ACCOUNT (profiles.seen_tips /
// profiles.tips_enabled, shared with the app), cached locally so a page can
// decide instantly. The local keys start with lexivo_ so clearUserData wipes
// them on sign-out; signed-out visitors just use the local copy.
//
// Mirrored in the app: lib/data/page_tips.dart. Keep the ids and copy in sync.
const SEEN_KEY = 'lexivo_seen_tips';
const ENABLED_KEY = 'lexivo_tips_enabled';

type Lang = 'en' | 'uz' | 'ru';
type TipCopy = { title: string; steps: [string, string, string][] }; // [icon, title, desc]
export type PageTipContent = Record<Lang, TipCopy>;

export const PAGE_TIPS_UI: Record<Lang, {
  gotIt: string; turnOff: string; showTip: string;
  setting: string; settingHelper: string; showAgain: string; shownAgain: string;
}> = {
  en: {
    gotIt: 'Got it',
    turnOff: 'Turn off tips',
    showTip: 'About this page',
    setting: '💡 Page tips',
    settingHelper: 'A short guide the first time you open each page',
    showAgain: 'Show all tips again',
    shownAgain: 'Tips will show again ✓',
  },
  uz: {
    gotIt: 'Tushunarli',
    turnOff: "Ko'rsatmalarni o'chirish",
    showTip: 'Sahifa haqida',
    setting: "💡 Sahifa ko'rsatmalari",
    settingHelper: "Har bir sahifani birinchi marta ochganingizda qisqa ko'rsatma",
    showAgain: "Barcha ko'rsatmalarni qayta ko'rsatish",
    shownAgain: "Ko'rsatmalar yana chiqadi ✓",
  },
  ru: {
    gotIt: 'Понятно',
    turnOff: 'Отключить подсказки',
    showTip: 'Об этой странице',
    setting: '💡 Подсказки на страницах',
    settingHelper: 'Короткая подсказка при первом открытии каждой страницы',
    showAgain: 'Показать все подсказки снова',
    shownAgain: 'Подсказки появятся снова ✓',
  },
};

export const PAGE_TIPS: Record<string, PageTipContent> = {
  home: {
    en: { title: 'Home', steps: [
      ['🔥', 'Daily goal & streak', 'Study a little every day to keep your streak going.'],
      ['🔁', 'Reviews first', 'If words are due for review, do them before learning new ones.'],
      ['▶️', 'One tap to study', 'Each card here opens an activity straight away.'],
    ] },
    uz: { title: 'Bosh sahifa', steps: [
      ['🔥', 'Kunlik maqsad va streak', "Streakni yo'qotmaslik uchun har kuni ozgina bo'lsa ham o'qing."],
      ['🔁', 'Avval takrorlash', "Takrorlanadigan so'zlar bo'lsa, yangilaridan oldin ularni bajaring."],
      ['▶️', 'Bir bosishda mashq', "Bu yerdagi har bir karta mashqni darhol ochadi."],
    ] },
    ru: { title: 'Главная', steps: [
      ['🔥', 'Цель и серия', 'Занимайтесь понемногу каждый день, чтобы не прерывать серию.'],
      ['🔁', 'Сначала повторение', 'Если есть слова на повторение, сделайте их до новых слов.'],
      ['▶️', 'Учёба в одно касание', 'Каждая карточка здесь сразу открывает занятие.'],
    ] },
  },
  srs: {
    en: { title: 'Review (SRS)', steps: [
      ['🧠', 'What it is', "Words you've learned come back right before you'd forget them."],
      ['📅', 'When', 'Each word returns after 1, 5, 7, 14 and 30 days. Come back whenever words are due.'],
      ['⚠️', "Don't skip", 'Miss 3 reviews of a word in a row and it goes back to learning.'],
    ] },
    uz: { title: 'Takrorlash (SRS)', steps: [
      ['🧠', 'Bu nima', "O'rgangan so'zlaringiz aynan unutay deganingizda qaytib keladi."],
      ['📅', 'Qachon', "Har bir so'z 1, 5, 7, 14 va 30 kundan keyin qaytadi. So'zlar kelganda kiring."],
      ['⚠️', "O'tkazib yubormang", "So'zni ketma-ket 3 marta takrorlamasangiz, u qayta o'rganishga qaytadi."],
    ] },
    ru: { title: 'Повторение (SRS)', steps: [
      ['🧠', 'Что это', 'Выученные слова возвращаются как раз перед тем, как вы бы их забыли.'],
      ['📅', 'Когда', 'Каждое слово возвращается через 1, 5, 7, 14 и 30 дней. Заходите, когда есть слова.'],
      ['⚠️', 'Не пропускайте', 'Пропустите 3 повторения слова подряд — и оно вернётся в изучение.'],
    ] },
  },
  learn: {
    en: { title: 'Learn', steps: [
      ['📖', 'New words', 'See each word with its translation, pronunciation and examples.'],
      ['🔊', 'Say it out loud', 'Tap the speaker and repeat the word — it sticks much better.'],
      ['🔁', 'Then review', "Learned words go into Review automatically, so you won't forget them."],
    ] },
    uz: { title: "O'rganish", steps: [
      ['📖', "Yangi so'zlar", "Har bir so'z tarjimasi, talaffuzi va misollari bilan."],
      ['🔊', 'Ovoz chiqarib ayting', "Karnayni bosing va so'zni takrorlang — shunda yaxshi eslab qolasiz."],
      ['🔁', 'Keyin takrorlash', "O'rganilgan so'zlar unutilmasligi uchun avtomatik Takrorlashga tushadi."],
    ] },
    ru: { title: 'Изучение', steps: [
      ['📖', 'Новые слова', 'Каждое слово с переводом, произношением и примерами.'],
      ['🔊', 'Говорите вслух', 'Нажмите на динамик и повторите слово — так оно лучше запомнится.'],
      ['🔁', 'Потом повторение', 'Выученные слова сами попадают в Повторение, чтобы вы их не забыли.'],
    ] },
  },
  flashcards: {
    en: { title: 'Flashcards', steps: [
      ['🤔', 'Remember first', 'Try to recall the meaning before you flip the card.'],
      ['🃏', 'Easy or hard', 'Mark each card honestly so you see which words need more work.'],
      ['⚡', 'Quick practice', 'Good for a few minutes of revision between other activities.'],
    ] },
    uz: { title: 'Kartochkalar', steps: [
      ['🤔', 'Avval eslang', "Kartani aylantirishdan oldin ma'nosini eslashga harakat qiling."],
      ['🃏', 'Oson yoki qiyin', "Qaysi so'zlar ustida ko'proq ishlash kerakligini bilish uchun halol belgilang."],
      ['⚡', 'Tezkor mashq', "Boshqa mashqlar orasida bir necha daqiqalik takrorlash uchun qulay."],
    ] },
    ru: { title: 'Карточки', steps: [
      ['🤔', 'Сначала вспомните', 'Попробуйте вспомнить значение, прежде чем перевернуть карточку.'],
      ['🃏', 'Легко или трудно', 'Отмечайте честно, чтобы видеть, какие слова требуют работы.'],
      ['⚡', 'Быстрая практика', 'Подходит для нескольких минут повторения между занятиями.'],
    ] },
  },
  quiz: {
    en: { title: 'Quiz', steps: [
      ['❓', 'Pick the answer', 'Choose the right meaning out of four options.'],
      ['🎯', "Don't guess", 'The quiz shows which words you really know — and which you only think you know.'],
      ['⭐', 'Bonus XP', 'A perfect score gives extra XP.'],
    ] },
    uz: { title: 'Test', steps: [
      ['❓', 'Javobni tanlang', "To'rtta variantdan to'g'ri ma'noni tanlang."],
      ['🎯', 'Taxmin qilmang', "Test qaysi so'zlarni haqiqatan bilishingizni ko'rsatadi."],
      ['⭐', 'Bonus XP', "Hammasi to'g'ri bo'lsa, qo'shimcha XP olasiz."],
    ] },
    ru: { title: 'Тест', steps: [
      ['❓', 'Выберите ответ', 'Выберите правильное значение из четырёх вариантов.'],
      ['🎯', 'Не угадывайте', 'Тест показывает, какие слова вы действительно знаете.'],
      ['⭐', 'Бонус XP', 'За результат без ошибок — дополнительный XP.'],
    ] },
  },
  matching: {
    en: { title: 'Match', steps: [
      ['🔗', 'Make pairs', 'Tap a word, then tap its meaning.'],
      ['🎯', 'Few mistakes', 'Try to clear the board with as few wrong taps as you can.'],
      ['💡', 'Best for', "A quick, fun check of words you've already learned."],
    ] },
    uz: { title: 'Moslashtirish', steps: [
      ['🔗', 'Juftlang', "So'zni bosing, keyin uning ma'nosini bosing."],
      ['🎯', 'Kam xato', "Hamma juftlarni iloji boricha kam xato bilan toping."],
      ['💡', 'Nima uchun', "O'rgangan so'zlaringizni tez va qiziqarli tekshirish uchun."],
    ] },
    ru: { title: 'Сопоставление', steps: [
      ['🔗', 'Составьте пары', 'Нажмите на слово, затем на его значение.'],
      ['🎯', 'Меньше ошибок', 'Постарайтесь собрать все пары с минимумом ошибок.'],
      ['💡', 'Для чего', 'Быстрая и весёлая проверка уже выученных слов.'],
    ] },
  },
  my_words: {
    en: { title: 'My Words', steps: [
      ['📁', 'Your own words', 'Words you add yourself live here, in folders and units.'],
      ['➕', 'Add words', 'Type them in or use AI import to get translations and examples.'],
      ['📚', 'Study them', 'Open a unit to Learn, Flashcards, Quiz or Match on your own words.'],
    ] },
    uz: { title: "Mening so'zlarim", steps: [
      ['📁', "O'z so'zlaringiz", "O'zingiz qo'shgan so'zlar shu yerda, papka va bo'limlarda saqlanadi."],
      ['➕', "So'z qo'shish", "Qo'lda yozing yoki tarjima va misollar uchun AI importdan foydalaning."],
      ['📚', "O'rganing", "Bo'limni oching va o'z so'zlaringiz bilan O'rganish, Kartochka, Test yoki Moslashtirishni bajaring."],
    ] },
    ru: { title: 'Мои слова', steps: [
      ['📁', 'Ваши слова', 'Слова, которые вы добавили сами, хранятся здесь в папках и разделах.'],
      ['➕', 'Добавление', 'Введите их вручную или через AI-импорт с переводом и примерами.'],
      ['📚', 'Учите их', 'Откройте раздел: Изучение, Карточки, Тест или Сопоставление.'],
    ] },
  },
  library: {
    en: { title: 'Library', steps: [
      ['📚', 'Teaching library', 'Build folders and units of words to use with your classes.'],
      ['➕', 'Add words', 'Add words to a unit by hand or with AI import.'],
      ['🏫', 'Use in class', 'Give units to your students as homework.'],
    ] },
    uz: { title: 'Kutubxona', steps: [
      ['📚', "O'qituvchi kutubxonasi", "Sinflaringiz uchun so'zlardan papka va bo'limlar tuzing."],
      ['➕', "So'z qo'shish", "Bo'limga so'zlarni qo'lda yoki AI import orqali qo'shing."],
      ['🏫', 'Sinfda foydalaning', "Bo'limlarni o'quvchilarga uy vazifasi qilib bering."],
    ] },
    ru: { title: 'Библиотека', steps: [
      ['📚', 'Библиотека учителя', 'Создавайте папки и разделы со словами для своих классов.'],
      ['➕', 'Добавление слов', 'Добавляйте слова в раздел вручную или через AI-импорт.'],
      ['🏫', 'В классе', 'Задавайте разделы ученикам как домашнее задание.'],
    ] },
  },
  import: {
    en: { title: 'How to Import Words', steps: [
      ['🌐', 'Choose languages', 'Select the language of your words and the language you want translations in.'],
      ['🤖', 'Copy a prompt', 'Copy a prompt below, open Claude or ChatGPT, paste it with your words and send.'],
      ['📋', 'Paste the response', "Copy the AI's reply and paste it into the box below. Your words appear instantly."],
    ] },
    uz: { title: "So'zlarni qanday import qilish", steps: [
      ['🌐', 'Tillarni tanlang', "So'zlaringiz tilini va tarjima tilini tanlang."],
      ['🤖', 'Promptni nusxalang', "Promptni nusxalang, Claude yoki ChatGPT ga so'zlaringiz bilan joylashtiring va yuboring."],
      ['📋', 'Javobni joylashtiring', "Sun'iy intellekt javobini quyidagi maydonga joylashtiring. So'zlaringiz darhol ko'rinadi."],
    ] },
    ru: { title: 'Как импортировать слова', steps: [
      ['🌐', 'Выберите языки', 'Выберите язык ваших слов и язык перевода.'],
      ['🤖', 'Скопируйте запрос', 'Скопируйте запрос, откройте Claude или ChatGPT, вставьте вместе со словами и отправьте.'],
      ['📋', 'Вставьте ответ', 'Вставьте ответ AI в поле ниже. Слова появятся сразу.'],
    ] },
  },
  reading: {
    en: { title: 'Ideas — Reading', steps: [
      ['📰', 'Short reads', 'Stories and articles at B1–B2 level, full of useful words.'],
      ['✋', 'Collect words', 'Select any word or phrase while reading to collect it.'],
      ['💬', 'Check yourself', 'Answer the questions at the end to see if you understood.'],
    ] },
    uz: { title: "G'oyalar — O'qish", steps: [
      ['📰', 'Qisqa matnlar', "B1–B2 darajadagi foydali so'zlarga boy hikoya va maqolalar."],
      ['✋', "So'z yig'ing", "O'qiyotganda istalgan so'z yoki iborani belgilab, yig'ib oling."],
      ['💬', "O'zingizni tekshiring", "Tushunganingizni bilish uchun oxiridagi savollarga javob bering."],
    ] },
    ru: { title: 'Идеи — Чтение', steps: [
      ['📰', 'Короткие тексты', 'Истории и статьи уровня B1–B2 с полезными словами.'],
      ['✋', 'Собирайте слова', 'Выделите любое слово или фразу во время чтения, чтобы сохранить.'],
      ['💬', 'Проверьте себя', 'Ответьте на вопросы в конце, чтобы проверить понимание.'],
    ] },
  },
  ielts_reading: {
    en: { title: 'IELTS Reading', steps: [
      ['📝', 'Exam style', 'Three passages with 30 practice tests each, using real IELTS question types.'],
      ['⏱️', 'Time yourself', 'Give yourself about 20 minutes per passage, like in the exam.'],
      ['🔍', 'Learn from mistakes', 'After checking, find the sentence in the text that holds the answer.'],
    ] },
    uz: { title: 'IELTS Reading', steps: [
      ['📝', 'Imtihon uslubi', "Uchta passage, har birida 30 ta test — haqiqiy IELTS savol turlari."],
      ['⏱️', 'Vaqtni belgilang', "Imtihondagidek har bir passage uchun taxminan 20 daqiqa ajrating."],
      ['🔍', 'Xatodan o\'rganing', "Tekshirgandan keyin matnda javob turgan gapni toping."],
    ] },
    ru: { title: 'IELTS Reading', steps: [
      ['📝', 'Как на экзамене', 'Три пассажа по 30 тестов, настоящие типы вопросов IELTS.'],
      ['⏱️', 'Засекайте время', 'Около 20 минут на пассаж, как на экзамене.'],
      ['🔍', 'Учитесь на ошибках', 'После проверки найдите в тексте предложение с ответом.'],
    ] },
  },
  structures: {
    en: { title: 'Structures', steps: [
      ['🧩', 'Sentence patterns', 'Ready-made English structures you can use in speaking and writing.'],
      ['📆', 'Unit by unit', 'Each unit is split into days: Learn first, then Flashcards and Translate.'],
      ['🔁', 'Keep them', "Use Review and Detective to practise everything you've learned."],
    ] },
    uz: { title: 'Strukturalar', steps: [
      ['🧩', 'Gap qoliplari', "Gapirish va yozishda ishlatsa bo'ladigan tayyor ingliz strukturalari."],
      ['📆', "Bo'limma-bo'lim", "Har bir bo'lim kunlarga bo'lingan: avval O'rganish, keyin Kartochka va Tarjima."],
      ['🔁', 'Mustahkamlang', "O'rganganlaringizni Takrorlash va Detective bilan mashq qiling."],
    ] },
    ru: { title: 'Структуры', steps: [
      ['🧩', 'Шаблоны фраз', 'Готовые английские структуры для речи и письма.'],
      ['📆', 'По разделам', 'Каждый раздел разбит на дни: сначала Изучение, потом Карточки и Перевод.'],
      ['🔁', 'Закрепляйте', 'Повторение и Detective помогут закрепить всё выученное.'],
    ] },
  },
  battle_ready: {
    en: { title: 'Battle-Ready', steps: [
      ['⚔️', 'Topic prep', 'Pick a topic and a side to get arguments, idioms, phrases and vocabulary.'],
      ['🗣️', 'For speaking', 'Great before IELTS Speaking, an essay or a class debate.'],
      ['🃏', 'Practise the words', 'Each side has Learn, Flashcards, Match and Quiz for its vocabulary.'],
    ] },
    uz: { title: 'Battle-Ready', steps: [
      ['⚔️', 'Mavzuga tayyorgarlik', "Mavzu va tomonni tanlang: dalillar, idiomalar, iboralar va so'zlar."],
      ['🗣️', 'Gapirish uchun', "IELTS Speaking, insho yoki sinfdagi bahsdan oldin juda foydali."],
      ['🃏', "So'zlarni mashq qiling", "Har bir tomonda so'zlar uchun O'rganish, Kartochka, Moslashtirish va Test bor."],
    ] },
    ru: { title: 'Battle-Ready', steps: [
      ['⚔️', 'Подготовка к теме', 'Выберите тему и сторону: аргументы, идиомы, фразы и слова.'],
      ['🗣️', 'Для говорения', 'Отлично перед IELTS Speaking, эссе или дебатами в классе.'],
      ['🃏', 'Тренируйте слова', 'У каждой стороны есть Изучение, Карточки, Сопоставление и Тест.'],
    ] },
  },
  debate: {
    en: { title: 'Debate Arena', steps: [
      ['🎤', 'Both sides', 'Learn to argue for and against any topic.'],
      ['🛠️', 'Core skills first', 'Start with openings, signposting and rebuttal phrases.'],
      ['🔥', 'Then drill', 'Pick a topic and go through its steps one by one.'],
    ] },
    uz: { title: 'Debate Arena', steps: [
      ['🎤', 'Ikkala tomon', "Istalgan mavzu bo'yicha tarafdor va qarshi fikr bildirishni o'rganing."],
      ['🛠️', 'Avval asosiy ko\'nikmalar', "Kirish, bog'lovchi va raddiya iboralaridan boshlang."],
      ['🔥', 'Keyin mashq', "Mavzuni tanlang va bosqichlarini birma-bir bajaring."],
    ] },
    ru: { title: 'Debate Arena', steps: [
      ['🎤', 'Обе стороны', 'Учитесь аргументировать за и против любой темы.'],
      ['🛠️', 'Сначала основы', 'Начните со вступлений, связок и фраз для опровержения.'],
      ['🔥', 'Потом практика', 'Выберите тему и пройдите её шаги по порядку.'],
    ] },
  },
  phrases: {
    en: { title: 'Phrases', steps: [
      ['💬', 'Ready-made phrases', 'Natural expressions from A1 to C2, each with examples.'],
      ['🎚️', 'Pick your level', 'Start at your level and move up when it feels easy.'],
      ['🗣️', 'Use them', 'Try to use one new phrase in your own sentence today.'],
    ] },
    uz: { title: 'Iboralar', steps: [
      ['💬', 'Tayyor iboralar', "A1 dan C2 gacha tabiiy iboralar, har biri misollar bilan."],
      ['🎚️', 'Darajangizni tanlang', "O'z darajangizdan boshlang, oson bo'lib qolsa, yuqoriga o'ting."],
      ['🗣️', 'Ishlating', "Bugun bitta yangi iborani o'z gapingizda ishlatib ko'ring."],
    ] },
    ru: { title: 'Фразы', steps: [
      ['💬', 'Готовые фразы', 'Естественные выражения от A1 до C2, каждое с примерами.'],
      ['🎚️', 'Выберите уровень', 'Начните со своего уровня и переходите выше, когда станет легко.'],
      ['🗣️', 'Используйте', 'Попробуйте сегодня использовать одну новую фразу в своём предложении.'],
    ] },
  },
  real_english: {
    en: { title: 'Real English', steps: [
      ['🎬', 'Real videos', 'Each set teaches the words from a real English video.'],
      ['🔁', 'Review them', 'Review the words with SRS for about 11 days.'],
      ['🔓', 'Unlock', 'After the +7-day review the video unlocks — and you understand it.'],
    ] },
    uz: { title: 'Real English', steps: [
      ['🎬', 'Haqiqiy videolar', "Har bir to'plam haqiqiy ingliz tilidagi videodagi so'zlarni o'rgatadi."],
      ['🔁', 'Takrorlang', "So'zlarni taxminan 11 kun davomida SRS bilan takrorlang."],
      ['🔓', 'Oching', "+7 kunlik takrorlashdan keyin video ochiladi — va siz uni tushunasiz."],
    ] },
    ru: { title: 'Real English', steps: [
      ['🎬', 'Настоящие видео', 'Каждый набор учит слова из настоящего английского видео.'],
      ['🔁', 'Повторяйте', 'Повторяйте слова через SRS около 11 дней.'],
      ['🔓', 'Откройте', 'После повторения на +7 день видео откроется — и вы его поймёте.'],
    ] },
  },
  speaking: {
    en: { title: 'Speaking Practice', steps: [
      ['🎙️', 'Real questions', 'Every question has appeared in a real IELTS Speaking exam.'],
      ['🗣️', 'Answer out loud', 'Pick a part, get a question and answer it out loud.'],
      ['😌', 'No pressure', 'No score and no right answers — just speaking practice.'],
    ] },
    uz: { title: 'Gapirish mashqi', steps: [
      ['🎙️', 'Haqiqiy savollar', "Har bir savol haqiqiy IELTS Speaking imtihonida berilgan."],
      ['🗣️', 'Ovoz chiqarib javob bering', "Qismni tanlang, savol oling va ovoz chiqarib javob bering."],
      ['😌', 'Bosimsiz', "Ball ham, to'g'ri javob ham yo'q — faqat gapirish mashqi."],
    ] },
    ru: { title: 'Практика говорения', steps: [
      ['🎙️', 'Настоящие вопросы', 'Каждый вопрос был на реальном экзамене IELTS Speaking.'],
      ['🗣️', 'Отвечайте вслух', 'Выберите часть, получите вопрос и ответьте вслух.'],
      ['😌', 'Без давления', 'Без баллов и правильных ответов — просто практика.'],
    ] },
  },
  pomodoro: {
    en: { title: 'Pomodoro', steps: [
      ['⏱️', 'Focus timer', 'Study for a set time, then take a short break.'],
      ['🎯', 'One task', 'Decide what you will study before you start the timer.'],
      ['📊', 'See your time', 'Your focus sessions are saved in Pomodoro stats.'],
    ] },
    uz: { title: 'Pomodoro', steps: [
      ['⏱️', 'Diqqat taymeri', "Belgilangan vaqt o'qing, keyin qisqa tanaffus qiling."],
      ['🎯', 'Bitta vazifa', "Taymerni yoqishdan oldin nimani o'qishingizni hal qiling."],
      ['📊', 'Vaqtingizni ko\'ring', "Diqqat seanslaringiz Pomodoro statistikasida saqlanadi."],
    ] },
    ru: { title: 'Помодоро', steps: [
      ['⏱️', 'Таймер фокуса', 'Занимайтесь заданное время, затем короткий перерыв.'],
      ['🎯', 'Одна задача', 'Решите, что будете учить, до запуска таймера.'],
      ['📊', 'Ваше время', 'Сессии фокуса сохраняются в статистике Помодоро.'],
    ] },
  },
  progress: {
    en: { title: 'Progress', steps: [
      ['📈', 'Your stats', "Your XP, streak and how many words you've learned."],
      ['📅', 'Calendar', 'The calendar shows which days you studied.'],
      ['💪', 'Look back', 'Check it once a week to see how far you have come.'],
    ] },
    uz: { title: 'Natijalar', steps: [
      ['📈', 'Statistikangiz', "XP, streak va qancha so'z o'rganganingiz."],
      ['📅', 'Kalendar', "Kalendar qaysi kunlari o'qiganingizni ko'rsatadi."],
      ['💪', "Ortga qarang", "Qanchalik o'sganingizni ko'rish uchun haftada bir marta tekshiring."],
    ] },
    ru: { title: 'Прогресс', steps: [
      ['📈', 'Ваша статистика', 'XP, серия и сколько слов вы выучили.'],
      ['📅', 'Календарь', 'Календарь показывает, в какие дни вы занимались.'],
      ['💪', 'Оглянитесь', 'Заглядывайте раз в неделю, чтобы увидеть свой рост.'],
    ] },
  },
  leaderboard: {
    en: { title: 'Leaderboard', steps: [
      ['🏆', 'Ranking', 'See how your XP compares with other learners.'],
      ['⚡', 'Climb up', 'Every activity gives XP — studying every day is the fastest way up.'],
      ['🙈', 'Privacy', 'You can hide yourself from the leaderboard in Settings.'],
    ] },
    uz: { title: 'Reyting', steps: [
      ['🏆', 'Reyting', "XP'ingizni boshqa o'quvchilar bilan solishtiring."],
      ['⚡', "Yuqoriga ko'tariling", "Har bir mashq XP beradi — har kuni o'qish eng tez yo'l."],
      ['🙈', 'Maxfiylik', "Sozlamalarda o'zingizni reytingdan yashirishingiz mumkin."],
    ] },
    ru: { title: 'Рейтинг', steps: [
      ['🏆', 'Рейтинг', 'Сравните свой XP с другими учениками.'],
      ['⚡', 'Поднимайтесь', 'Каждое занятие даёт XP — ежедневная учёба быстрее всего ведёт вверх.'],
      ['🙈', 'Приватность', 'Скрыть себя из рейтинга можно в Настройках.'],
    ] },
  },
  classes: {
    en: { title: 'Classes', steps: [
      ['🏫', 'Learn with a teacher', "Join your teacher's class with a code or link."],
      ['👩‍🏫', 'Or teach', 'Create your own class and invite students.'],
      ['🔒', 'Kept separate', 'Class XP and streak are separate from your personal ones.'],
    ] },
    uz: { title: 'Sinflar', steps: [
      ['🏫', "O'qituvchi bilan", "O'qituvchingiz sinfiga kod yoki havola orqali qo'shiling."],
      ['👩‍🏫', "Yoki o'qiting", "O'z sinfingizni yarating va o'quvchilarni taklif qiling."],
      ['🔒', 'Alohida', "Sinf XP va streaki shaxsiy XP va streakingizdan alohida."],
    ] },
    ru: { title: 'Классы', steps: [
      ['🏫', 'С учителем', 'Вступите в класс учителя по коду или ссылке.'],
      ['👩‍🏫', 'Или учите сами', 'Создайте свой класс и пригласите учеников.'],
      ['🔒', 'Отдельно', 'XP и серия класса отдельно от личных.'],
    ] },
  },
  classes_joined: {
    en: { title: 'Joined Classes', steps: [
      ['📋', 'Homework', "Your teacher's homework and announcements show up here."],
      ['⏰', 'On time', 'Finish homework before its due date.'],
      ['💬', 'Ask your teacher', 'Open a class to message your teacher.'],
    ] },
    uz: { title: "Qo'shilgan sinflar", steps: [
      ['📋', 'Uy vazifasi', "O'qituvchingizning uy vazifalari va e'lonlari shu yerda chiqadi."],
      ['⏰', "O'z vaqtida", "Uy vazifasini muddatidan oldin bajaring."],
      ['💬', "O'qituvchiga yozing", "O'qituvchingizga yozish uchun sinfni oching."],
    ] },
    ru: { title: 'Мои классы (ученик)', steps: [
      ['📋', 'Домашние задания', 'Здесь появляются задания и объявления учителя.'],
      ['⏰', 'Вовремя', 'Выполняйте задания до срока.'],
      ['💬', 'Напишите учителю', 'Откройте класс, чтобы написать учителю.'],
    ] },
  },
  classes_created: {
    en: { title: 'My Classes', steps: [
      ['➕', 'Create a class', 'Create a class and share its code with your students.'],
      ['📚', 'Give homework', 'Assign words from your Library as homework.'],
      ['📊', 'Follow students', "See each student's progress and the daily insights."],
    ] },
    uz: { title: 'Mening sinflarim', steps: [
      ['➕', 'Sinf yarating', "Sinf yarating va kodini o'quvchilaringizga yuboring."],
      ['📚', 'Uy vazifasi bering', "Kutubxonangizdagi so'zlarni uy vazifasi qilib bering."],
      ['📊', "O'quvchilarni kuzating", "Har bir o'quvchining natijasi va kunlik Xulosalarni ko'ring."],
    ] },
    ru: { title: 'Мои классы (учитель)', steps: [
      ['➕', 'Создайте класс', 'Создайте класс и отправьте код ученикам.'],
      ['📚', 'Задавайте ДЗ', 'Задавайте слова из Библиотеки как домашнее задание.'],
      ['📊', 'Следите за учениками', 'Смотрите прогресс каждого ученика и ежедневные выводы.'],
    ] },
  },
};

export function getSeenTips(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
}

function saveSeenTips(ids: string[]): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch {}
}

export function getTipsEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== 'false'; } catch { return true; }
}

// Pull the account's seen list + switch into the local copy. Only called when
// a page's tip hasn't been seen locally, so pages already seen cost nothing.
export async function pullTips(userId: string): Promise<void> {
  const { data } = await supabase.from('profiles').select('seen_tips, tips_enabled').eq('id', userId).maybeSingle();
  if (!data) return;
  saveSeenTips(Array.from(new Set([...getSeenTips(), ...((data.seen_tips as string[] | null) ?? [])])));
  try { localStorage.setItem(ENABLED_KEY, String(data.tips_enabled !== false)); } catch {}
}

export function markTipSeen(id: string, userId: string | undefined): void {
  const seen = getSeenTips();
  if (!seen.includes(id)) saveSeenTips([...seen, id]);
  if (userId) supabase.rpc('mark_tip_seen', { p_tip: id }).then(() => {}, () => {});
}

export async function setTipsEnabled(on: boolean, userId: string | undefined): Promise<void> {
  try { localStorage.setItem(ENABLED_KEY, String(on)); } catch {}
  if (userId) await supabase.from('profiles').update({ tips_enabled: on }).eq('id', userId);
}

// Settings "show all tips again": clears the seen list and turns tips back on.
export async function resetTips(userId: string | undefined): Promise<void> {
  saveSeenTips([]);
  try { localStorage.setItem(ENABLED_KEY, 'true'); } catch {}
  if (userId) await supabase.from('profiles').update({ seen_tips: [], tips_enabled: true }).eq('id', userId);
}
