const PLAYER_STATUSES = {
    running: 'running',
    jumping: 'jumping',
    dead: 'dead',
};

const CHARACTERS = {
    ICE: 'ice',
    FIRE: 'fire',
    WATER: 'water',
    ACID: 'acid',
};

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
let gameOverPopupIsShowed; // Булевая переменная отображения конца игры
let ground = []; // Земля и платформы
let obstacles = []; // Препятствия
let selectedCharacter = CHARACTERS.ICE; // Выбранный персонаж
let level = 1; // Выбранный уровень сложности
let player; // Текущий персонаж
let otherPlayers = []; // Персонажи других игроков

let bestScore = JSON.parse(localStorage.getItem('bestScore')); // Лучший локально сохранённый результат: {name, score, character}
if (!bestScore) bestScore = { score: 0 };
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
const clientId = rand(2, 100).toString();

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
        bg: './../img/map/sky.jpg',
        bg2: './../img/map/sky-2.jpg',
        bg3: './../img/map/sky-3.jpg',

        iceRun: './../img/ice/ice_run.png',
        iceJump: './../img/ice/ice_jump.png',
        iceDeath: './../img/ice/ice_death.png',

        fireRun: './../img/fire/fire_run.png',
        fireJump: './../img/fire/fire_jump.png',
        fireDeath: './../img/fire/fire_death.png',

        waterRun: './../img/water/water_run.png',
        waterJump: './../img/water/water_run.png',
        waterDeath: './../img/water/water_run.png',

        acidRun: './../img/acid/acid_run.png',
        acidJump: './../img/acid/acid_run.png',
        acidDeath: './../img/acid/acid_run.png',

        cloud1: './../img/map/clouds/cloud-1.png',
        cloud2: './../img/map/clouds/cloud-2.png',
        cloud3: './../img/map/clouds/cloud-3.png',
        cloud4: './../img/map/clouds/cloud-4.png',

        tree1: './../img/map/forest/tree-1.png',
        tree2: './../img/map/forest/tree-2.png',
        tree3: './../img/map/forest/tree-3.png',

        bush1: './../img/map/forest/bush-1.png',
        bush2: './../img/map/forest/bush-2.png',
        bush3: './../img/map/forest/bush-3.png',
        bush4: './../img/map/forest/bush-4.png',
        bush5: './../img/map/forest/bush-5.png',
        bush6: './../img/map/forest/bush-6.png',

        grass: './../img/map/ground.png',
        water: './../img/map/obstacles/water.png',

        smallPlatform: './../img/map/obstacles/small-platform.png',
        bigPlatform: './../img/map/obstacles/big-platform.png',
        log: './../img/map/obstacles/log.png',
        brokenTree: './../img/map/obstacles/broken-tree.png',
        meteorite: './../img/map/obstacles/meteorite.png',
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
        const { finished, totalAssest, progress } = this;

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
        const { sounds } = this;
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
    player.width = 500;
    player.height = 458;
    player.speed = 5 + 5 * level;
    player.dy = 0;

    // Параметры прыжка
    if (level === 1) {
        player.gravity = 0.4;
        player.jumpDy = -20;
    } else {
        player.gravity = 1;
        player.jumpDy = -30;
    }

    // Spritesheets
    player.runSheet = new SpriteSheet(
        './../img/' + selectedCharacter + '/' + selectedCharacter + '_run.png',
        player.width,
        player.height,
    );
    player.jumpSheet = new SpriteSheet(
        './../img/' + selectedCharacter + '/' + selectedCharacter + '_jump.png',
        player.width,
        player.height,
    );
    player.deathSheet = new SpriteSheet(
        './../img/' + selectedCharacter + '/' + selectedCharacter + '_death.png',
        player.width,
        player.height,
    );
    player.runAnim = new Animation(player.runSheet, 2, 0, 26);
    player.jumpAnim = new Animation(player.jumpSheet, 2, 0, 26);
    player.deathAnim = new Animation(player.deathSheet, 1, 0, 24, true);
    player.anim = player.runAnim;

    Vector.call(player, 0, 0, 0, player.dy);

    /**
     * Обновление данных о персонаже и перерисовка спрайта
     */
    player.update = function () {
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
    otherPlayer.width = 500;
    otherPlayer.height = 458;

    // Spritesheets
    otherPlayer.runSheet = new SpriteSheet(
        './../img/' + otherPlayer.character + '/' + otherPlayer.character + '_run.png',
        otherPlayer.width,
        otherPlayer.height,
    );
    otherPlayer.jumpSheet = new SpriteSheet(
        './../img/' + otherPlayer.character + '/' + otherPlayer.character + '_jump.png',
        otherPlayer.width,
        otherPlayer.height,
    );
    otherPlayer.deathSheet = new SpriteSheet(
        './../img/' + otherPlayer.character + '/' + otherPlayer.character + '_death.png',
        otherPlayer.width,
        otherPlayer.height,
    );
    otherPlayer.runAnim = new Animation(otherPlayer.runSheet, 2, 0, 26);
    otherPlayer.jumpAnim = new Animation(otherPlayer.jumpSheet, 2, 0, 26);
    otherPlayer.deathAnim = new Animation(otherPlayer.deathSheet, 2, 0, 24, true);
    otherPlayer.anim = otherPlayer.runAnim;

    /**
     * Обновление данных о персонаже и перерисовка спрайта
     */
    otherPlayer.update = function () {
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

    /**
     * Отрисовка персонажа
     */
    otherPlayer.draw = function () {
        otherPlayer.anim.draw(otherPlayer.x, otherPlayer.y + 70);
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

    for (let i = 0; i < ground.elements.length; i++) {
        switch (Math.floor(i / groundElementsPerScreen)) {
            case 0:
                ground.elements[i].x += -1 * frontForestWidth + ground.x;
                ground.elements[i].draw();
                ground.elements[i].x -= -1 * frontForestWidth + ground.x;
                break;
            case 1:
                ground.elements[i].x += ground.x;
                ground.elements[i].draw();
                ground.elements[i].x -= ground.x;
                break;
            case 2:
                ground.elements[i].x += frontForestWidth + ground.x;
                ground.elements[i].draw();
                ground.elements[i].x -= frontForestWidth + ground.x;
        }
    }
}

/**
 * Обновление состояния всех препятствий, обработка столкновения персонажа с препятствием
 */
function updateObstacles() {
    const obstacleElementsPerScreen = 2; // Вода и препятствие

    // Анимация препятствий
    for (let i = 0; i < obstacles.elements.length; i++) {
        switch (Math.floor(i / obstacleElementsPerScreen)) {
            case 0:
                obstacles.elements[i].x += -1 * frontForestWidth + obstacles.x;
                obstacles.elements[i].draw();
                obstacles.elements[i].x -= -1 * frontForestWidth + obstacles.x;
                break;
            case 1:
                obstacles.elements[i].x += obstacles.x;
                obstacles.elements[i].draw();
                obstacles.elements[i].x -= obstacles.x;
                break;
            case 2:
                obstacles.elements[i].x += frontForestWidth + obstacles.x;
                obstacles.elements[i].draw();
                obstacles.elements[i].x -= frontForestWidth + obstacles.x;
        }
    }
}

/**
 * Обновление состояния персонажа
 */
function updatePlayer() {
    player.update();
    player.draw();
}

function updateOtherPlayers() {
    otherPlayers.map(otherPlayer => {
        otherPlayer.update();
        otherPlayer.draw();
    });
}

/**
 * Game loop
 */
function animate() {
    if (player.status !== PLAYER_STATUSES.dead) score++;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.draw();
    // Отрисовка текущего счёта
    ctx.fillText('Счёт: ' + score, canvas.width - 200, 75);
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
        socket.emit('clientPressButton', {
            clientId: clientId,
            pressedButton: e.code,
        });
    }
};
document.onkeyup = function (e) {
    if (KEY_STATUS.hasOwnProperty(e.code)) {
        e.preventDefault();
        socket.emit('clientReleaseButton', {
            clientId: clientId,
            releasedButton: e.code,
        });
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
                socket.emit('disconnect', { gameId: gameId, playerId: player.id });
                otherPlayers = [];

                document.querySelector('#credits').style.display = 'none';
                document.querySelector('#game-over').style.display = 'none';
                document.querySelector('#main').style.display = 'block';
                document.querySelector('#menu').style.display = 'block';
                document.querySelector('#menu').classList.remove('credits');
            }),
    );

    document.querySelector('#join-game-btn').onclick = function () {
        joinMultiplayerGame();
    };
}

// document.querySelector('.restart').onclick = function () {
//     document.querySelector('#game-over').style.display = 'none';
//     startGame();
// };

for (let ch in CHARACTERS) {
    document.querySelector('#' + CHARACTERS[ch]).onclick = function () {
        selectedCharacter = CHARACTERS[ch];
        updateInterface();
        this.classList.add('button_active');
    };
}

function updateInterface() {
    for (let ch in CHARACTERS) {
        document.querySelector('#' + CHARACTERS[ch]).classList.remove('button_active');
        document.querySelectorAll('button').forEach(el => {
            el.classList.remove(CHARACTERS[ch]);
            el.classList.add(selectedCharacter);
        });
    }
}

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
        const file = new Blob([content], { type: contentType });

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
            ' очков!';
    }

    downloadToFile(text, 'Рекорд.txt', 'text/plain');
};

/**
 * Начало игры
 */
function startGame() {
    document.querySelector('#multi-game-preview').style.display = 'none';
    document.querySelector('#menu').style.display = 'none';

    player = createPlayer(Object.create(Vector.prototype));
    otherPlayers = otherPlayers.map(otherPlayer => createOtherPlayer(otherPlayer));
    document.querySelector('#game-over').style.display = 'none';
    gameOverPopupIsShowed = false;
    score = 0;

    ctx.font = '900 32px "Franklin Gothic Medium", sans-serif';

    background.reset();
}

/**
 * Конец игры
 */
function gameOver() {
    gameOverPopupIsShowed = true;
    document.querySelector('#score').innerHTML = score;
    document.querySelector('#game-over').style.display = 'block';

    const saveResultDiv = document.querySelector('.save_result_container');
    if (score > bestScore.score) saveResultDiv.classList.remove('hidden');
    else saveResultDiv.classList.add('hidden');
}

function initSocket() {
    socket = io('https://elemars.herokuapp.com/', {autoConnect: false});

    socket.on('connect', () => {
        document.querySelector('#join-game-btn').classList.remove('hidden');
    });

    socket.on('joinSuccess', data => {
        document.querySelector('#main').style.display = 'none';
        document.querySelector('#multi-game-preview').style.display = 'block';
        document.querySelector('.players-num').innerHTML = data.players.length;
        otherPlayers = data.players.filter(player => player.id !== clientId);
        level = data.level;
    });

    socket.on('joinFail', errMsg => {
        alert('Не удалось подключится к игре! ' + errMsg);
    });

    socket.on('disconnectSuccess', data => {
        document.querySelector('.players-num').innerHTML = data.players.length;
        otherPlayers = data.players.filter(player => player.id !== clientId);
    });

    socket.on('deleteSuccess', () => {
        console.log('Сессия игры удалена!');
    });

    socket.on('update', data => {
        data.players
            .filter(player => player.id === clientId)
            .map(curPlayer => {
                player.x = curPlayer.x;
                player.y = curPlayer.y;
                player.status = curPlayer.status;
            });
        otherPlayers.forEach(oPlayer =>
            data.players
                .filter(curPlayer => oPlayer.id === curPlayer.id)
                .map(curPlayer => {
                    oPlayer.x = curPlayer.x;
                    oPlayer.y = curPlayer.y;
                    oPlayer.status = curPlayer.status;
                }),
        );

        obstacles.x = data.obstacles.x;
        obstacles.elements = [];
        data.obstacles.elements.map(obstacle =>
            obstacles.elements.push(
                new Sprite(
                    obstacle.x,
                    obstacle.y,
                    obstacle.width,
                    obstacle.height,
                    obstacle.type,
                ),
            ),
        );

        ground.x = data.ground.x;
        ground.elements = [];
        data.ground.elements.map(groundElement =>
            ground.elements.push(
                new Sprite(
                    groundElement.x,
                    groundElement.y,
                    groundElement.width,
                    groundElement.height,
                    groundElement.type,
                ),
            ),
        );
        animate();
        updateGround();
        updateObstacles();
        updateOtherPlayers();
        updatePlayer();

        if (!gameOverPopupIsShowed && player.status === PLAYER_STATUSES.dead) gameOver();
    });

    socket.on('start', () => {
        startGame();
    });

    socket.connect();
}

function joinMultiplayerGame() {
    gameId = 'example';
    socket.emit('join', {
        clientId: clientId,
        gameId: gameId,
        character: selectedCharacter,
    });
}

assetLoader.downloadAll();
initSocket();
