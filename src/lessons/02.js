import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 02 · 变换与场景图
 *
 * 每个物体只存"相对父级"的变换，世界矩阵 = 父级世界矩阵 × 自己的局部矩阵。
 * 所以父级一转，整棵子树跟着转 —— 这就是"场景图"的全部魔法。
 *
 * 每个行星的层级：
 *   orbitPivot   绕太阳公转（转 Y 轴，整条轨道一起转）
 *     └ system   固定在轨道半径上，不旋转，是行星的"锚点"
 *         ├ tiltGroup   固定的轴倾角（地球 23.5°），保证自转轴稳定
 *         │    └ mesh   自转
 *         └ moonPivot   卫星绕行星公转（挂 system 上，不继承自转）
 *              └ moonMesh
 *
 * 为什么倾角要单独一层？
 *   如果直接给 mesh 同时设 rotation.z（倾角）和 rotation.y（自转），
 *   欧拉角是"先 Z 后 Y"复合的，自转轴会跟着自转一起绕圈 —— 地球会像陀螺一样晃。
 *   单独一层 tiltGroup 把倾角"焊死"，里面的 mesh 再自转，轴才是稳定的。
 */

const hud = createHUD( {
	title: 'Lesson 02 · 变换与场景图',
	tips: [
		'<kbd>拖拽</kbd> 旋转 · <kbd>滚轮</kbd> 缩放',
		'<kbd>空格</kbd> 暂停 · <kbd>↑</kbd><kbd>↓</kbd> 调速',
		'<kbd>A</kbd> 坐标轴 · <kbd>O</kbd> 轨道线',
	],
} );

const stateRow = document.createElement( 'div' );
stateRow.className = 'row';
stateRow.innerHTML = '状态 <b id="sim-state">运行中</b> · 速度 <b id="sim-speed">×1.0</b>';
document.getElementById( 'hud' ).appendChild( stateRow );
const stateEl = stateRow.querySelector( '#sim-state' );
const speedEl = stateRow.querySelector( '#sim-speed' );

// ---------------------------------------------------------------------------
// 基础三件套
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x05070c );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 500 );
camera.position.set( 0, 12, 22 );

// ---------------------------------------------------------------------------
// 星空背景：BufferGeometry 直接塞顶点，Points 一个点一个点地画
// （第 3 课专门讲顶点数据，这里先当背景用）
// ---------------------------------------------------------------------------
const starCount = 1500;
const starPositions = new Float32Array( starCount * 3 );

for ( let i = 0; i < starPositions.length; i += 3 ) {

	const r = 60 + Math.random() * 60;
	const theta = Math.random() * Math.PI * 2;
	const phi = Math.acos( 2 * Math.random() - 1 );
	starPositions[ i ] = r * Math.sin( phi ) * Math.cos( theta );
	starPositions[ i + 1 ] = r * Math.cos( phi );
	starPositions[ i + 2 ] = r * Math.sin( phi ) * Math.sin( theta );

}

const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute( 'position', new THREE.BufferAttribute( starPositions, 3 ) );
scene.add( new THREE.Points( starGeo, new THREE.PointsMaterial( { color: 0x9fb4cc, size: 0.35 } ) ) );

// ---------------------------------------------------------------------------
// 太阳：自己发光，用 MeshBasicMaterial（不受光）
// ---------------------------------------------------------------------------
const sun = new THREE.Mesh(
	new THREE.SphereGeometry( 1.25, 64, 32 ),
	new THREE.MeshBasicMaterial( { color: 0xffb36b } ),
);
scene.add( sun );

// 点光源放在太阳位置：1/d² 衰减，越远的行星越暗 —— 这是真实物理，不是手调的
scene.add( new THREE.PointLight( 0xffd9b0, 220, 0, 2 ) );

// 一点点环境光，避免背光面死黑
scene.add( new THREE.HemisphereLight( 0x2b3a55, 0x000000, 0.35 ) );

// ---------------------------------------------------------------------------
// 行星数据（revolution = 公转速度，spin = 自转速度，tilt = 轴倾角）
// ---------------------------------------------------------------------------
const PLANETS = [
	{ name: '水星', radius: 0.3, orbit: 3.0, color: 0x9a8f88, revolution: 1.6, spin: 0.4, tilt: 0.0 },
	{ name: '地球', radius: 0.55, orbit: 4.8, color: 0x3b82f6, revolution: 1.0, spin: 1.2, tilt: 23.5, moon: true },
	{ name: '火星', radius: 0.4, orbit: 6.4, color: 0xc1440e, revolution: 0.75, spin: 1.0, tilt: 25.2 },
	{ name: '木星', radius: 1.0, orbit: 8.8, color: 0xd9a066, revolution: 0.45, spin: 2.2, tilt: 3.1 },
];

const orbitLines = new THREE.Group();
scene.add( orbitLines );

const bodies = [];

PLANETS.forEach( ( planet, index ) => {

	// 1) 公转轴：rotation.y 就是"绕太阳转"
	const orbitPivot = new THREE.Group();
	orbitPivot.rotation.y = index * 1.7; // 固定初始相位，别让行星排成一条线
	scene.add( orbitPivot );

	// 2) 锚点：固定在轨道半径上。它不旋转，子物体才不会跟着公转一起自转
	const system = new THREE.Group();
	system.position.x = planet.orbit;
	orbitPivot.add( system );

	// 3) 轴倾角：单独一层且固定不变，自转轴才稳定
	const tiltGroup = new THREE.Group();
	tiltGroup.rotation.z = THREE.MathUtils.degToRad( planet.tilt );
	system.add( tiltGroup );

	// 4) 行星本体：自转写在这里，只影响自己
	const mesh = new THREE.Mesh(
		new THREE.SphereGeometry( planet.radius, 48, 24 ),
		new THREE.MeshStandardMaterial( { color: planet.color, roughness: 0.75, metalness: 0.0 } ),
	);
	tiltGroup.add( mesh );

	// 5) 卫星：挂在 system 上而不是 mesh 上，否则会继承自转
	let moonPivot = null;
	let moonMesh = null;

	if ( planet.moon ) {

		moonPivot = new THREE.Group();
		system.add( moonPivot );

		moonMesh = new THREE.Mesh(
			new THREE.SphereGeometry( 0.12, 24, 12 ),
			new THREE.MeshStandardMaterial( { color: 0xcfcfcf, roughness: 0.9 } ),
		);
		moonMesh.position.x = 1.0;
		moonPivot.add( moonMesh );

	}

	// 轨道线：躺在 XZ 平面上的圆
	const points = [];
	for ( let i = 0; i <= 128; i ++ ) {

		const a = ( i / 128 ) * Math.PI * 2;
		points.push( new THREE.Vector3( Math.cos( a ) * planet.orbit, 0, Math.sin( a ) * planet.orbit ) );

	}

	orbitLines.add( new THREE.LineLoop(
		new THREE.BufferGeometry().setFromPoints( points ),
		new THREE.LineBasicMaterial( { color: 0x2a3648 } ),
	) );

	bodies.push( { ...planet, orbitPivot, system, tiltGroup, mesh, moonPivot, moonMesh } );

} );

// ---------------------------------------------------------------------------
// 坐标轴 & 键盘交互
// ---------------------------------------------------------------------------
const axes = new THREE.AxesHelper( 3 );
axes.visible = false;
scene.add( axes );

let paused = false;
let speed = 1;
let simTime = 0;

function refreshHUD() {

	stateEl.textContent = paused ? '暂停' : '运行中';
	speedEl.textContent = `×${ speed.toFixed( 1 ) }`;

}

window.addEventListener( 'keydown', ( e ) => {

	if ( e.code === 'Space' ) {

		e.preventDefault();
		paused = ! paused;
		refreshHUD();

	} else if ( e.key === 'ArrowUp' ) {

		speed = Math.min( speed + 0.5, 6 );
		refreshHUD();

	} else if ( e.key === 'ArrowDown' ) {

		speed = Math.max( speed - 0.5, 0.5 );
		refreshHUD();

	} else if ( e.key === 'a' || e.key === 'A' ) {

		axes.visible = ! axes.visible;

	} else if ( e.key === 'o' || e.key === 'O' ) {

		orbitLines.visible = ! orbitLines.visible;

	}

} );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 120;

// ---------------------------------------------------------------------------
// 循环：用"绝对模拟时间"驱动
// 暂停 = 不推进 simTime；变速 = 改变 simTime 的增长速率。
// 因为旋转值由 simTime 直接算出，不会有 += 造成的累加漂移。
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	if ( ! paused ) simTime += delta * speed;

	for ( const b of bodies ) {

		// 公转：转的是父级，整条轨道一起转
		b.orbitPivot.rotation.y = simTime * b.revolution * 0.5;

		// 自转：只转自己
		b.mesh.rotation.y = simTime * b.spin;

		if ( b.moonPivot ) b.moonPivot.rotation.y = simTime * 2.4;

	}

	sun.rotation.y = simTime * 0.05;

	controls.update();
	renderer.render( scene, camera );
	hud.tick( delta );

} );

window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// 控制台练习（第 3 个作业题会用到）：
//   __solar.bodies[1].mesh.getWorldPosition(new THREE.Vector3())
//   __solar.bodies[1].system.position.x = 8
window.__solar = { scene, camera, bodies, sun, controls, orbitLines, axes };
