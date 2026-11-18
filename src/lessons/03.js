import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 03 · BufferGeometry
 *
 * GPU 不认识"平面""球体"。它只认两样东西：
 *   1. 一串顶点属性（position / normal / uv ...，都是扁平的 Float32Array）
 *   2. 一张索引表，说明哪三个顶点组成一个三角形
 *
 * 这节课用 9409 个顶点手工拼一张地形网格，然后每帧改 y 坐标做波浪。
 */

const hud = createHUD( {
	title: 'Lesson 03 · 手写顶点',
	tips: [
		'<kbd>拖拽</kbd> 旋转 · <kbd>滚轮</kbd> 缩放',
		'<kbd>空格</kbd> 暂停 · <kbd>W</kbd> 线框',
	],
} );

const infoRow = document.createElement( 'div' );
infoRow.className = 'row';
infoRow.id = 'geo-info';
document.getElementById( 'hud' ).appendChild( infoRow );

// ---------------------------------------------------------------------------
// 基础三件套
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x070b12 );
scene.fog = new THREE.Fog( 0x070b12, 34, 72 );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 200 );
camera.position.set( 18, 15, 24 );

// ---------------------------------------------------------------------------
// 灯光：地形靠法线吃光，所以法线一定要对
// ---------------------------------------------------------------------------
scene.add( new THREE.HemisphereLight( 0x9fc2ff, 0x0a0f18, 0.55 ) );

const sun = new THREE.DirectionalLight( 0xffffff, 2.0 );
sun.position.set( 8, 14, 6 );
scene.add( sun );

// ---------------------------------------------------------------------------
// 网格参数
// ---------------------------------------------------------------------------
const SIZE = 24;            // 地形边长
const SEG = 96;             // 每边的格子数
const COUNT = SEG + 1;      // 每边的顶点数
const VERTICES = COUNT * COUNT;     // 97 * 97 = 9409
const TRIANGLES = SEG * SEG * 2;    // 每个格子 2 个三角形

infoRow.innerHTML = `顶点 <b>${ VERTICES.toLocaleString() }</b> · 三角形 <b>${ TRIANGLES.toLocaleString() }</b>`;

// ---------------------------------------------------------------------------
// 1) position：每 3 个数 = 一个顶点的 (x, y, z)
//    这里先铺一张 y = 0 的网格，波浪在循环里再算
// ---------------------------------------------------------------------------
const positions = new Float32Array( VERTICES * 3 );
const uvs = new Float32Array( VERTICES * 2 );

let p = 0;
let q = 0;

for ( let iz = 0; iz < COUNT; iz ++ ) {

	for ( let ix = 0; ix < COUNT; ix ++ ) {

		const x = ( ix / SEG - 0.5 ) * SIZE;
		const z = ( iz / SEG - 0.5 ) * SIZE;

		positions[ p ++ ] = x;
		positions[ p ++ ] = 0;
		positions[ p ++ ] = z;

		uvs[ q ++ ] = ix / SEG;
		uvs[ q ++ ] = iz / SEG;

	}

}

// ---------------------------------------------------------------------------
// 2) index：哪三个顶点组成三角形
//    用索引的好处：相邻三角形复用顶点，9409 个顶点就能画出 18432 个三角形
//    绕序：从 +Y 往下看是逆时针 → 正面朝上
// ---------------------------------------------------------------------------
const indices = new Uint32Array( TRIANGLES * 3 );

let i = 0;

for ( let iz = 0; iz < SEG; iz ++ ) {

	for ( let ix = 0; ix < SEG; ix ++ ) {

		const a = iz * COUNT + ix;        // 左上
		const b = a + 1;                  // 右上
		const c = a + COUNT;              // 左下
		const d = c + 1;                  // 右下

		indices[ i ++ ] = a; indices[ i ++ ] = c; indices[ i ++ ] = b;
		indices[ i ++ ] = b; indices[ i ++ ] = c; indices[ i ++ ] = d;

	}

}

// ---------------------------------------------------------------------------
// 3) 组装 BufferGeometry
// ---------------------------------------------------------------------------
const geometry = new THREE.BufferGeometry();
geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
geometry.setIndex( new THREE.BufferAttribute( indices, 1 ) );
geometry.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );

// 顶点色：按高度在深蓝和亮青之间插值，每帧跟着波浪更新
const colors = new Float32Array( VERTICES * 3 );
geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

const colorLow = new THREE.Color( 0x0a2238 );
const colorHigh = new THREE.Color( 0x5fc0e8 );
const tmpColor = new THREE.Color();

const material = new THREE.MeshStandardMaterial( {
	vertexColors: true,
	roughness: 0.45,
	metalness: 0.05,
	side: THREE.FrontSide,
} );

const terrain = new THREE.Mesh( geometry, material );
scene.add( terrain );

// 坐标轴，方便确认 XZ 平面
const axes = new THREE.AxesHelper( 6 );
axes.position.y = 3.6;
scene.add( axes );

// ---------------------------------------------------------------------------
// 波浪函数：两个正弦叠加，避免规律感太强
// ---------------------------------------------------------------------------
const AMP = 1.9;

function waveHeight( x, z, t ) {

	return (
		Math.sin( x * 0.42 + t * 1.1 ) * Math.cos( z * 0.42 + t * 0.8 ) * AMP +
		Math.sin( ( x + z ) * 0.25 + t * 0.6 ) * 0.3
	);

}

// ---------------------------------------------------------------------------
// 每帧更新顶点
// ---------------------------------------------------------------------------
let paused = false;
let simTime = 0;

window.addEventListener( 'keydown', ( e ) => {

	if ( e.code === 'Space' ) {

		e.preventDefault();
		paused = ! paused;

	} else if ( e.key === 'w' || e.key === 'W' ) {

		material.wireframe = ! material.wireframe;

	}

} );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.target.set( 0, 0, 0 );
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 6;
controls.maxDistance = 60;

const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	if ( ! paused ) simTime += delta;

	const t = simTime;

	for ( let v = 0; v < VERTICES; v ++ ) {

		const x = positions[ v * 3 ];
		const z = positions[ v * 3 + 2 ];
		const h = waveHeight( x, z, t );
		positions[ v * 3 + 1 ] = h;

		const k = THREE.MathUtils.clamp( ( h + AMP ) / ( AMP * 2 ), 0, 1 );
		tmpColor.copy( colorLow ).lerp( colorHigh, k );
		colors[ v * 3 ] = tmpColor.r;
		colors[ v * 3 + 1 ] = tmpColor.g;
		colors[ v * 3 + 2 ] = tmpColor.b;

	}

	// 关键：告诉渲染器这份数据变了，需要重新上传 GPU
	geometry.attributes.position.needsUpdate = true;
	geometry.attributes.color.needsUpdate = true;

	// 位置变了，法线必须重算，否则光照还是按平面算
	geometry.computeVertexNormals();

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

window.THREE = THREE;

// 控制台：
//   __geo.geometry.attributes.position.count
//   __geo.geometry.index.count / 3          // 三角形数
//   __geo.geometry.attributes.position.needsUpdate = false   // 波浪会冻住？刷新恢复
window.__geo = { geometry, material, terrain, scene, camera };
