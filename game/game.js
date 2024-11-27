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
        // 모든 이미지가 로드되면 게임 시작 가능
        startGame(); // 게임 시작
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
    width: 75,
    height: 75,
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
    let obstacleProbability = 0.6 + Math.min(timeElapsed * 0.01, 0.3); // 장애물 확률 (최대 90%)
    let itemProbability = 0.35; // 아이템 확률 (약간 증가)
    let powerUpProbability = 0.05; // 파워업 확률 (크게 감소)

    if (rand < obstacleProbability) {
        // 장애물 생성
        const img = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
        obj = {
            x: Math.random() * (canvas.width - 50),
            y: -50,
            width: 50,
            height: 50,
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
            width: 50,
            height: 50,
            speed: (6 + Math.random() * 4) * gameSpeed,
            img,
            type: "item"
        };
    } else {
        // 파워업 생성 (확률 낮춤)
        obj = {
            x: Math.random() * (canvas.width - 50),
            y: -50,
            width: 50,
            height: 50,
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
function endGame() {
    isGameOver = true;

    // 게임 오버 화면 표시
    showGameOverScreen();

    // 메인 창에 점수 전달
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GAME_OVER', score: score }, '*');
    } else {
        alert('점수를 저장할 수 없습니다. 메인 창이 닫혀 있습니다.');
    } 

}

function showGameOverScreen() {
    // 전체 화면을 덮는 DIV 생성
    const gameOverDiv = document.createElement('div');
    gameOverDiv.style.position = 'fixed';
    gameOverDiv.style.top = '0';
    gameOverDiv.style.left = '0';
    gameOverDiv.style.width = '100%';
    gameOverDiv.style.height = '100%';
    gameOverDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverDiv.style.display = 'flex';
    gameOverDiv.style.flexDirection = 'column';
    gameOverDiv.style.justifyContent = 'center';
    gameOverDiv.style.alignItems = 'center';
    gameOverDiv.style.zIndex = '1000';

    // 게임 오버 메시지
    const gameOverText = document.createElement('h1');
    gameOverText.style.color = 'white';
    gameOverText.textContent = '게임 오버';

    // 최종 점수 표시
    const finalScoreText = document.createElement('p');
    finalScoreText.style.color = 'white';
    finalScoreText.textContent = `최종 점수: ${score}`;

    // 닫기 버튼
    const closeButton = document.createElement('button');
    closeButton.textContent = '닫기';
    closeButton.className = 'btn btn-primary';
    closeButton.style.marginTop = '20px';
    closeButton.addEventListener('click', () => {
        window.close();
    });

    // 요소 추가
    gameOverDiv.appendChild(gameOverText);
    gameOverDiv.appendChild(finalScoreText);
    gameOverDiv.appendChild(closeButton);

    document.body.appendChild(gameOverDiv);
}

// 점수 저장 (Firebase 사용)
function saveScoreToFirebase(name, score) {
    const scoresRef = database.ref('scores');
    const newScoreRef = scoresRef.push();
    newScoreRef.set({
        name: name,
        score: score
    });
}

// 점수 저장 버튼 이벤트
document.getElementById("saveScoreButton").addEventListener("click", () => {
    const playerName = document.getElementById("playerName").value || "Unknown";
    saveScoreToFirebase(playerName, score);
    $('#gameOverModal').modal('hide');
    window.close(); // 게임 창 닫기
});

// 다시하기 버튼 이벤트
document.getElementById("retryButton").addEventListener("click", () => {
    $('#gameOverModal').modal('hide');
    location.reload(); // 페이지 새로고침하여 게임 재시작
});

// 게임 루프
function gameLoop() {
    update();
    render();
    if (!isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// 게임 시작 함수
function startGame() {
    // 캔버스 크기 조정
    adjustCanvasSize();

    spawnObjectInterval = setInterval(spawnObject, spawnInterval);
    gameLoop();
}

// 캔버스 크기를 창 크기에 맞게 조정
function adjustCanvasSize() {
    const containerWidth = document.body.clientWidth;
    const maxWidth = 600; // 최대 너비 설정
    const canvasWidth = Math.min(containerWidth, maxWidth);
    const canvasHeight = canvasWidth * 1.5; // 2:3 비율 유지

    canvas.width = 400; // 그림 좌표계는 그대로 유지
    canvas.height = 600;

    // 캔버스 스타일 크기 조정
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
}

let spawnObjectInterval;

// 이미지 로드가 완료되면 startGame()이 호출됩니다.
