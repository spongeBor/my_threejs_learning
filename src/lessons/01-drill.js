import * as THREE from 'three'
const renderer = new THREE.WebGLRenderer({antialias: true})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0e14)
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 3;

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1,1,1),
  new THREE.MeshStandardMaterial( { color: 0x4f8cff, roughness: 0.35, metalness: 0.1 } )
)
scene.add(cube)
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1b2030, 1.2))
const dir = new THREE.DirectionalLight(0xffffff, 2.5)
dir.position.set(3, 5, 2)
scene.add(dir)

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta()
  cube.rotation.y += delta * 1.2
  renderer.render(scene, camera)
})

window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
  renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );  // ← 加这行
	renderer.setSize( window.innerWidth, window.innerHeight );

} );