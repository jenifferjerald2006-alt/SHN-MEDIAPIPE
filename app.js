const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");

const status = document.getElementById("status");
const hint = document.getElementById("hint");

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

const previousBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
const resetBtn = document.getElementById("reset");

const stepNumber = document.getElementById("stepNumber");
const stepTitle = document.getElementById("stepTitle");
const stepDescription = document.getElementById("stepDescription");
const stepEmoji = document.getElementById("stepEmoji");
const progressBar = document.getElementById("progressBar");

// Recipe data
const recipe = [
    {
        title: "Prepare the ingredients",
        description: "Wash the vegetables and prepare your ingredients.",
        emoji: "🥕"
    },
    {
        title: "Chop the vegetables",
        description: "Carefully chop the carrots, onions and capsicum.",
        emoji: "🔪"
    },
    {
        title: "Boil the pasta",
        description: "Boil water in a pot and cook the pasta until soft.",
        emoji: "🍝"
    },
    {
        title: "Prepare the sauce",
        description: "Heat oil, add vegetables and cook with tomato sauce.",
        emoji: "🍅"
    },
    {
        title: "Mix and serve",
        description: "Mix the pasta with the sauce. Serve and enjoy!",
        emoji: "🍽️"
    }
];

let currentStep = 0;
let camera = null;
let active = false;
let paused = false;

let previousX = null;
let previousTime = 0;
let lastSwipeTime = 0;
let fistStartTime = 0;
let openPalmStartTime = 0;

// Display recipe step
function updateRecipe() {
    const step = recipe[currentStep];

    stepNumber.textContent =
        `STEP ${currentStep + 1} / ${recipe.length}`;

    stepTitle.textContent = step.title;
    stepDescription.textContent = step.description;
    stepEmoji.textContent = step.emoji;

    progressBar.style.width =
        `${((currentStep + 1) / recipe.length) * 100}%`;
}

// Go to next step
function nextStep() {
    if (currentStep < recipe.length - 1) {
        currentStep++;
        updateRecipe();
        status.textContent = "Next recipe step ➡️";
    } else {
        status.textContent = "Recipe completed! 🎉";
    }
}

// Go to previous step
function previousStep() {
    if (currentStep > 0) {
        currentStep--;
        updateRecipe();
        status.textContent = "Previous recipe step ⬅️";
    }
}

// Reset recipe
function resetRecipe() {
    currentStep = 0;
    paused = false;
    updateRecipe();
    status.textContent = active
        ? "Recipe restarted"
        : "Camera is off";
}

// Calculate distance
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

// Detect raised fingers
function isFingerUp(landmarks, tip, pip) {
    return landmarks[tip].y < landmarks[pip].y;
}

// Detect fist
function isFist(landmarks) {
    const index = isFingerUp(landmarks, 8, 6);
    const middle = isFingerUp(landmarks, 12, 10);
    const ring = isFingerUp(landmarks, 16, 14);
    const pinky = isFingerUp(landmarks, 20, 18);

    return !index && !middle && !ring && !pinky;
}

// Detect open palm
function isOpenPalm(landmarks) {
    const index = isFingerUp(landmarks, 8, 6);
    const middle = isFingerUp(landmarks, 12, 10);
    const ring = isFingerUp(landmarks, 16, 14);
    const pinky = isFingerUp(landmarks, 20, 18);

    return index && middle && ring && pinky;
}

// Handle MediaPipe results
function onResults(results) {
    octx.clearRect(0, 0, overlay.width, overlay.height);

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {
        previousX = null;
        fistStartTime = 0;
        openPalmStartTime = 0;

        status.textContent = active
            ? "Show your hand to the camera"
            : "Camera is off";

        return;
    }

    const landmarks = results.multiHandLandmarks[0];

    // Draw hand landmarks
    drawConnectors(
        octx,
        landmarks,
        HAND_CONNECTIONS,
        { color: "#00cec9", lineWidth: 3 }
    );

    drawLandmarks(
        octx,
        landmarks,
        { color: "#ffffff", lineWidth: 1, radius: 3 }
    );

    const now = Date.now();

    const indexUp = isFingerUp(landmarks, 8, 6);
    const openPalm = isOpenPalm(landmarks);
    const fist = isFist(landmarks);

    // Open palm: resume recipe
    if (openPalm) {
        previousX = null;
        fistStartTime = 0;

        if (openPalmStartTime === 0) {
            openPalmStartTime = now;
        }

        if (now - openPalmStartTime > 1000) {
            paused = false;
            status.textContent = "Recipe resumed ✋";
        }

        return;
    } else {
        openPalmStartTime = 0;
    }

    // Fist: pause recipe
    if (fist) {
        previousX = null;
        openPalmStartTime = 0;

        if (fistStartTime === 0) {
            fistStartTime = now;
        }

        if (now - fistStartTime > 700) {
            paused = true;
            status.textContent = "Recipe paused ✊";
        }

        return;
    } else {
        fistStartTime = 0;
    }

    if (paused) {
        status.textContent = "Paused - show open palm to resume";
        previousX = null;
        return;
    }

    // Swipe detection using index fingertip
    if (indexUp) {
        const x = landmarks[8].x;

        if (previousX !== null) {
            const movement = x - previousX;

            if (
                Math.abs(movement) > 0.12 &&
                now - lastSwipeTime > 1200
            ) {
                // Camera image is mirrored
                if (movement < 0) {
                    nextStep();
                } else {
                    previousStep();
                }

                lastSwipeTime = now;
                previousX = null;
                return;
            }
        }

        previousX = x;
        previousTime = now;

        status.textContent = "Index finger detected ☝️";
    } else {
        previousX = null;
        status.textContent = "Hand detected - ready";
    }
}

// MediaPipe setup
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.6
});

hands.onResults(onResults);

// Start camera
startBtn.addEventListener("click", async () => {
    if (active) return;

    try {
        camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 640,
            height: 480
        });

        await camera.start();

        active = true;
        paused = false;

        startBtn.disabled = true;
        stopBtn.disabled = false;

        hint.style.display = "none";

        status.textContent = "Camera running - show your hand";

    } catch (error) {
        status.textContent =
            "Camera access denied or unavailable";

        console.error(error);
    }
});

// Stop camera
stopBtn.addEventListener("click", () => {
    if (camera) {
        camera.stop();
        camera = null;
    }

    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => {
            track.stop();
        });

        video.srcObject = null;
    }

    active = false;
    paused = false;

    previousX = null;

    startBtn.disabled = false;
    stopBtn.disabled = true;

    status.textContent = "Camera is off";
    hint.style.display = "block";

    octx.clearRect(0, 0, overlay.width, overlay.height);
});

// Buttons
nextBtn.addEventListener("click", nextStep);
previousBtn.addEventListener("click", previousStep);
resetBtn.addEventListener("click", resetRecipe);

// Initial setup
updateRecipe();

// Stop camera when page closes
window.addEventListener("beforeunload", () => {
    if (camera) {
        camera.stop();
    }
});