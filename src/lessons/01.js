import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

const hud = createHUD( {
	title: 'Lesson 01 · 场景 / 相机 / 循环',
	tips: [
		'<kbd>拖拽</kbd> 旋转 · <kbd>滚轮</kbd> 缩放',
		'<kbd>A</kbd> 显示 / 隐藏坐标轴',
	],
} );

// ---------------------------------------------------------------------------
// 1. renderer：真正干活的"画家"，它持有 WebGL 上下文
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );

// Retina 屏一个 CSS 像素对应 2 个物理像素。不设会糊，设成 3 是白烧 9 倍像素。
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );

// 单位是 CSS 像素，别自己乘 pixelRatio。
renderer.setSize( window.innerWidth, window.innerHeight );

// 光照在线性空间算，最终写画布时要编码成 sRGB。r152 之后默认如此，这里写出来是为了显式。
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild( renderer.domElement );

// ---------------------------------------------------------------------------
// 2. scene：容器，本身不显示东西，只维护一棵场景图
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x0b0e14 );

// ---------------------------------------------------------------------------
// 3. camera：PerspectiveCamera( fov, aspect, near, far )
//    fov 越大越广角；aspect 必须是画布宽高比；near/far 决定裁剪范围
// ---------------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(
	50,
	window.innerWidth / window.innerHeight,
	0.1,
	100,
);
camera.position.set( 2.2, 1.6, 3.2 );

// ---------------------------------------------------------------------------
// 4. 灯光：MeshStandardMaterial 是 PBR 材质，没有光就是纯黑
// ---------------------------------------------------------------------------
scene.add( new THREE.HemisphereLight( 0xbfd4ff, 0x1b2030, 1.2 ) );

const dirLight = new THREE.DirectionalLight( 0xffffff, 2.5 );
dirLight.position.set( 3, 5, 2 );
scene.add( dirLight );

// ---------------------------------------------------------------------------
// 5. 地面网格 + 坐标轴：帮你建立"哪里是原点、哪边是上"的空间感
// ---------------------------------------------------------------------------
const grid = new THREE.GridHelper( 10, 20, 0x2a3444, 0x1a2230 );
grid.position.y = -0.5;
grid.material.transparent = true;
grid.material.opacity = 0.9;
scene.add( grid );

const axes = new THREE.AxesHelper( 1.6 );
axes.visible = false;
scene.add( axes );

window.addEventListener( 'keydown', ( e ) => {

	if ( e.key === 'a' || e.key === 'A' ) axes.visible = ! axes.visible;

} );

// ---------------------------------------------------------------------------
// 6. Mesh = Geometry（形状）+ Material（表面怎么和光反应）
// ---------------------------------------------------------------------------
const cube = new THREE.Mesh(
	new THREE.BoxGeometry( 1, 1, 1 ),
	new THREE.MeshStandardMaterial( {
		color: 0x4f8cff,
		roughness: 0.35, // 0 = 镜面，1 = 粗糙
		metalness: 0.1,  // 0 = 非金属，1 = 金属
	} ),
);

// 空物体 Group：只提供位置/旋转，用来演示场景图里的父子关系（第 2 课深挖）
const pivot = new THREE.Group();
pivot.add( cube );
scene.add( pivot );

// ---------------------------------------------------------------------------
// 7. 控制器：拖拽 = 改相机位置和朝向
// ---------------------------------------------------------------------------
const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;   // 惯性
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 12;

// ---------------------------------------------------------------------------
// 8. 渲染循环：每帧一次。所有"随时间变化"的东西都写在这里。
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta(); // 距上一帧的秒数，约 0.0167

	cube.rotation.x += delta * 0.35;
	cube.rotation.y += delta * 0.75;

	controls.update();              // 阻尼必须逐帧推进
	renderer.render( scene, camera );

	hud.tick( delta );

} );

// ---------------------------------------------------------------------------
// 9. 自适应：改相机参数后必须 updateProjectionMatrix()，否则不生效
// ---------------------------------------------------------------------------
window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// 控制台调试入口：__scene.cube.visible = false 试试
window.__scene = { scene, camera, renderer, cube, pivot, controls, axes };
