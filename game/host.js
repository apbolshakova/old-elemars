const app = new Vue({
    el: '#app',
    data: {
        socket: null,
    },
    methods: {},
    created() {},
});

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let score; // Содержит счёт во время игры
let stop; // Булевая переменная, окончена ли игра
let ground = []; // Земля и платформы
let obstacles = []; // Препятствия
let selectedCharacter = 'ice'; // Выбранный персонаж
let level = 1; // Выбранный уровень сложности
let player; // Текущий персонаж
let otherPlayers = []; // Персонажи других игроков

const PLAYER_STATUSES = {
    running: 'running',
    jumping: 'jumping',
    dead: 'dead',
};

let bestScore = JSON.parse(localStorage.getItem('bestScore')); // Лучший локально сохранённый результат: {name, score, character}
if (!bestScore) bestScore = {score: 0};
if (!bestScore.score)
    document.querySelector('.last_best_score').innerHTML =
        'Рекорд: пока никто не сохранял. Стань первым!';
else {
    document.querySelector('.last_best_score').innerHTML =
        'Рекорд: ' +
        bestScore.score +
        ' очков. Игрока звали ' +
        (bestScore.name || 'никак') +
        '.';
}

// Параметры игры
const gameWidth = canvas.width - 5; // -5 для более плавных границ соединения спрайтов
const gameHeight = canvas.height;
const frontForestWidth = 4674;

// Сокет для мультиплеера
let socket = null;
let gameId = null;
const clientId = '1';

/**
 * Получить число в заданном диапазоне
 * @param low {number}
 * @param high {number}
 */
function rand(low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

/**
 * Предзагрузка файлов
 */
const assetLoader = (function () {
    this.imgs = {
        bg: 'img/map/sky.jpg',
        bg2: 'img/map/sky-2.jpg',
        bg3: 'img/map/sky-3.jpg',

        iceRun: 'img/ice/ice_run.png',
        iceJump: 'img/ice/ice_jump.png',
        iceDeath: 'img/ice/ice_death.png',

        fireRun: 'img/fire/fire_run.png',
        fireJump: 'img/fire/fire_jump.png',
        fireDeath: 'img/fire/fire_death.png',

        cloud1: 'img/map/clouds/cloud-1.png',
        cloud2: 'img/map/clouds/cloud-2.png',
        cloud3: 'img/map/clouds/cloud-3.png',
        cloud4: 'img/map/clouds/cloud-4.png',

        tree1: 'img/map/forest/tree-1.png',
        tree2: 'img/map/forest/tree-2.png',
        tree3: 'img/map/forest/tree-3.png',

        bush1: 'img/map/forest/bush-1.png',
        bush2: 'img/map/forest/bush-2.png',
        bush3: 'img/map/forest/bush-3.png',
        bush4: 'img/map/forest/bush-4.png',
        bush5: 'img/map/forest/bush-5.png',
        bush6: 'img/map/forest/bush-6.png',

        grass: 'img/map/ground.png',
        water: 'img/map/obstacles/water.png',

        smallPlatform: 'img/map/obstacles/small-platform.png',
        bigPlatform: 'img/map/obstacles/big-platform.png',
        log: 'img/map/obstacles/log.png',
        brokenTree: 'img/map/obstacles/broken-tree.png',
        meteorite: 'img/map/obstacles/meteorite.png',
    };

    this.sounds = {};

    let assetsLoaded = 0; // Сколько файлов было загружено
    const numImgs = Object.keys(this.imgs).length; // Сколько картинок нужно загрузить
    const numSounds = Object.keys(this.sounds).length; // Сколько звуков нужно загрузить
    this.totalAssest = numImgs + numSounds; // Сколько всего файлов нужно загрузить

    /**
     * Обновление статуса файла, когда он загрузился
     * @param {number} dic  - Название директории ('imgs', 'sounds', 'fonts')
     * @param {string} name - Название ресурса
     */
    function assetLoaded(dic, name) {
        const {finished, totalAssest, progress} = this;

        // Если файл уже был загружен, то можно не обрабатывать
        if (this[dic][name].status !== 'loading') {
            return;
        }

        this[dic][name].status = 'loaded';
        assetsLoaded++;

        // Коллбек для отображения прогресса загрузки
        progress(assetsLoaded, totalAssest);

        // Коллбек конца загрузки
        if (assetsLoaded === totalAssest) {
            finished();
        }
    }

    /**
     * Обновление статуса аудио когда оно загрузится
     * @param {object} sound - Имя звукового ресурса
     */
    function _checkAudioState(sound) {
        const {sounds} = this;
        if (sounds[sound].status === 'loading' && sounds[sound].readyState === 4) {
            assetLoaded.call(this, 'sounds', sound);
        }
    }

    /**
     * Загрузка картинок и аудио
     */
    this.downloadAll = function () {
        const _this = this;
        let src;

        // Загрузка изображений
        for (let img in this.imgs) {
            if (this.imgs.hasOwnProperty(img)) {
                src = this.imgs[img];

                // Замыкание для загрузки отдельной картинки
                (function (_this, img) {
                    _this.imgs[img] = new Image();
                    _this.imgs[img].status = 'loading';
                    _this.imgs[img].name = img;
                    _this.imgs[img].onload = function () {
                        assetLoaded.call(_this, 'imgs', img);
                    };
                    _this.imgs[img].src = src;
                })(_this, img);
            }
        }

        // Загрузка аудио - пока не используется
        for (let sound in this.sounds) {
            if (this.sounds.hasOwnProperty(sound)) {
                src = this.sounds[sound];

                // Замыкание для загрузки отдельного аудио
                (function (_this, sound) {
                    _this.sounds[sound] = new Audio();
                    _this.sounds[sound].status = 'loading';
                    _this.sounds[sound].name = sound;
                    _this.sounds[sound].addEventListener('canplay', function () {
                        _checkAudioState.call(_this, sound);
                    });
                    _this.sounds[sound].src = src;
                    _this.sounds[sound].preload = 'auto';
                    _this.sounds[sound].load();
                })(_this, sound);
            }
        }
    };

    return {
        imgs: this.imgs,
        sounds: this.sounds,
        totalAssest: this.totalAssest,
        downloadAll: this.downloadAll,
    };
})();

/**
 * Обновить статус-бар загрузки, вызывается выше когда что-то догрузилось
 * @param {number} progress - Количество уже загруженный ресурсов
 * @param {number} total - Общее количество ресурсов, которые нужно загрузить
 */
assetLoader.progress = function (progress, total) {
    const pBar = document.querySelector('#progress-bar');
    pBar.value = progress / total;
    document.querySelector('#p').innerHTML = Math.round(pBar.value * 100) + '%';
};

/**
 * Загрузка главного меню
 */
assetLoader.finished = function () {
    mainMenu();
};

/**
 * Создание Spritesheet
 * @param {string} path - Путь до картинки
 * @param {number} frameWidth - Ширина (в px) каждого кадра
 * @param {number} frameHeight - Высота (в px) каждого кадра
 */
function SpriteSheet(path, frameWidth, frameHeight) {
    this.image = new Image();
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;

    // Вычисление количества кадров в одном ряду спрайта
    const self = this;
    this.image.onload = function () {
        self.framesPerRow = Math.floor(self.image.width / self.frameWidth);
    };

    this.image.src = path;
}

/**
 * Создание анимации на основе spritesheet.
 * @param {SpriteSheet} spritesheet - spritesheet, используемый для анимации
 * @param {number} frameSpeed - Количество кадров, через которое нужно сменить кадр анимации на следующий
 * @param {number} startFrame - Номер кадра начала анимации в спрайте
 * @param {number} endFrame - Repeat the animation once completed.
 * @param {boolean} playOnce - Проиграть анимацию один раз и остаться на последнем кадре
 */
function Animation(spritesheet, frameSpeed, startFrame, endFrame, playOnce = false) {
    const animationSequence = []; // Массив кадров для анимации
    let currentFrame = 0; // Текущий кадр анимации
    let counter = 0; // Переменная для правильного времени смены кадра анимации

    // Добавление в массив анимации всех кадров
    for (let frameNumber = startFrame; frameNumber <= endFrame; frameNumber++)
        animationSequence.push(frameNumber);

    /**
     * Пересчёт кадра анимации, который должен быть отрисован
     */
    this.update = function () {
        // Сменить номер текущего кадра, если наступил нужный момент
        if (counter === frameSpeed - 1) {
            if (!playOnce || currentFrame !== endFrame)
                currentFrame = (currentFrame + 1) % animationSequence.length;
        }

        // Установка следующего момента, когда нужно менять кадр
        counter = (counter + 1) % frameSpeed;
    };

    /**
     * Отрисовка кадра анимации
     * @param {number} x
     * @param {number} y
     */
    this.draw = function (x, y) {
        // Получение позиции кадра анимации в файле спрайта
        const row = Math.floor(
            animationSequence[currentFrame] / spritesheet.framesPerRow,
        );
        const col = Math.floor(
            animationSequence[currentFrame] % spritesheet.framesPerRow,
        );

        ctx.drawImage(
            spritesheet.image,
            col * spritesheet.frameWidth,
            row * spritesheet.frameHeight,
            spritesheet.frameWidth,
            spritesheet.frameHeight,
            x,
            y,
            spritesheet.frameWidth,
            spritesheet.frameHeight,
        );
    };
}

/**
 * Обработка заднего плана
 */
const background = (function () {
    const cloudsPerScreen = 4;
    const backForestPerScreen = 6;
    const frontForestPerScreen = 12;

    const clouds = {}; // Облака: x, speed, elements: {x, y, type}
    const backForest = {}; // Лес на заднем плане: x, speed, elements: {x, y, type}
    const backGrass = {}; // Слой земли на заднем плане: x, y, speed
    const frontForest = {}; // Лес на переднем плане: x, speed, elements: {x, y, type}

    /**
     * Сдвиг элементов в зависимости от скорости и их отрисовка
     */
    this.draw = function () {
        // Фон в зависимости от уровня
        switch (level) {
            case 2:
                ctx.drawImage(assetLoader.imgs.bg2, 0, 0);
                break;
            case 3:
                ctx.drawImage(assetLoader.imgs.bg3, 0, 0);
                break;
            default:
                ctx.drawImage(assetLoader.imgs.bg, 0, 0);
                break;
        }

        // Сдвинуть элементы
        clouds.x -= clouds.speed;
        backForest.x -= backForest.speed;
        backGrass.x -= backGrass.speed;
        frontForest.x -= frontForest.speed;

        // Отрисовка каждого элемента с поправкой на экран, где элемент находится (до, в кадре, после)

        clouds.elements.forEach((cloud, cloudNum) => {
            let cloudImg;
            switch (cloud.type) {
                case 1:
                    cloudImg = assetLoader.imgs.cloud1;
                    break;
                case 2:
                    cloudImg = assetLoader.imgs.cloud2;
                    break;
                case 3:
                    cloudImg = assetLoader.imgs.cloud3;
                    break;
                default:
                    cloudImg = assetLoader.imgs.cloud4;
            }

            switch (Math.floor(cloudNum / cloudsPerScreen)) {
                case 0:
                    ctx.drawImage(
                        cloudImg,
                        -1 * canvas.width + clouds.x + cloud.x,
                        cloud.y,
                    );
                    break;
                case 1:
                    ctx.drawImage(cloudImg, clouds.x + cloud.x, cloud.y);
                    break;
                case 2:
                    ctx.drawImage(
                        cloudImg,
                        1 * canvas.width + clouds.x + cloud.x,
                        cloud.y,
                    );
            }
        });

        backForest.elements.forEach((forestEl, forestElNum) => {
            let elImg;
            switch (forestEl.type) {
                case 1:
                    elImg = assetLoader.imgs.tree1;
                    break;
                case 2:
                    elImg = assetLoader.imgs.tree2;
                    break;
                default:
                    elImg = assetLoader.imgs.tree3;
            }

            switch (Math.floor(forestElNum / backForestPerScreen)) {
                case 0:
                    ctx.drawImage(
                        elImg,
                        -1 * canvas.width + backForest.x + forestEl.x,
                        forestEl.y,
                        elImg.width * 0.75,
                        elImg.height * 0.75,
                    );
                    break;
                case 1:
                    ctx.drawImage(
                        elImg,
                        backForest.x + forestEl.x,
                        forestEl.y,
                        elImg.width * 0.75,
                        elImg.height * 0.75,
                    );
                    break;
                case 2:
                    ctx.drawImage(
                        elImg,
                        1 * canvas.width + backForest.x + forestEl.x,
                        forestEl.y,
                        elImg.width * 0.75,
                        elImg.height * 0.75,
                    );
            }
        });

        for (let i = -1; i <= 1; i++) {
            ctx.drawImage(
                assetLoader.imgs.grass,
                i * gameWidth + backGrass.x,
                backGrass.y,
                assetLoader.imgs.grass.width,
                assetLoader.imgs.grass.height * 2,
            );
        }

        ctx.filter = 'opacity(50%)';
        switch (level) {
            case 2:
                ctx.drawImage(assetLoader.imgs.bg2, 0, 0);
                break;
            case 3:
                ctx.drawImage(assetLoader.imgs.bg3, 0, 0);
                break;
            default:
                ctx.drawImage(assetLoader.imgs.bg, 0, 0);
                break;
        }
        ctx.filter = 'none';

        frontForest.elements.forEach((forestEl, forestElNum) => {
            let elImg;
            switch (forestEl.type) {
                case 1:
                    elImg = assetLoader.imgs.bush1;
                    break;
                case 2:
                    elImg = assetLoader.imgs.bush2;
                    break;
                case 3:
                    elImg = assetLoader.imgs.bush3;
                    break;
                case 4:
                    elImg = assetLoader.imgs.bush4;
                    break;
                case 5:
                    elImg = assetLoader.imgs.bush5;
                    break;
                default:
                    elImg = assetLoader.imgs.bush6;
            }

            switch (Math.floor(forestElNum / frontForestPerScreen)) {
                case 0:
                    ctx.drawImage(
                        elImg,
                        -1 * frontForestWidth + frontForest.x + forestEl.x,
                        forestEl.y,
                    );
                    break;
                case 1:
                    ctx.drawImage(elImg, frontForest.x + forestEl.x, forestEl.y);
                    break;
                case 2:
                    ctx.drawImage(
                        elImg,
                        frontForestWidth + frontForest.x + forestEl.x,
                        forestEl.y,
                    );
            }
        });

        // Если слой проскроллен до конца, то сгенерировать новый экран
        if (clouds.x + gameWidth <= 0) {
            clouds.x = 0;
            clouds.elements = clouds.elements.slice(cloudsPerScreen);
            for (let i = 0; i < cloudsPerScreen; i++) {
                clouds.elements.push({
                    x: rand(0, gameWidth - 840),
                    y: rand(0, gameHeight - 600),
                    type: rand(1, 4),
                });
            }
        }

        if (backForest.x + gameWidth <= 0) {
            backForest.x = 0;
            backForest.elements = backForest.elements.slice(backForestPerScreen);
            for (let i = 0; i < backForestPerScreen; i++) {
                backForest.elements.push({
                    x: rand(0, gameWidth - 730),
                    y: 90,
                    type: rand(1, 3),
                });
            }
        }

        if (backGrass.x + gameWidth <= 0) {
            backGrass.x = 0;
        }

        if (frontForest.x + frontForestWidth <= 0) {
            frontForest.x = 0;
            frontForest.elements = frontForest.elements.slice(frontForestPerScreen);
            for (let i = 0; i < frontForestPerScreen; i++) {
                frontForest.elements.push({
                    x: rand(0, frontForestWidth - 834 - 710),
                    y: 600,
                    type: rand(1, 6),
                });
            }
        }
    };

    /**
     * Начальное состояние заднего плана
     */
    this.reset = function () {
        clouds.x = -gameWidth;
        clouds.speed = 1;
        clouds.elements = [];
        for (let i = 0; i < cloudsPerScreen * 3; i++) {
            clouds.elements.push({
                x: rand(0, gameWidth - 840),
                y: rand(0, gameHeight - 600),
                type: rand(1, 4),
            });
        }

        backForest.x = -gameWidth;
        backForest.speed = 5;
        backForest.elements = [];
        for (let i = 0; i < backForestPerScreen * 3; i++) {
            backForest.elements.push({
                x: rand(0, gameWidth - 730),
                y: 90,
                type: rand(1, 3),
            });
        }

        backGrass.x = -gameWidth;
        backGrass.y = 655;
        backGrass.speed = 5;

        frontForest.x = -frontForestWidth;
        frontForest.speed = player.speed;
        frontForest.elements = [];
        for (let i = 0; i < frontForestPerScreen * 3; i++) {
            frontForest.elements.push({
                x: rand(0, frontForestWidth - 834 - 710),
                y: 600,
                type: rand(1, 6),
            });
        }
    };

    return {
        draw: this.draw,
        reset: this.reset,
    };
})();

/**
 * Вектор
 * @param {number} x
 * @param {number} y
 * @param {number} dx
 * @param {number} dy
 */
function Vector(x, y, dx, dy) {
    // Позиция
    this.x = x || 0;
    this.y = y || 0;
    // Направление
    this.dx = dx || 0;
    this.dy = dy || 0;
}

/**
 * Сдвиг вектора на dx и dy
 */
Vector.prototype.advance = function () {
    this.x += this.dx;
    this.y += this.dy;
};

/**
 * Объект персонажа
 */
function createPlayer(player) {
    let jumpCounter; // Сколько кадров будет продолжаться движение вверх при прыжке

    player.width = 500;
    player.height = 458;
    player.speed = 5 + 5 * level;
    player.dy = 0;
    player.status = PLAYER_STATUSES['jumping'];

    // Параметры прыжка
    if (level === 1) {
        player.gravity = 0.4;
        player.jumpDy = -20;
    } else {
        player.gravity = 1;
        player.jumpDy = -30;
    }

    // Spritesheets
    if (selectedCharacter === 'ice') {
        player.runSheet = new SpriteSheet(
            assetLoader.imgs.iceRun.src,
            player.width,
            player.height,
        );
        player.jumpSheet = new SpriteSheet(
            assetLoader.imgs.iceJump.src,
            player.width,
            player.height,
        );
        player.deathSheet = new SpriteSheet(
            assetLoader.imgs.iceDeath.src,
            player.width,
            player.height,
        );
    }
    if (selectedCharacter === 'fire') {
        player.runSheet = new SpriteSheet(
            assetLoader.imgs.fireRun.src,
            player.width,
            player.height,
        );
        player.jumpSheet = new SpriteSheet(
            assetLoader.imgs.fireJump.src,
            player.width,
            player.height,
        );
        player.deathSheet = new SpriteSheet(
            assetLoader.imgs.fireDeath.src,
            player.width,
            player.height,
        );
    }
    player.runAnim = new Animation(player.runSheet, 2, 0, 26);
    player.jumpAnim = new Animation(player.jumpSheet, 2, 0, 26);
    player.deathAnim = new Animation(player.deathSheet, 2, 0, 24, true);
    player.anim = player.runAnim;

    Vector.call(player, 0, 0, 0, player.dy);

    /**
     * Обновление данных о персонаже и перерисовка спрайта
     */
    player.update = function () {
        if (level > 1 && KEY_STATUS['KeyD']) player.dx = 10;
        else if (level > 1 && KEY_STATUS['KeyA']) player.dx = -10;
        else if (player.status === PLAYER_STATUSES.dead) player.dx = -player.speed;
        else player.dx = 0;

        // Прыгнуть, если нажали на W и персонаж не прыгает
        if (
            KEY_STATUS['KeyW'] &&
            player.dy === 0 &&
            player.status !== PLAYER_STATUSES['jumping']
        ) {
            player.status = PLAYER_STATUSES['jumping'];
            player.dy = player.jumpDy;
        }
        if (
            player.status === PLAYER_STATUSES['jumping'] ||
            player.status === PLAYER_STATUSES['dead']
        ) {
            player.dy += player.gravity;
        }

        jumpCounter = Math.max(jumpCounter - 1, 0);

        this.advance();

        // Смена анимации
        if (player.status === PLAYER_STATUSES['jumping']) {
            player.anim = player.jumpAnim;
        } else if (player.status === PLAYER_STATUSES['dead']) {
            player.anim = player.deathAnim;
        } else {
            player.anim = player.runAnim;
        }

        player.anim.update();
    };

    /**
     * Отрисовка персонажа
     */
    player.draw = function () {
        player.anim.draw(player.x, player.y + 70);
    };

    /**
     * Сброс позиции персонажа
     */
    player.reset = function () {
        player.x = rand(0, 100);
        player.y = 0;
    };

    return player;
}

/**
 * Объект персонажа
 */
function createOtherPlayer(otherPlayer) {
    let jumpCounter; // Сколько кадров будет продолжаться движение вверх при прыжке

    otherPlayer.width = 500;
    otherPlayer.height = 458;
    otherPlayer.pressedButtons = {
        KeyW: false,
        KeyA: false,
        KeyD: false,
    };
    otherPlayer.speed = 5 + 5 * level;
    otherPlayer.status = PLAYER_STATUSES['jumping'];
    // Позиция
    otherPlayer.x = 0;
    otherPlayer.y = 0;
    // Направление
    otherPlayer.dx = 0;
    otherPlayer.dy = 0;

    // Параметры прыжка
    if (level === 1) {
        otherPlayer.gravity = 0.4;
        otherPlayer.jumpDy = -20;
    } else {
        otherPlayer.gravity = 1;
        otherPlayer.jumpDy = -30;
    }

    // Spritesheets
    if (otherPlayer.character === 'ice') {
        otherPlayer.runSheet = new SpriteSheet(
            assetLoader.imgs.iceRun.src,
            otherPlayer.width,
            otherPlayer.height,
        );
        otherPlayer.jumpSheet = new SpriteSheet(
            assetLoader.imgs.iceJump.src,
            otherPlayer.width,
            otherPlayer.height,
        );
        otherPlayer.deathSheet = new SpriteSheet(
            assetLoader.imgs.iceDeath.src,
            otherPlayer.width,
            otherPlayer.height,
        );
    }
    if (otherPlayer.character === 'fire') {
        otherPlayer.runSheet = new SpriteSheet(
            assetLoader.imgs.fireRun.src,
            otherPlayer.width,
            otherPlayer.height,
        );
        otherPlayer.jumpSheet = new SpriteSheet(
            assetLoader.imgs.fireJump.src,
            otherPlayer.width,
            otherPlayer.height,
        );
        otherPlayer.deathSheet = new SpriteSheet(
            assetLoader.imgs.fireDeath.src,
            otherPlayer.width,
            otherPlayer.height,
        );
    }
    otherPlayer.runAnim = new Animation(otherPlayer.runSheet, 2, 0, 26);
    otherPlayer.jumpAnim = new Animation(otherPlayer.jumpSheet, 2, 0, 26);
    otherPlayer.deathAnim = new Animation(otherPlayer.deathSheet, 2, 0, 24, true);
    otherPlayer.anim = otherPlayer.runAnim;

    otherPlayer.advance = function () {
        this.x += this.dx;
        this.y += this.dy;
    };
    /**
     * Отрисовка персонажа
     */
    otherPlayer.draw = function () {
        otherPlayer.anim.draw(otherPlayer.x, otherPlayer.y + 70);
    };

    otherPlayer.update = function () {
        if (level > 1 && otherPlayer.pressedButtons['KeyD']) otherPlayer.dx = 10;
        else if (level > 1 && otherPlayer.pressedButtons['KeyA']) otherPlayer.dx = -10;
        else if (otherPlayer.status === PLAYER_STATUSES.dead)
            otherPlayer.dx = -player.speed;
        else otherPlayer.dx = 0;

        // Прыгнуть, если нажали на W и персонаж не прыгает
        if (
            otherPlayer.pressedButtons['KeyW'] &&
            otherPlayer.dy === 0 &&
            otherPlayer.status !== PLAYER_STATUSES['jumping']
        ) {
            otherPlayer.status = PLAYER_STATUSES['jumping'];
            otherPlayer.dy = otherPlayer.jumpDy;
        }
        if (
            otherPlayer.status === PLAYER_STATUSES['jumping'] ||
            otherPlayer.status === PLAYER_STATUSES['dead']
        ) {
            otherPlayer.dy += otherPlayer.gravity;
        }

        jumpCounter = Math.max(jumpCounter - 1, 0);

        this.advance();

        // Смена анимации
        if (otherPlayer.status === PLAYER_STATUSES['jumping']) {
            otherPlayer.anim = otherPlayer.jumpAnim;
        } else if (otherPlayer.status === PLAYER_STATUSES['dead']) {
            otherPlayer.anim = otherPlayer.deathAnim;
        } else {
            otherPlayer.anim = otherPlayer.runAnim;
        }

        otherPlayer.anim.update();
    };

    return otherPlayer;
}

/**
 * Спрайты - элементы игры, составляющие передний план (земля, персонаж, препятствия,...)
 * @param {number} x
 * @param {number} y
 * @param {number} width - Ширина спрайта
 * @param {number} height - Высота спрайта
 * @param {string} type - Тип спрайта
 * @param {number} speedX - на сколько должен сдвигаться каждый кадр
 * @param {number} speedY - на сколько должен сдвигаться каждый кадр
 */
function Sprite(x = 0, y = 0, width = 0, height = 0, type = null, speedX, speedY) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.speedX = speedX;
    this.speedY = speedY;
    Vector.call(this, x, y, 0, 0);

    /**
     * Сдвиг спрайта в зависимости от скорости персонажа
     */
    this.update = function () {
        this.dx = -player.speed + this.speedX;
        this.dy = this.speedY;
        this.advance();
    };

    /**
     * Отрисовка спрайта
     */
    this.draw = function () {
        if (this.type) {
            ctx.save();
            ctx.drawImage(assetLoader.imgs[this.type], this.x, this.y);
            ctx.restore();
        }
    };
}

Sprite.prototype = Object.create(Vector.prototype);

/**
 * Перерисовка земли и платформ, проверка столкновения с игроком
 */
function updateGround() {
    const groundElementsPerScreen = 4; // 2 земли и 2 платформы
    // Ground - элементы по которым элемар может бегать: x, elements: Array[]{x, y, type}
    if (player.status !== PLAYER_STATUSES['dead']) {
        player.status = PLAYER_STATUSES['jumping'];
    }

    otherPlayers.map(otherPlayer => {
        if (otherPlayer.status !== PLAYER_STATUSES['dead']) {
            otherPlayer.status = PLAYER_STATUSES['jumping'];
        }
    });

    let xCoordWithOffset;

    ground.x -= player.speed;
    for (let i = 0; i < ground.elements.length; i++) {
        switch (Math.floor(i / groundElementsPerScreen)) {
            case 0:
                ground.elements[i].x += -1 * frontForestWidth + ground.x;
                xCoordWithOffset = ground.elements[i].x;
                ground.elements[i].draw();
                ground.elements[i].x -= -1 * frontForestWidth + ground.x;
                break;
            case 1:
                ground.elements[i].x += ground.x;
                xCoordWithOffset = ground.elements[i].x;
                ground.elements[i].draw();
                ground.elements[i].x -= ground.x;
                break;
            case 2:
                ground.elements[i].x += frontForestWidth + ground.x;
                xCoordWithOffset = ground.elements[i].x;
                ground.elements[i].draw();
                ground.elements[i].x -= frontForestWidth + ground.x;
        }

        // Обработка приземления игрока на платформу
        if (
            player.dy >= 0 &&
            Math.abs(player.y + player.height - ground.elements[i].y) < 20 &&
            xCoordWithOffset <= player.x + player.width / 2 &&
            player.x + player.width / 2 <= xCoordWithOffset + ground.elements[i].width
        ) {
            if (player.status !== PLAYER_STATUSES['dead']) {
                player.status = PLAYER_STATUSES['running'];
            }
            player.y = ground.elements[i].y - player.height;
            player.dy = 0;
        }

        otherPlayers.map(otherPlayer => {
            if (
                otherPlayer.dy >= 0 &&
                Math.abs(otherPlayer.y + otherPlayer.height - ground.elements[i].y) <
                    20 &&
                xCoordWithOffset <= otherPlayer.x + otherPlayer.width / 2 &&
                otherPlayer.x + otherPlayer.width / 2 <=
                    xCoordWithOffset + ground.elements[i].width
            ) {
                if (otherPlayer.status !== PLAYER_STATUSES['dead']) {
                    otherPlayer.status = PLAYER_STATUSES['running'];
                }
                otherPlayer.y = ground.elements[i].y - otherPlayer.height;
                otherPlayer.dy = 0;
            }
        });

        if (ground.x + frontForestWidth <= 0) {
            ground.x = 0;
            ground.elements = ground.elements.slice(groundElementsPerScreen);
            ground.elements.push(new Sprite(0, 837, 1920, 243, 'grass'));
            ground.elements.push(new Sprite(1920, 837, 1920, 243, 'grass'));
            for (let i = 0; i < 2; i++) {
                let isBig = rand(0, 1);
                if (isBig) {
                    ground.elements.push(
                        new Sprite(
                            rand(0, frontForestWidth - 954) + frontForestWidth * i,
                            300 * rand(1, 2) - 100,
                            954,
                            412,
                            'bigPlatform',
                        ),
                    );
                } else {
                    ground.elements.push(
                        new Sprite(
                            rand(0, frontForestWidth - 493) + frontForestWidth * i,
                            300 * rand(1, 2) - 100,
                            493,
                            353,
                            'smallPlatform',
                        ),
                    );
                }
            }
        }
    }
}

/**
 * Обновление состояния всех препятствий, обработка столкновения персонажа с препятствием
 */
function updateObstacles() {
    const obstacleElementsPerScreen = 2; // Вода и препятствие
    let xCoordWithOffset;
    // Препятствия - элементы, при столкновении с которыми конец игры: x, elements: Array[]<{x, y, type, dx, dy}>

    obstacles.x -= player.speed;
    // Анимация препятствий
    for (let i = 0; i < obstacles.elements.length; i++) {
        if (obstacles.elements[i].speedX) {
            obstacles.elements[i].x += obstacles.elements[i].speedX;
        }
        if (obstacles.elements[i].speedY) {
            obstacles.elements[i].y += obstacles.elements[i].speedY;
        }

        switch (Math.floor(i / obstacleElementsPerScreen)) {
            case 0:
                obstacles.elements[i].x += -1 * frontForestWidth + obstacles.x;
                xCoordWithOffset = obstacles.elements[i].x;
                obstacles.elements[i].draw();
                obstacles.elements[i].x -= -1 * frontForestWidth + obstacles.x;
                break;
            case 1:
                obstacles.elements[i].x += obstacles.x;
                xCoordWithOffset = obstacles.elements[i].x;
                obstacles.elements[i].draw();
                obstacles.elements[i].x -= obstacles.x;
                break;
            case 2:
                obstacles.elements[i].x += frontForestWidth + obstacles.x;
                xCoordWithOffset = obstacles.elements[i].x;
                obstacles.elements[i].draw();
                obstacles.elements[i].x -= frontForestWidth + obstacles.x;
        }

        // Обработка столкновения персонажа с препятствием
        if (
            obstacles.elements[i].type !== 'water' &&
            player.y + player.height >= obstacles.elements[i].y &&
            player.y <= obstacles.elements[i].y + obstacles.elements[i].height &&
            xCoordWithOffset <= player.x + player.width / 2 &&
            player.x + player.width / 2 <=
                xCoordWithOffset + obstacles.elements[i].width / 2
        ) {
            player.status = PLAYER_STATUSES.dead;
            // gameOver();
        }

        // Обработка столкновения остальных персонажей с препятствием
        otherPlayers.map(otherPlayer => {
            if (
                obstacles.elements[i].type !== 'water' &&
                otherPlayer.y + otherPlayer.height >= obstacles.elements[i].y &&
                otherPlayer.y <= obstacles.elements[i].y + obstacles.elements[i].height &&
                xCoordWithOffset <= otherPlayer.x + otherPlayer.width / 2 &&
                otherPlayer.x + otherPlayer.width / 2 <=
                    xCoordWithOffset + obstacles.elements[i].width / 2
            ) {
                otherPlayer.status = PLAYER_STATUSES.dead;
            }
        });
    }

    if (obstacles.x + frontForestWidth <= 0) {
        obstacles.x = 0;
        obstacles.elements = obstacles.elements.slice(obstacleElementsPerScreen);
        obstacles.elements.push(new Sprite(3840, 860, 834, 220, 'water'));
        for (let i = 0; i < obstacleElementsPerScreen - 1; i++) {
            let type = rand(0, 2);
            switch (type) {
                case 0:
                    obstacles.elements.push(
                        new Sprite(
                            rand(500, frontForestWidth - 619 - 834) +
                                frontForestWidth * i,
                            560,
                            619,
                            452,
                            'brokenTree',
                        ),
                    );
                    break;
                case 1:
                    obstacles.elements.push(
                        new Sprite(
                            rand(500, frontForestWidth - 492 - 834) +
                                frontForestWidth * i,
                            680,
                            492,
                            394,
                            'log',
                        ),
                    );
                    break;
                default:
                    if (level > 2) {
                        obstacles.elements.push(
                            new Sprite(
                                rand(2000, frontForestWidth - 227 - 834) +
                                    frontForestWidth * i,
                                -3400,
                                227,
                                614,
                                'meteorite',
                                -5,
                                15,
                            ),
                        );
                    } else {
                        obstacles.elements.push(new Sprite());
                    }
            }
        }
    }
}

/**
 * Обновление состояния персонажа
 */
function updatePlayer() {
    player.update();
    player.draw();

    // Конец игры, если персонаж упал
    if (player.y + player.height >= canvas.height) {
        player.status = PLAYER_STATUSES.dead;
        // gameOver();
    }
}

function updateOtherPlayers() {
    otherPlayers.map(otherPlayer => {
        otherPlayer.update();
        otherPlayer.draw();

        // Конец игры, если персонаж упал
        if (otherPlayer.y + otherPlayer.height >= canvas.height) {
            otherPlayer.status = PLAYER_STATUSES.dead;
        }
    });
}

/**
 * Game loop
 */
function animate() {
    if (player.status !== PLAYER_STATUSES.dead) score++;

    if (!stop) {
        requestAnimFrame(animate);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        background.draw();

        // Обновление состояния элементов игры
        updateGround();
        updateObstacles();
        updatePlayer();
        updateOtherPlayers();

        const elementsInfoToSend = obstacles.elements.map(
            ({x, y, width, height, type}) => ({
                x,
                y,
                width,
                height,
                type,
            }),
        );

        const playersInfoToSend = [
            {
                id: clientId,
                character: selectedCharacter,
                x: player.x,
                y: player.y,
                width: player.width,
                height: player.height,
                status: player.status,
            },
        ].concat(
            otherPlayers.map(({id, character, x, y, width, height, status}) => ({
                id,
                character,
                x,
                y,
                width,
                height,
                status,
            })),
        );

        const dataToSend = {
            obstacles: {x: obstacles.x, elements: elementsInfoToSend},
            players: playersInfoToSend,
        };

        socket.emit('update', dataToSend);

        // Отрисовка текущего счёта
        ctx.fillText('Счёт: ' + score, canvas.width - 200, 75);
    }
}

/**
 * Отслеживание нажатий
 */
const KEY_STATUS = {
    KeyW: false,
    KeyA: false,
    KeyD: false,
};

document.onkeydown = function (e) {
    if (KEY_STATUS.hasOwnProperty(e.code)) {
        e.preventDefault();
        KEY_STATUS[e.code] = true;
    }
};
document.onkeyup = function (e) {
    if (KEY_STATUS.hasOwnProperty(e.code)) {
        e.preventDefault();
        KEY_STATUS[e.code] = false;
    }
};

/**
 * Полифил для получения следующего кадра анимации
 */
const requestAnimFrame = (function () {
    return (
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        }
    );
})();

/**
 * Отрисовка главного меню
 */
function mainMenu() {
    document.querySelector('#progress').style.display = 'none';
    document.querySelector('#main').style.display = 'block';
    document.querySelector('#menu').classList.add('main');

    /**
     * Поведение кнопок в главном меню
     */
    document.querySelector('.credits').onclick = function () {
        document.querySelector('#main').style.display = 'none';
        document.querySelector('#credits').style.display = 'block';
        document.querySelector('#menu').classList.add('credits');
    };

    document.querySelectorAll('.back').forEach(
        el =>
            (el.onclick = function () {
                socket.emit('deleteGame', gameId);
                document.querySelector('#credits').style.display = 'none';
                document.querySelector('#game-over').style.display = 'none';
                document.querySelector('#main').style.display = 'block';
                document.querySelector('#menu').style.display = 'block';
                document.querySelector('#menu').classList.remove('credits');
            }),
    );

    document.querySelector('#start-solo-game-btn').onclick = function () {
        document.querySelector('#main').style.display = 'none';
        document.querySelector('#solo-game-preview').style.display = 'block';
    };

    document.querySelector('#start-multi-game-btn').onclick = function () {
        document.querySelector('#main').style.display = 'none';
        document.querySelector('#multi-game-preview').style.display = 'block';
        createMultiplayerGame();
    };

    document.querySelectorAll('.play').forEach(button => {
        button.onclick = function () {
            socket.emit('start', gameId);
            // startGame()
        };
    });
}

document.querySelector('.restart').onclick = function () {
    document.querySelector('#game-over').style.display = 'none';
    startGame();
};

document.querySelector('#ice').onclick = function () {
    selectedCharacter = 'ice';
    this.classList.add('button_active');
    document.querySelector('#fire').classList.remove('button_active');
    document.querySelectorAll('.fire').forEach(el => el.classList.remove('fire'));
};

document.querySelector('#fire').onclick = function () {
    selectedCharacter = 'fire';
    this.classList.add('button_active');
    document.querySelector('#ice').classList.remove('button_active');
    document.querySelectorAll('button').forEach(el => el.classList.add('fire'));
};

document.querySelectorAll('.level_button').forEach(
    el =>
        (el.onclick = function () {
            document
                .querySelectorAll('.level_button')
                .forEach(el => el.classList.remove('button_active'));
            this.classList.add('button_active');
            level = parseInt(this.id);
        }),
);

document.querySelector('#show-name-input-btn').onclick = function () {
    document.querySelector('#result-saving').style.display = 'block';
    document.querySelector('#game-over').style.display = 'none';
};

document.querySelector('#save-result').onclick = function () {
    const name = document.getElementById('user-name').value;
    bestScore = {
        name: name,
        score: score,
        character: selectedCharacter,
    };
    localStorage.setItem('bestScore', JSON.stringify(bestScore));
    document.querySelector('#result-saving').style.display = 'none';
    document.querySelector('#game-over').style.display = 'block';
    document.querySelector('.save_result_container').classList.add('hidden');
    if (!bestScore.score)
        document.querySelector('.last_best_score').innerHTML =
            'Рекорд: пока никто не сохранял. Стань первым!';
    else {
        document.querySelector('.last_best_score').innerHTML =
            'Рекорд: ' +
            bestScore.score +
            ' очков. Игрока звали ' +
            (bestScore.name || 'никак') +
            '.';
    }
};

document.querySelector('#download-result').onclick = function () {
    const downloadToFile = (content, filename, contentType) => {
        const a = document.createElement('a');
        const file = new Blob([content], {type: contentType});

        a.href = URL.createObjectURL(file);
        a.download = filename;
        a.click();

        URL.revokeObjectURL(a.href);
    };

    let text;
    if (!bestScore.score) {
        text = 'К сожалению, ещё никто не сохранял свой рекорд. Стань первым!';
    } else {
        text =
            (bestScore.name ? bestScore.name : 'Ты') +
            ' молодец и набрал ' +
            bestScore.score +
            ' очков, играя за ' +
            (bestScore.character === 'ice' ? 'Лёд' : 'Огонь') +
            '!';
    }

    downloadToFile(text, 'Рекорд.txt', 'text/plain');
};

/**
 * Начало игры
 */
function startGame() {
    document.querySelector('#solo-game-preview').style.display = 'none';
    document.querySelector('#multi-game-preview').style.display = 'none';
    document.querySelector('#menu').style.display = 'none';

    player = createPlayer(Object.create(Vector.prototype));
    otherPlayers = otherPlayers.map(otherPlayer => createOtherPlayer(otherPlayer));
    document.querySelector('#game-over').style.display = 'none';
    ground = {
        x: 0,
        elements: [],
    };
    obstacles = {
        x: 0,
        elements: [],
    };
    player.reset();
    stop = false;
    score = 0;

    ctx.font = '900 32px "Franklin Gothic Medium", sans-serif';

    ground.x = -frontForestWidth;
    for (let i = 0; i < 3; i++) {
        ground.elements.push(new Sprite(0, 837, 1920, 243, 'grass'));
        ground.elements.push(new Sprite(1920, 837, 1920, 243, 'grass'));
        for (let i = 0; i < 2; i++) {
            ground.elements.push(new Sprite());
        }
    }

    obstacles.x = -frontForestWidth;
    for (let i = 0; i < 3; i++) {
        obstacles.elements.push(new Sprite(3840, 860, 834, 220, 'water'));
        for (let i = 0; i < 1; i++) {
            obstacles.elements.push(new Sprite());
        }
    }

    background.reset();
    animate();
}

/**
 * Конец игры
 */
function gameOver() {
    stop = true;
    document.querySelector('#score').innerHTML = score;
    document.querySelector('#game-over').style.display = 'block';

    const saveResultDiv = document.querySelector('.save_result_container');
    if (score > bestScore.score) saveResultDiv.classList.remove('hidden');
    else saveResultDiv.classList.add('hidden');
}

function initSocket() {
    socket = io('https://elemars.herokuapp.com/', {autoConnect: false});

    socket.on('connect', () => {
        document.querySelector('#start-multi-game-btn').classList.remove('hidden');
    });

    socket.on('createSuccess', () => {
        document.querySelector('.join-link').innerHTML =
            'https://elemars.netlify.app/join/join';
    });

    socket.on('createFail', errMsg => {
        alert('Не удалось создать игру! ', errMsg);
    });

    socket.on('joinSuccess', data => {
        document.querySelector('.players-num').innerHTML = data.players.length;
        otherPlayers = data.players.filter(player => player.id !== clientId);
        level = data.level;
    });

    socket.on('joinFail', errMsg => {
        alert('Не удалось подключится к игре! ', errMsg);
        Location.reload();
    });

    socket.on('deleteSuccess', errMsg => {
        console.log('Сессия игры удалена!');
    });

    socket.on('start', () => {
        startGame();
    });

    socket.on('clientPressButton', data => {
        otherPlayers.map(otherPlayer => {
            if (otherPlayer.id === data.clientId) {
                otherPlayer.pressedButtons[data.pressedButton] = true;
            }
        });
    });

    socket.on('clientReleaseButton', data => {
        otherPlayers.map(otherPlayer => {
            if (otherPlayer.id === data.clientId) {
                otherPlayer.pressedButtons[data.releasedButton] = false;
            }
        });
    });

    socket.connect();
}

function createMultiplayerGame() {
    socket.emit('deleteGame', gameId);
    gameId = 'example';
    socket.emit('create', {
        gameId: gameId,
        level: level,
    });
    socket.emit('join', {
        clientId: clientId,
        gameId: gameId,
        character: selectedCharacter,
    });
}

assetLoader.downloadAll();
initSocket();
