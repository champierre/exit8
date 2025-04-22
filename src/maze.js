import * as THREE from 'three';

// Create the maze and return relevant objects
export function createMaze(scene, width, height) {
  // Materials
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    roughness: 0.7,
    metalness: 0.2
  });
  
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x222222, 
    roughness: 0.9,
    metalness: 0.1
  });
  
  const exitMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    emissive: 0x003300,
    roughness: 0.5,
    metalness: 0.3
  });

  // The grid for the maze (0 = empty, 1 = wall)
  const grid = generateMaze(width, height);

  // Wall and floor groups
  const wallGroup = new THREE.Group();
  scene.add(wallGroup);

  // Create floor
  const floorGeometry = new THREE.PlaneGeometry(width * 2, height * 2);
  floorGeometry.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.set(width - 1, 0, height - 1);
  floor.receiveShadow = true;
  scene.add(floor);

  // Create ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(width * 2, height * 2);
  ceilingGeometry.rotateX(Math.PI / 2);
  const ceiling = new THREE.Mesh(ceilingGeometry, floorMaterial);
  ceiling.position.set(width - 1, 4, height - 1);
  scene.add(ceiling);

  // Wall geometry (reused for all walls)
  const wallGeometry = new THREE.BoxGeometry(2, 4, 2);

  // Create walls based on grid
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < height; z++) {
      if (grid[z][x] === 1) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(x * 2, 2, z * 2);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wallGroup.add(wall);
      }
    }
  }

  // Create outer walls
  for (let x = -1; x <= width; x++) {
    for (let z of [-1, height]) {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(x * 2, 2, z * 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wallGroup.add(wall);
    }
  }

  for (let z = 0; z < height; z++) {
    for (let x of [-1, width]) {
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(x * 2, 2, z * 2);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wallGroup.add(wall);
    }
  }

  // Find start and exit positions
  let startPosition = { x: 0, z: 0 };
  let exitPosition = { x: 0, z: 0 };

  // Find a valid start position (empty space)
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (grid[z][x] === 0) {
        startPosition = { x: x * 2, z: z * 2 };
        // Once we have a start position, break out of both loops
        z = height;
        break;
      }
    }
  }

  // Find exit position (far from start position)
  let maxDistance = 0;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (grid[z][x] === 0) {
        const distance = Math.pow(x * 2 - startPosition.x, 2) + Math.pow(z * 2 - startPosition.z, 2);
        if (distance > maxDistance) {
          maxDistance = distance;
          exitPosition = { x: x * 2, z: z * 2 };
        }
      }
    }
  }

  // Add a visual indicator for the exit
  const exitSign = new THREE.Group();
  
  // Exit platform
  const platformGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16);
  const platform = new THREE.Mesh(platformGeometry, exitMaterial);
  platform.position.y = 0.1;
  exitSign.add(platform);
  
  // Exit post
  const postGeometry = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
  const post = new THREE.Mesh(postGeometry, exitMaterial);
  post.position.y = 1.5;
  exitSign.add(post);
  
  // Exit sign board
  const signGeometry = new THREE.BoxGeometry(2, 0.8, 0.1);
  const sign = new THREE.Mesh(signGeometry, exitMaterial);
  sign.position.y = 3;
  exitSign.add(sign);
  
  exitSign.position.set(exitPosition.x, 0, exitPosition.z);
  scene.add(exitSign);

  return { maze: grid, wallGroup, startPosition, exitPosition };
}

// Generate a maze using a randomized depth-first search algorithm
function generateMaze(width, height) {
  // Initialize grid with all walls
  const grid = Array(height).fill().map(() => Array(width).fill(1));
  
  // Pick a random starting cell
  const startX = Math.floor(Math.random() * width);
  const startY = Math.floor(Math.random() * height);
  
  // Mark starting cell as empty
  grid[startY][startX] = 0;
  
  // Stack for backtracking
  const stack = [{ x: startX, y: startY }];
  
  while (stack.length > 0) {
    // Get current cell from stack
    const current = stack[stack.length - 1];
    
    // Possible directions to move
    const directions = [
      { dx: 0, dy: -2, checkX: 0, checkY: -1 }, // Up
      { dx: 2, dy: 0, checkX: 1, checkY: 0 },   // Right
      { dx: 0, dy: 2, checkX: 0, checkY: 1 },   // Down
      { dx: -2, dy: 0, checkX: -1, checkY: 0 }   // Left
    ];
    
    // Shuffle directions for randomness
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }
    
    // Try each direction
    let foundPath = false;
    
    for (const dir of directions) {
      const newX = current.x + dir.dx;
      const newY = current.y + dir.dy;
      
      // Check if the new cell is valid and unvisited
      if (
        newX >= 0 && newX < width &&
        newY >= 0 && newY < height &&
        grid[newY][newX] === 1
      ) {
        // Carve path by clearing the walls
        grid[newY][newX] = 0;
        grid[current.y + dir.checkY][current.x + dir.checkX] = 0;
        
        // Add the new cell to the stack
        stack.push({ x: newX, y: newY });
        foundPath = true;
        break;
      }
    }
    
    // If no valid moves, backtrack
    if (!foundPath) {
      stack.pop();
    }
  }
  
  // Add some random openings to create loops (more interesting maze)
  const loopFactor = 0.1; // 10% chance to remove walls
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      if (Math.random() < loopFactor) {
        const direction = Math.floor(Math.random() * 4);
        if (direction === 0 && y > 0) grid[y-1][x] = 0; // Up
        if (direction === 1 && x < width-1) grid[y][x+1] = 0; // Right
        if (direction === 2 && y < height-1) grid[y+1][x] = 0; // Down
        if (direction === 3 && x > 0) grid[y][x-1] = 0; // Left
      }
    }
  }
  
  return grid;
}
