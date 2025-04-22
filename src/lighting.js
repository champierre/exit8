import * as THREE from 'three';

// Set up lighting for the scene
export function setupLighting(scene) {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  // Directional light (sun-like)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 30, 20);
  dirLight.castShadow = true;
  
  // Configure shadow properties
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 100;
  dirLight.shadow.camera.left = -30;
  dirLight.shadow.camera.right = 30;
  dirLight.shadow.camera.top = 30;
  dirLight.shadow.camera.bottom = -30;
  
  scene.add(dirLight);
  
  // Point lights (scattered through the maze)
  const pointLight1 = new THREE.PointLight(0x6688cc, 0.8, 30);
  pointLight1.position.set(10, 3, 10);
  pointLight1.castShadow = true;
  scene.add(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0x88cc66, 0.8, 30);
  pointLight2.position.set(20, 3, 20);
  pointLight2.castShadow = true;
  scene.add(pointLight2);
  
  const pointLight3 = new THREE.PointLight(0xcc6688, 0.8, 30);
  pointLight3.position.set(5, 3, 15);
  pointLight3.castShadow = true;
  scene.add(pointLight3);
  
  // Create a flashlight effect attached to the player
  const flashlight = new THREE.SpotLight(0xffffff, 1.5, 15, Math.PI / 6, 0.5, 1);
  flashlight.position.set(0, 1.8, 0); // Position at player's height
  flashlight.target.position.set(0, 1.8, -1); // Point slightly forward
  
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.width = 1024;
  flashlight.shadow.mapSize.height = 1024;
  
  scene.add(flashlight);
  scene.add(flashlight.target);
  
  // Attach flashlight to camera
  return {
    updateFlashlight: (camera) => {
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      
      flashlight.position.copy(camera.position);
      flashlight.target.position.copy(
        camera.position.clone().add(cameraDirection.multiplyScalar(5))
      );
    }
  };
}
