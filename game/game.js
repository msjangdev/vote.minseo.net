// Firebase 설정 정보 (Firebase 콘솔에서 복사한 내용)
var firebaseConfig = {
    apiKey: "AIzaSyAc516mkGvzpvloI6Rlq4Y_Zjd3PZNjMUg",
    authDomain: "minseo-vote-game.firebaseapp.com",
    databaseURL: "https://minseo-vote-game-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "minseo-vote-game",
    storageBucket: "minseo-vote-game.firebasestorage.app",
    messagingSenderId: "459457189180",
    appId: "1:459457189180:web:f921d96074df13156e7a39",
    measurementId: "G-YFMH3NYFR8"
};
// Firebase 초기화
firebase.initializeApp(firebaseConfig);
var database = firebase.database();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 터치 줌 방지
document.addEventListener('gesturestart', function (event) {
    event.preventDefault();
});

// Ctrl + 휠 줌 방지
document.addEventListener('wheel', function (event) {
    if (event.ctrlKey) {
        event.preventDefault();
    }
}, { passive: false });

// 이미지 로드
const characterImg = new Image();
const characterPlusImg = new Image();
const characterMinusImg = new Image();

const itemImageSources = ["item1.png", "item2.png", "item3.png", "item4.png", "item5.png"];
const obstacleImageSources = ["da1.png", "da2.png"];
const powerUpImg = new Image();

let currentCharacterImg = characterImg;

const itemImages = [];
const obstacleImages = [];

let imagesToLoad = 0; // 로드해야 할 이미지 수
let imagesLoaded = 0; // 로드된 이미지 수

function imageLoaded() {
    imagesLoaded++;
    if (imagesLoaded === imagesToLoad) {
        // 모든 이미지가 로드되면 랭킹 표시
        displayHighScores();
    }
}

// 캐릭터 이미지 로드
imagesToLoad += 3;
characterImg.onload = imageLoaded;
characterPlusImg.onload = imageLoaded;
characterMinusImg.onload = imageLoaded;
characterImg.src = "character.png";
characterPlusImg.src = "character_plus.png";
characterMinusImg.src = "character_minus.png";

// 아이템 이미지 로드
imagesToLoad += itemImageSources.length;
for (const src of itemImageSources) {
    const img = new Image();
    img.onload = imageLoaded;
    img.src = src;
    itemImages.push(img);
}

// 장애물 이미지 로드
imagesToLoad += obstacleImageSources.length;
for (const src of obstacleImageSources) {
    const img = new Image();
    img.onload = imageLoaded;
    img.src = src;
    obstacleImages.push(img);
}

// 파워업 이미지 로드
imagesToLoad += 1;
powerUpImg.onload = imageLoaded;
powerUpImg.src = "powerup.png";

// 게임 변수
let score = 0;
let lives = 3;
let isGameOver = false;
let gameSpeed = 1;
let spawnInterval = 1000;
let powerUpActive = false;
let powerUpTimer = 0;
let notificationTimer = 0;
let timeElapsed = 0; // 경과 시간 (초 단위)

// 캐릭터 설정
const character = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 100,
    width: 50,
    height: 50,
    speed: 5,
    maxSpeed: 7, // 캐릭터의 최대 속도 제한
    moveLeft: false,
    moveRight: false
};

// 아이템과 장애물 설정
const objects = [];

// 키 입력 처리 (데스크톱 용)
document.addEventListener("keydown", event => {
    if (event.code === "ArrowLeft") character.moveLeft = true;
    if (event.code === "ArrowRight") character.moveRight = true;
});

document.addEventListener("keyup", event => {
    if (event.code === "ArrowLeft") character.moveLeft = false;
    if (event.code === "ArrowRight") character.moveRight = false;
});

// 터치 버튼 이벤트 처리 (모바일 용)
document.getElementById("leftButton").addEventListener("touchstart", () => character.moveLeft = true);
document.getElementById("leftButton").addEventListener("touchend", () => character.moveLeft = false);

document.getElementById("rightButton").addEventListener("touchstart", () => character.moveRight = true);
document.getElementById("rightButton").addEventListener("touchend", () => character.moveRight = false);

// 마우스 버튼 이벤트 처리 (데스크톱에서 테스트 용)
document.getElementById("leftButton").addEventListener("mousedown", () => character.moveLeft = true);
document.getElementById("leftButton").addEventListener("mouseup", () => character.moveLeft = false);

document.getElementById("rightButton").addEventListener("mousedown", () => character.moveRight = true);
document.getElementById("rightButton").addEventListener("mouseup", () => character.moveRight = false);

// 알림 메시지 표시
function showNotification(message, color) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.style.color = color;
    notification.style.display = 'block';
    notificationTimer = 60; // 알림 표시 시간 (프레임 수 기준)
}

// 객체 생성
function spawnObject() {
    const rand = Math.random();
    let obj = null;

    // 확률 조정
    let obstacleProbability = 0.05 + Math.min(timeElapsed * 0.01, 0.3); // 장애물 확률 (최대 90%)
    let itemProbability = 1; // 아이템 확률 (약간 증가)
    let powerUpProbability = 0.05; // 파워업 확률 (크게 감소)

    if (rand < obstacleProbability) {
        // 장애물 생성
        const img = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
        obj = {
            x: Math.random() * (canvas.width - 50),
            y: -50,
            width: 35,
            height: 35,
            speed: (6 + Math.random() * 4) * gameSpeed, // 속도 증가
            img,
            type: "obstacle"
        };
    } else if (rand < obstacleProbability + itemProbability) {
        // 아이템 생성
        const img = itemImages[Math.floor(Math.random() * itemImages.length)];
        obj = {
            x: Math.random() * (canvas.width - 50),
            y: -50,
            width: 55,
            height: 55,
            speed: (6 + Math.random() * 4) * gameSpeed,
            img,
            type: "item"
        };
    } else {
        // 파워업 생성 (확률 낮춤)
        obj = {
            x: Math.random() * (canvas.width - 50),
            y: -50,
            width: 35,
            height: 35,
            speed: (6 + Math.random() * 4) * gameSpeed,
            img: powerUpImg,
            type: "powerup"
        };
    }

    objects.push(obj);

    // 생성 간격 조절
    clearInterval(spawnObjectInterval);
    spawnInterval = Math.max(300, spawnInterval - 20); // 최소 300ms까지 감소
    spawnObjectInterval = setInterval(spawnObject, spawnInterval);
}

// 충돌 체크
function isColliding(obj1, obj2) {
    return (
        obj1.x < obj2.x + obj2.width &&
        obj1.x + obj1.width > obj2.x &&
        obj1.y < obj2.y + obj2.height &&
        obj1.y + obj1.height > obj2.y
    );
}

// 게임 업데이트
function update() {
    if (isGameOver) return;

    // 캐릭터 이동 (벽에 끼이지 않도록 수정)
    if (character.moveLeft) {
        character.x = Math.max(0, character.x - character.speed);
    }
    if (character.moveRight) {
        character.x = Math.min(canvas.width - character.width, character.x + character.speed);
    }

    // 객체 이동
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        obj.y += obj.speed;

        // 충돌 처리
        if (isColliding(character, obj)) {
            if (obj.type === "item") {
                score++;
                currentCharacterImg = characterPlusImg;
                showNotification("+1", "green");

                // 캐릭터 이미지 원상복구 예약
                setTimeout(() => {
                    currentCharacterImg = characterImg;
                }, 500);

            } else if (obj.type === "obstacle") {
                if (!powerUpActive) {
                    lives--;
                    currentCharacterImg = characterMinusImg;
                    showNotification("생명 -1", "red");

                    // 캐릭터 이미지 원상복구 예약
                    setTimeout(() => {
                        currentCharacterImg = characterImg;
                    }, 500);

                    if (lives <= 0) {
                        isGameOver = true;
                        endGame();
                    }
                }
            } else if (obj.type === "powerup") {
                powerUpActive = true;
                powerUpTimer = 3; // 무적 시간 3초로 감소
                showNotification("무적!", "blue");
            }
            objects.splice(i, 1); // 충돌한 객체 제거
        } else if (obj.y > canvas.height) {
            objects.splice(i, 1); // 화면 밖으로 나간 객체 제거
        }
    }

    // 파워업 시간 관리
    if (powerUpActive) {
        powerUpTimer -= 1 / 60;
        if (powerUpTimer <= 0) {
            powerUpActive = false;
            showNotification("무적 해제", "white");
        }
    }

    // 알림 메시지 숨기기
    if (notificationTimer > 0) {
        notificationTimer--;
        if (notificationTimer === 0) {
            document.getElementById("notification").style.display = 'none';
        }
    }

    // 난이도 증가
    gameSpeed += 0.001; // 속도 증가 폭 상승
    character.speed = Math.min(character.maxSpeed, character.speed + 0.0002); // 최대 속도 제한

    // 경과 시간 업데이트
    timeElapsed += 1 / 60;
}

// 게임 렌더링
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 캐릭터 그리기
    ctx.drawImage(currentCharacterImg, character.x, character.y, character.width, character.height);

    // 아이템 및 장애물 그리기
    for (const obj of objects) {
        ctx.drawImage(obj.img, obj.x, obj.y, obj.width, obj.height);
    }

    // 점수와 생명 업데이트
    document.getElementById("score").textContent = `점수: ${score}`;

    const livesContainer = document.getElementById("lives");
    livesContainer.textContent = ''; // 이전 내용 지우기
    for (let i = 0; i < lives; i++) {
        livesContainer.textContent += '❤️';
    }
}

// 게임 종료 처리
// 게임 종료 처리
function endGame() {
    // 게임 루프 중지
    isGameOver = true;

    // 알림 메시지 숨기기
    document.getElementById("notification").style.display = 'none';
    notificationTimer = 0; // 타이머 초기화

    // 최종 점수 표시
    document.getElementById("finalScore").textContent = `최종 점수: ${score}`;
    // 모달 창 표시
    $('#gameOverModal').modal('show');
    clearInterval(spawnObjectInterval); // 오브젝트 생성 중지
}


// 점수 저장 (Firebase 사용)
function saveScoreToFirebase(name, score) {
    const scoresRef = database.ref('scores');
    const newScoreRef = scoresRef.push();
    newScoreRef.set({
        name: name,
        score: score
    }).then(() => {
        // 점수 저장 완료 후 랭킹 업데이트
        displayHighScores();
    }).catch(error => {
        alert('점수 저장 중 오류가 발생했습니다: ' + error.message);
    });
}

// 점수 저장 버튼 이벤트
document.getElementById("saveScoreButton").addEventListener("click", () => {
    const playerName = document.getElementById("playerName").value || "Unknown";
    saveScoreToFirebase(playerName, score);
    $('#gameOverModal').modal('hide');
    // 게임 요소 숨기기
    canvas.style.display = 'none';
    document.getElementById("gameInfo").style.display = 'none';
    document.querySelector('.control-buttons').style.display = 'none';
    // 시작 화면 보이기
    document.getElementById("startScreen").style.display = 'block';
    // 게임 종료 후 전체 화면을 종료하지 않음
});

// '다시하기' 버튼 이벤트
document.getElementById("retryButton").addEventListener("click", () => {
    $('#gameOverModal').modal('hide');
    // 게임 재시작
    resetGame();
});

// 게임 초기화 함수 추가
function resetGame() {
    // 변수 초기화
    score = 0;
    lives = 3;
    isGameOver = false;
    gameSpeed = 0.3;
    spawnInterval = 1000;
    powerUpActive = false;
    powerUpTimer = 0;
    notificationTimer = 0;
    timeElapsed = 0;

    // 캐릭터 위치 초기화
    character.x = canvas.width / 2 - 25;

    // 오브젝트 배열 초기화
    objects.length = 0;

    // 게임 정보 업데이트
    document.getElementById("score").textContent = `점수: ${score}`;
    const livesContainer = document.getElementById("lives");
    livesContainer.textContent = '❤️❤️❤️';

    // 오브젝트 생성 재시작
    clearInterval(spawnObjectInterval);
    spawnObjectInterval = setInterval(spawnObject, spawnInterval);

    // 게임 루프 재시작
    gameLoop();
}

// 게임 루프
function gameLoop() {
    update();
    render();
    if (!isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// 게임 시작 함수 수정
function startGame() {
    // 시작 화면 숨기기
    document.getElementById("startScreen").style.display = 'none';
    // 게임 요소 보이기
    canvas.style.display = 'block';
    document.getElementById("gameInfo").style.display = 'flex';
    document.querySelector('.control-buttons').style.display = 'flex';

    // 캔버스 크기 조정
    adjustCanvasSize();

    // 전체 화면 요청
    //enterFullScreen();

    // 게임 초기화
    resetGame();
}

// 캔버스 크기를 창 크기에 맞게 조정
function adjustCanvasSize() {
    const containerWidth = document.body.clientWidth;
    const maxWidth = 600; // 최대 너비 설정
    const canvasWidth = Math.min(containerWidth, maxWidth);
    const canvasHeight = canvasWidth * 1; // 2:3 비율 유지

    canvas.width = 400; // 그림 좌표계는 그대로 유지
    canvas.height = 375;

    // 캔버스 스타일 크기 조정
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
}

let spawnObjectInterval;

// 시작 버튼 이벤트
document.getElementById("startButton").addEventListener("click", () => {
    startGame();
});

// 상위 랭킹 표시 (Firebase 사용)
function displayHighScores() {
    const highScoresList = document.getElementById("highScoresList");
    const scoresRef = database.ref('scores');
    scoresRef.orderByChild('score').limitToLast(5).once('value', snapshot => {
        const scores = [];
        snapshot.forEach(childSnapshot => {
            scores.push(childSnapshot.val());
        });
        // 점수 내림차순으로 정렬
        scores.sort((a, b) => b.score - a.score);
        highScoresList.innerHTML = scores
            .map(score => {
                // 이름과 점수를 3자로 제한하고 이스케이프 처리
                const safeName = escapeHTML(score.name.substring(0, 3));
                const safeScore = escapeHTML(score.score.toString().substring(0, 3));
                return `<li>${safeName} - ${safeScore}점</li>`;
            })
            .join('');
    });
}

// 이미지 로드가 완료되면 displayHighScores()가 호출됩니다.
window.onload = () => {
    // 이미지 로드 완료 대기
};

// 전체 화면 전환 함수
function enterFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

// XSS 방지를 위한 이스케이프 함수
function escapeHTML(str) {
    if (typeof str !== 'string') {
        str = String(str);
    }
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}
