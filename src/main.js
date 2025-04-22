import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { createMaze } from './maze.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Player settings
const playerHeight = 1.8;
const moveSpeed = 0.1;
const playerRadius = 0.5;
let playerVelocity = new THREE.Vector3();

// Game state
let gameStarted = false;
let gameOver = false;
let exitNumber = 0;
let startTime = 0;
let elapsedTime = 0;
let currentCorridor = 0;
let anomalyInCorridor = false;
let discoveredAnomalies = 0;
let totalAnomalies = 5; // Total number of different anomalies in the game
let gameRound = 1;

// UI Elements
const timerElement = document.getElementById('timer');
const exitInfoElement = document.getElementById('exit-info');
const infoElement = document.getElementById('info');

// Movement keys state
const movement = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

// Corridor system
const corridorLength = 20;
const corridorWidth = 5;
const corridorHeight = 3;
const corridors = [];
const maxCorridors = 100; // Effectively infinite for the player

// Materials
const wallMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x555555,
  roughness: 0.8,
  metalness: 0.2
});

const floorMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x333333, 
  roughness: 0.9,
  metalness: 0.1
});

const exitSignMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x00ff00,
  emissive: 0x003300,
  roughness: 0.5,
  metalness: 0.3
});

// Lighting setup
function setupLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  // Create a flashlight effect attached to the player
  const flashlight = new THREE.SpotLight(0xffffff, 1.5, 15, Math.PI / 6, 0.5, 1);
  flashlight.position.set(0, 1.8, 0); // Position at player's height
  flashlight.target.position.set(0, 1.8, -1); // Point slightly forward
  
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.width = 1024;
  flashlight.shadow.mapSize.height = 1024;
  
  scene.add(flashlight);
  scene.add(flashlight.target);
  
  // Attach flashlight to camera and update it in the animation loop
  return {
    updateFlashlight: () => {
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      
      flashlight.position.copy(camera.position);
      flashlight.target.position.copy(
        camera.position.clone().add(cameraDirection.multiplyScalar(5))
      );
    }
  };
}

const lighting = setupLighting();

// Create corridor function
function createCorridor(index) {
  const corridor = new THREE.Group();
  corridor.name = `corridor-${index}`;
  
  // Floor
  const floorGeometry = new THREE.PlaneGeometry(corridorWidth, corridorLength);
  floorGeometry.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.set(0, 0, corridorLength / 2);
  floor.receiveShadow = true;
  corridor.add(floor);
  
  // Ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(corridorWidth, corridorLength);
  ceilingGeometry.rotateX(Math.PI / 2);
  const ceiling = new THREE.Mesh(ceilingGeometry, floorMaterial);
  ceiling.position.set(0, corridorHeight, corridorLength / 2);
  corridor.add(ceiling);
  
  // Left wall
  const leftWallGeometry = new THREE.PlaneGeometry(corridorLength, corridorHeight);
  leftWallGeometry.rotateY(Math.PI / 2);
  const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
  leftWall.position.set(-corridorWidth/2, corridorHeight/2, corridorLength/2);
  leftWall.receiveShadow = true;
  corridor.add(leftWall);
  
  // Right wall
  const rightWallGeometry = new THREE.PlaneGeometry(corridorLength, corridorHeight);
  rightWallGeometry.rotateY(-Math.PI / 2);
  const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
  rightWall.position.set(corridorWidth/2, corridorHeight/2, corridorLength/2);
  rightWall.receiveShadow = true;
  corridor.add(rightWall);
  
  // Far wall (only if not exit)
  if (exitNumber < 8 || anomalyInCorridor) {
    const farWallGeometry = new THREE.PlaneGeometry(corridorWidth, corridorHeight);
    const farWall = new THREE.Mesh(farWallGeometry, wallMaterial);
    farWall.position.set(0, corridorHeight/2, corridorLength);
    farWall.receiveShadow = true;
    corridor.add(farWall);
  }
  
  // Add exit sign
  const exitSign = createExitSign(exitNumber);
  exitSign.position.set(corridorWidth/2 - 0.1, corridorHeight - 0.5, 0.5);
  exitSign.rotateY(-Math.PI / 2);
  corridor.add(exitSign);
  
  // Decide if this corridor has an anomaly
  if (index > 0) { // First corridor never has anomaly
    // Randomly decide to place an anomaly (higher chance in later rounds)
    const anomalyChance = 0.3 + (gameRound * 0.05);
    if (Math.random() < anomalyChance) {
      corridor.userData.hasAnomaly = true;
      const anomalyType = Math.floor(Math.random() * totalAnomalies);
      corridor.userData.anomalyType = anomalyType;
      addAnomaly(corridor, anomalyType);
    } else {
      corridor.userData.hasAnomaly = false;
    }
  } else {
    corridor.userData.hasAnomaly = false;
  }
  
  // Position the corridor based on index
  corridor.position.z = index * corridorLength;
  
  scene.add(corridor);
  corridors.push(corridor);
  return corridor;
}

// Create exit sign with the current exit number
function createExitSign(number) {
  const group = new THREE.Group();
  
  // Sign background
  const backGeometry = new THREE.BoxGeometry(1, 0.8, 0.05);
  const backMaterial = new THREE.MeshStandardMaterial({ color: 0x004400 });
  const back = new THREE.Mesh(backGeometry, backMaterial);
  group.add(back);
  
  // Number text
  // Use a simple approach with a box instead of FontLoader
  const numGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.1);
  const numMesh = new THREE.Mesh(numGeometry, exitSignMaterial);
  numMesh.position.z = 0.08;
  group.add(numMesh);
  
  // Add point light to make the sign glow
  const light = new THREE.PointLight(0x00ff00, 0.5, 2);
  light.position.set(0, 0, 0.3);
  group.add(light);
  
  return group;
}

// Add anomalies based on type
function addAnomaly(corridor, type) {
  switch(type) {
    case 0: // Strange light
      const light = new THREE.PointLight(0xff0000, 1, 10);
      light.position.set(0, corridorHeight/2, corridorLength/2);
      corridor.add(light);
      break;
    case 1: // Floating object
      const geometry = new THREE.SphereGeometry(0.5, 32, 32);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x0000ff, 
        emissive: 0x000033,
        metalness: 0.9, 
        roughness: 0.1 
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(0, corridorHeight/2, corridorLength/2);
      corridor.add(sphere);
      break;
    case 2: // Distorted walls
      // Replace normal wall material with a distorted one
      corridor.children.forEach(child => {
        if (child.material === wallMaterial) {
          child.material = new THREE.MeshStandardMaterial({ 
            color: 0x555555,
            roughness: 0.8,
            metalness: 0.2,
            wireframe: true
          });
        }
      });
      break;
    case 3: // Flickering lights
      const flickerLight = new THREE.PointLight(0xffffff, 1, 10);
      flickerLight.position.set(0, corridorHeight - 0.1, corridorLength/2);
      flickerLight.userData.flickering = true;
      corridor.add(flickerLight);
      break;
    case 4: // Dark fog
      scene.fog = new THREE.FogExp2(0x000000, 0.2);
      corridor.userData.hasFog = true;
      break;
    default:
      // Default to red light as fallback
      const defaultLight = new THREE.PointLight(0xff0000, 1, 10);
      defaultLight.position.set(0, corridorHeight/2, corridorLength/2);
      corridor.add(defaultLight);
  }
}

// Initialize corridors
function initializeCorridors() {
  // Clear existing corridors if any
  corridors.forEach(corridor => {
    scene.remove(corridor);
  });
  corridors.length = 0;
  
  // Create initial corridors
  for (let i = 0; i < 5; i++) { // Pre-create a few corridors
    createCorridor(i);
  }
  
  // Reset player position to the start
  controls.getObject().position.set(0, playerHeight, 0);
  currentCorridor = 0;
}

// Initialize maze (for the simple version)
function initializeMaze() {
  // Create a simple maze
  const mazeWidth = 10;
  const mazeHeight = 10;
  const { maze, wallGroup, startPosition, exitPosition } = createMaze(scene, mazeWidth, mazeHeight);
  
  // Set player position to start position
  controls.getObject().position.set(startPosition.x, playerHeight, startPosition.z);
  
  // Store exit position for win condition
  const exitPos = new THREE.Vector3(exitPosition.x, 0, exitPosition.z);
  
  return { maze, wallGroup, exitPos };
}

// Reset the game
function resetGame() {
  gameStarted = false;
  gameOver = false;
  exitNumber = 0;
  currentCorridor = 0;
  anomalyInCorridor = false;
  discoveredAnomalies = 0;
  gameRound = 1;
  
  // Reset UI
  exitInfoElement.textContent = `出口番号: ${exitNumber}`;
  infoElement.textContent = '画面クリックでゲームスタート！';
  
  // Initialize game environment
  if (useSimpleMaze) {
    // Remove old maze if exists
    if (currentMaze && currentMaze.wallGroup) {
      scene.remove(currentMaze.wallGroup);
    }
    // Create new maze
    currentMaze = initializeMaze();
  } else {
    // Initialize corridors for original game
    initializeCorridors();
  }
}

// Handle player's decision
function makeDecision(goForward) {
  const currentCorridorObj = corridors[currentCorridor];
  
  if (goForward) {
    // Player chose to go forward
    if (currentCorridorObj.userData.hasAnomaly) {
      // Wrong choice - reset exit number
      exitNumber = 0;
      if (!currentCorridorObj.userData.discovered) {
        discoveredAnomalies++;
        currentCorridorObj.userData.discovered = true;
      }
    } else {
      // Correct choice - increment exit number if not at exit yet
      if (exitNumber < 8) {
        exitNumber++;
      } else {
        // Player reached the exit!
        if (gameRound === 1) {
          gameRound++;
          infoElement.textContent = `🎉 2周目スタート！残りの異変: ${totalAnomalies - discoveredAnomalies}個`;
          // Reset but keep the discovered anomalies
          exitNumber = 0;
        } else {
          // Game complete
          gameOver = true;
          const finalTime = formatTime(Date.now() - startTime);
          infoElement.textContent = `🏆 ゲームクリア！タイム: ${finalTime} / 発見した異変: ${discoveredAnomalies}/${totalAnomalies}`;
          controls.unlock();
          return;
        }
      }
    }
    
    // Move to next corridor
    currentCorridor++;
    if (currentCorridor >= corridors.length && currentCorridor < maxCorridors) {
      createCorridor(corridors.length);
    }
    
    // Move player forward
    controls.getObject().position.z += corridorLength;
  } else {
    // Player chose to go backward
    if (!currentCorridorObj.userData.hasAnomaly) {
      // Wrong choice - reset exit number
      exitNumber = 0;
    } else {
      // Correct choice - increment exit number
      if (exitNumber < 8) {
        exitNumber++;
      } else {
        // Player reached the exit!
        if (gameRound === 1) {
          gameRound++;
          infoElement.textContent = `🎉 2周目スタート！残りの異変: ${totalAnomalies - discoveredAnomalies}個`;
          // Reset but keep the discovered anomalies
          exitNumber = 0;
        } else {
          // Game complete
          gameOver = true;
          const finalTime = formatTime(Date.now() - startTime);
          infoElement.textContent = `🏆 ゲームクリア！タイム: ${finalTime} / 発見した異変: ${discoveredAnomalies}/${totalAnomalies}`;
          controls.unlock();
          return;
        }
      }
      
      if (!currentCorridorObj.userData.discovered) {
        discoveredAnomalies++;
        currentCorridorObj.userData.discovered = true;
      }
    }
    
    // Only go backward if not at the beginning
    if (currentCorridor > 0) {
      currentCorridor--;
      controls.getObject().position.z -= corridorLength;
    }
  }
  
  // Update UI
  exitInfoElement.textContent = `出口番号: ${exitNumber}`;
  
  // Check for game completion
  if (exitNumber === 8) {
    exitInfoElement.textContent = '🚪 8番出口に到達! 異変のない通路を進んでください';
    exitInfoElement.classList.add('pulse');
  } else {
    exitInfoElement.classList.remove('pulse');
  }
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game mode flag - set to true for simple maze version
const useSimpleMaze = true;
let currentMaze = null;

// Handle click to start/continue game
document.addEventListener('click', () => {
  if (!controls.isLocked) {
    if (!gameStarted || gameOver) {
      resetGame();
      gameStarted = true;
      startTime = Date.now();
    }
    controls.lock();
    
    // Update UI for simple maze version
    if (useSimpleMaze) {
      infoElement.textContent = '8番出口を目指して迷路を探索しよう！';
      exitInfoElement.textContent = '出口を探せ！';
    }
  }
});

// Key controls for movement
document.addEventListener('keydown', (event) => {
  if (!gameStarted || gameOver) return;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      movement.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      movement.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      movement.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      movement.right = true;
      break;
    case 'KeyF':
      // Go forward decision
      if (controls.isLocked) {
        makeDecision(true);
      }
      break;
    case 'KeyB':
      // Go backward decision
      if (controls.isLocked) {
        makeDecision(false);
      }
      break;
  }
});

document.addEventListener('keyup', (event) => {
  if (!gameStarted) return;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      movement.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      movement.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      movement.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      movement.right = false;
      break;
  }
});

// Format time as MM:SS
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update timer
function updateTimer() {
  if (gameStarted && !gameOver) {
    elapsedTime = Date.now() - startTime;
    timerElement.textContent = formatTime(elapsedTime);
  }
}

// Check if player is in the decision zone
function isInDecisionZone() {
  const playerZ = controls.getObject().position.z;
  const corridorZ = currentCorridor * corridorLength;
  const targetZ = corridorZ + corridorLength * 0.75; // 3/4 of the way through the corridor
  
  return Math.abs(playerZ - targetZ) < 2; // Within 2 units of the decision point
}

// Check if player reached the exit in simple maze mode
function checkMazeExit() {
  if (!currentMaze || !currentMaze.exitPos) return false;
  
  const playerPos = controls.getObject().position;
  const distance = new THREE.Vector2(playerPos.x, playerPos.z)
    .distanceTo(new THREE.Vector2(currentMaze.exitPos.x, currentMaze.exitPos.z));
  
  return distance < 2; // Within 2 units of the exit
}

// Check if player collides with walls in the maze
function checkWallCollision(position) {
  if (!currentMaze || !currentMaze.wallGroup) return false;
  
  // Create a bounding box for the player
  const playerBoundingBox = new THREE.Box3().setFromCenterAndSize(
    position,
    new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
  );
  
  // Check collision with each wall
  let collides = false;
  currentMaze.wallGroup.children.forEach(wall => {
    if (collides) return; // Skip if already colliding
    
    // Create a bounding box for the wall
    const wallBoundingBox = new THREE.Box3().setFromObject(wall);
    
    // Check if the bounding boxes intersect
    if (playerBoundingBox.intersectsBox(wallBoundingBox)) {
      collides = true;
    }
  });
  
  return collides;
}

// Game loop
function animate() {
  requestAnimationFrame(animate);
  
  if (gameStarted && !gameOver && controls.isLocked) {
    // Update player position based on input
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const forward = cameraDirection.clone();
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    
    // Calculate movement delta
    let moveDelta = new THREE.Vector3(0, 0, 0);
    
    if (useSimpleMaze) {
      // Simple maze movement
      if (movement.forward) {
        moveDelta.add(forward.multiplyScalar(moveSpeed));
      }
      
      if (movement.backward) {
        moveDelta.sub(forward.multiplyScalar(moveSpeed));
      }
      
      if (movement.left) {
        moveDelta.sub(right.multiplyScalar(moveSpeed));
      }
      
      if (movement.right) {
        moveDelta.add(right.multiplyScalar(moveSpeed));
      }
      
      // Apply movement with collision detection
      if (moveDelta.length() > 0) {
        const newPosition = controls.getObject().position.clone().add(moveDelta);
        
        // Keep player at fixed height
        newPosition.y = playerHeight;
        
        // Check for wall collision
        if (!checkWallCollision(newPosition)) {
          // No collision, update position
          controls.getObject().position.copy(newPosition);
        } else {
          // Try moving only on X axis if Z movement caused collision
          const xOnlyPosition = controls.getObject().position.clone();
          xOnlyPosition.x += moveDelta.x;
          
          if (!checkWallCollision(xOnlyPosition)) {
            controls.getObject().position.copy(xOnlyPosition);
          }
          
          // Try moving only on Z axis if X movement caused collision
          const zOnlyPosition = controls.getObject().position.clone();
          zOnlyPosition.z += moveDelta.z;
          
          if (!checkWallCollision(zOnlyPosition)) {
            controls.getObject().position.copy(zOnlyPosition);
          }
        }
      }
      
      // Check if player reached the exit
      if (checkMazeExit()) {
        gameOver = true;
        const finalTime = formatTime(Date.now() - startTime);
        infoElement.textContent = `🏆 ゲームクリア！タイム: ${finalTime}`;
        controls.unlock();
      }
    } else {
      // Original corridor movement
      // Restrict forward/backward movement to the corridor
      if (movement.forward) {
        const newZ = controls.getObject().position.z + forward.z * moveSpeed;
        const corridorBoundary = (currentCorridor + 1) * corridorLength - playerRadius;
        
        if (newZ < corridorBoundary) {
          moveDelta.add(forward.multiplyScalar(moveSpeed));
        }
      }
      
      if (movement.backward) {
        const newZ = controls.getObject().position.z - forward.z * moveSpeed;
        const corridorBoundary = currentCorridor * corridorLength + playerRadius;
        
        if (newZ > corridorBoundary) {
          moveDelta.sub(forward.normalize().multiplyScalar(moveSpeed));
        }
      }
      
      // Restrict left/right movement within corridor width
      if (movement.left || movement.right) {
        const lateralMove = right.clone().multiplyScalar(moveSpeed * (movement.right ? 1 : -1));
        const newX = controls.getObject().position.x + lateralMove.x;
        
        if (Math.abs(newX) < (corridorWidth / 2 - playerRadius)) {
          moveDelta.add(lateralMove);
        }
      }
      
      // Apply movement
      controls.getObject().position.add(moveDelta);
      
      // Keep player at fixed height
      controls.getObject().position.y = playerHeight;
      
      // Show decision prompt when in the decision zone
      if (isInDecisionZone()) {
        const currentCorridorObj = corridors[currentCorridor];
        if (currentCorridorObj.userData.hasAnomaly) {
          infoElement.textContent = '⚠️ 異変を検知! 「F」キー:進む / 「B」キー:引き返す';
        } else {
          infoElement.textContent = '✓ 通路正常 「F」キー:進む / 「B」キー:引き返す';
        }
      }
      
      // Update any dynamic anomalies
      corridors.forEach(corridor => {
        // Handle flickering lights
        corridor.children.forEach(child => {
          if (child.isLight && child.userData.flickering) {
            child.intensity = Math.random() > 0.5 ? 1 : 0.1;
          }
        });
        
        // Remove fog when leaving corridor
        if (corridor.userData.hasFog && 
            Math.abs(controls.getObject().position.z - corridor.position.z) > corridorLength) {
          scene.fog = null;
        }
      });
    }
    
    // Update flashlight
    lighting.updateFlashlight();
    
    // Update timer
    updateTimer();
  }
  
  renderer.render(scene, camera);
}

// Initialize and start the game
if (useSimpleMaze) {
  currentMaze = initializeMaze();
} else {
  initializeCorridors();
}
exitInfoElement.textContent = useSimpleMaze ? '出口を探せ！' : `出口番号: ${exitNumber}`;
animate();
