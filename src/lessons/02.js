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
		'<kbd>A</kbd> 坐标轴 · <kbd>O</kbd> 轨道线 · <kbd>T</kbd> 自转轴',
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
scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 0.9 ) );

// ---------------------------------------------------------------------------
// 行星数据（revolution = 公转速度，spin = 自转速度，tilt = 轴倾角）
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 程序化贴图
// 球体是旋转对称的：纯色球你既看不出它在自转，也看不出轴是斜的。
// 用 canvas 画一层经纬网 + 斑点，旋转和倾角才"看得见"。
// 这也是第 5 课纹理的预告：贴图 = 一张图 + UV 坐标。
// ---------------------------------------------------------------------------
function makePlanetTexture( seed ) {

	const w = 512;
	const h = 256;

	const canvas = document.createElement( 'canvas' );
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext( '2d' );

	// 白底：最终会和 material.color 相乘，所以底色留给行星颜色
	ctx.fillStyle = '#ffffff';
	ctx.fillRect( 0, 0, w, h );

	// 固定种子的伪随机：刷新后纹理不变，方便前后对比
	let s = seed;
	const rand = () => ( s = ( s * 16807 ) % 2147483647 ) / 2147483647;

	// 大陆 / 云斑
	for ( let i = 0; i < 30; i ++ ) {

		const x = rand() * w;
		const y = rand() * h;
		const r = 10 + rand() * 40;
		const g = ctx.createRadialGradient( x, y, 0, x, y, r );
		g.addColorStop( 0, 'rgba(110,120,135,0.5)' );
		g.addColorStop( 1, 'rgba(110,120,135,0)' );
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc( x, y, r, 0, Math.PI * 2 );
		ctx.fill();

	}

	// 经纬网：自转的参照物
	ctx.strokeStyle = 'rgba(55,65,80,0.5)';
	ctx.lineWidth = 1.5;

	for ( let i = 1; i < 8; i ++ ) {

		const y = ( i / 8 ) * h;
		ctx.beginPath();
		ctx.moveTo( 0, y );
		ctx.lineTo( w, y );
		ctx.stroke();

	}

	for ( let i = 1; i < 16; i ++ ) {

		const x = ( i / 16 ) * w;
		ctx.beginPath();
		ctx.moveTo( x, 0 );
		ctx.lineTo( x, h );
		ctx.stroke();

	}

	const texture = new THREE.CanvasTexture( canvas );
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;

}

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
		new THREE.MeshStandardMaterial( {
			map: makePlanetTexture( index + 1 ),  // 白底灰线，和 color 相乘后呈现行星颜色
			color: planet.color,
			roughness: 0.75,
			metalness: 0.0,
		} ),
	);
	tiltGroup.add( mesh );

	// 自转轴可视化：倾角只有画出来才看得见
	const spinAxis = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints( [
			new THREE.Vector3( 0, - planet.radius * 1.7, 0 ),
			new THREE.Vector3( 0, planet.radius * 1.7, 0 ),
		] ),
		new THREE.LineBasicMaterial( { color: 0x8ab4ff, transparent: true, opacity: 0.7 } ),
	);
	tiltGroup.add( spinAxis );

	// 北极点标记：一眼判断"哪边是北"
	const northPole = new THREE.Mesh(
		new THREE.SphereGeometry( Math.max( planet.radius * 0.1, 0.035 ), 12, 8 ),
		new THREE.MeshBasicMaterial( { color: 0xffffff } ),
	);
	northPole.position.set( 0, planet.radius, 0 );
	tiltGroup.add( northPole );

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

	// phase 必须存进数据：循环里每帧都会用绝对时间重算 rotation.y，
	// 如果相位不参与计算，会被 simTime = 0 冲掉，第一帧所有行星回到同一条线上
	bodies.push( { ...planet, phase: index * 1.7, orbitPivot, system, tiltGroup, mesh, spinAxis, northPole, moonPivot, moonMesh } );

} );

// ---------------------------------------------------------------------------
// 坐标轴 & 键盘交互
// ---------------------------------------------------------------------------
const axes = new THREE.AxesHelper( 3 );
axes.visible = false;
scene.add( axes );

let showSpinAxis = true;
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

	} else if ( e.key === 't' || e.key === 'T' ) {

		showSpinAxis = ! showSpinAxis;
		for ( const b of bodies ) {

			b.spinAxis.visible = showSpinAxis;
			b.northPole.visible = showSpinAxis;

		}

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
		b.orbitPivot.rotation.y = b.phase + simTime * b.revolution * 0.5;

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

// 调试用：暴露 THREE 给控制台（模块作用域默认不泄漏到 window）
window.THREE = THREE;
