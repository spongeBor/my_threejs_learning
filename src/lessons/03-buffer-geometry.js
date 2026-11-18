import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 03 · 手写 BufferGeometry
 *
 * 现成的 BoxGeometry / SphereGeometry 只是"别人写好的顶点数组"。
 * 这一课把数组摊开：三角形 → 索引 → 法线 → 动态更新。
 *
 * 四个模式（按 1/2/3/4 切换）：
 *   1 三角形   3 个顶点，最原始的单位
 *   2 索引方形 4 个顶点 + 6 个索引 → 复用顶点
 *   3 立方体   24 个顶点 —— 为什么不是 8 个？（法线断裂）
 *   4 波浪     每帧改 position 数组，看 needsUpdate 是什么
 *
 * 记住三个事实：
 *   ① 几何体 = 一串顶点属性（position / normal / uv）+ 索引
 *   ② 属性是 Float32Array，GPU 只认数组，不认对象
 *   ③ 改数组本身没用，要 needsUpdate = true 才会重新上传
 */

const hud = createHUD( {
	title: 'Lesson 03 · 手写 BufferGeometry',
	tips: [
		'<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> 切换：三角形 / 索引方形 / 立方体 / 波浪',
		'<kbd>B</kbd> 背面剔除 · <kbd>W</kbd> 线框 · <kbd>N</kbd> 法线',
		'<kbd>空格</kbd> 暂停 · <kbd>拖拽</kbd> 旋转',
	],
} );

const statsRow = document.createElement( 'div' );
statsRow.className = 'row';
statsRow.innerHTML = '模式 <b id="geo-mode">三角形</b> · 顶点 <b id="geo-v">3</b> · 三角 <b id="geo-t">1</b>';
document.getElementById( 'hud' ).appendChild( statsRow );

const modeEl = statsRow.querySelector( '#geo-mode' );
const vertEl = statsRow.querySelector( '#geo-v' );
const triEl = statsRow.querySelector( '#geo-t' );

const flagRow = document.createElement( 'div' );
flagRow.className = 'row';
flagRow.innerHTML = '剔除 <b id="geo-side">正面</b> · 线框 <b id="geo-wire">关</b> · 法线 <b id="geo-norm">关</b>';
document.getElementById( 'hud' ).appendChild( flagRow );

const sideEl = flagRow.querySelector( '#geo-side' );
const wireEl = flagRow.querySelector( '#geo-wire' );
const normEl = flagRow.querySelector( '#geo-norm' );

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

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 200 );
camera.position.set( 0, 3.6, 9 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.3, 0 );
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 40;

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 1.0 ) );

const key = new THREE.DirectionalLight( 0xffeedd, 2.4 );
key.position.set( 4, 7, 5 );
scene.add( key );

const fill = new THREE.DirectionalLight( 0x88aaff, 0.8 );
fill.position.set( -5, 2, -4 );
scene.add( fill );

const grid = new THREE.GridHelper( 14, 14, 0x1b2330, 0x121821 );
grid.position.y = -1.6;
scene.add( grid );

// ---------------------------------------------------------------------------
// 共用的材质：所有模式都用它，观察"几何体一变，同一个材质画出的东西完全不同"
// ---------------------------------------------------------------------------
const material = new THREE.MeshStandardMaterial( {
	color: 0x5b8def,
	roughness: 0.42,
	metalness: 0.08,
	side: THREE.FrontSide,
	flatShading: false,
} );

// ---------------------------------------------------------------------------
// 四种几何体：全部手写顶点
// ---------------------------------------------------------------------------

// ① 最小单位：一个三角形。没有索引，3 个顶点就是 3 个顶点。
function triangleGeometry() {

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( [
		- 1.3, - 1.0, 0,
		1.3, - 1.0, 0,
		0, 1.2, 0,
	], 3 ) );

	// 没有手写法线，就让 three 从三角形顶点算：面法线 = (b-a)×(c-a)
	g.computeVertexNormals();
	return g;

}

// ② 索引：4 个顶点描述 2 个三角形，省掉 2 个重复顶点
function quadGeometry() {

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( [
		- 1.3, - 1.3, 0,   // 0
		1.3, - 1.3, 0,     // 1
		1.3, 1.3, 0,       // 2
		- 1.3, 1.3, 0,     // 3
	], 3 ) );

	// 索引 = 顶点的"使用说明书"：先画 0-1-2，再画 0-2-3（逆时针 = 正面朝向 +Z）
	g.setIndex( [ 0, 1, 2, 0, 2, 3 ] );
	g.computeVertexNormals();
	return g;

}

// ③ 立方体：8 个角，但必须写 24 个顶点。为什么？
//    顶点属性是"整体"的：位置相同、法线不同的两个角，没法共用同一个顶点。
//    一个角被 3 个面用到，3 个面法线不同 → 每个面各存一份。
function cubeGeometry( s = 1.1 ) {

	// 每个面：法线 + 4 个角（从外面看是逆时针）
	const faces = [
		{ n: [ 1, 0, 0 ], v: [ [ s, - s, s ], [ s, - s, - s ], [ s, s, - s ], [ s, s, s ] ] },
		{ n: [ - 1, 0, 0 ], v: [ [ - s, - s, - s ], [ - s, - s, s ], [ - s, s, s ], [ - s, s, - s ] ] },
		{ n: [ 0, 1, 0 ], v: [ [ - s, s, s ], [ s, s, s ], [ s, s, - s ], [ - s, s, - s ] ] },
		{ n: [ 0, - 1, 0 ], v: [ [ - s, - s, - s ], [ s, - s, - s ], [ s, - s, s ], [ - s, - s, s ] ] },
		{ n: [ 0, 0, 1 ], v: [ [ - s, - s, s ], [ s, - s, s ], [ s, s, s ], [ - s, s, s ] ] },
		{ n: [ 0, 0, - 1 ], v: [ [ s, - s, - s ], [ - s, - s, - s ], [ - s, s, - s ], [ s, s, - s ] ] },
	];

	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];

	faces.forEach( ( face, fi ) => {

		const base = fi * 4;

		face.v.forEach( ( p, i ) => {

			positions.push( ...p );
			normals.push( ...face.n );

			// 每个面独立的 UV：换成贴图时不会串
			uvs.push( i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0 );

		} );

		indices.push( base, base + 1, base + 2, base, base + 2, base + 3 );

	} );

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
	g.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setIndex( indices );
	return g;

}

// ④ 参数化曲面：顶点坐标是"算"出来的，不是摆出来的
const WAVE_SEG = 48;
const WAVE_SIZE = 8;

function waveGeometry() {

	const g = new THREE.BufferGeometry();
	const count = ( WAVE_SEG + 1 ) * ( WAVE_SEG + 1 );
	const positions = new Float32Array( count * 3 );
	const uvs = new Float32Array( count * 2 );

	for ( let gy = 0; gy <= WAVE_SEG; gy ++ ) {

		for ( let gx = 0; gx <= WAVE_SEG; gx ++ ) {

			const i = gy * ( WAVE_SEG + 1 ) + gx;

			positions[ i * 3 ] = ( gx / WAVE_SEG - 0.5 ) * WAVE_SIZE;
			positions[ i * 3 + 1 ] = 0;
			positions[ i * 3 + 2 ] = ( gy / WAVE_SEG - 0.5 ) * WAVE_SIZE;

			uvs[ i * 2 ] = gx / WAVE_SEG;
			uvs[ i * 2 + 1 ] = 1 - gy / WAVE_SEG;

		}

	}

	const indices = [];

	for ( let gy = 0; gy < WAVE_SEG; gy ++ ) {

		for ( let gx = 0; gx < WAVE_SEG; gx ++ ) {

			const a = gy * ( WAVE_SEG + 1 ) + gx;
			const b = a + 1;
			const c = a + WAVE_SEG + 1;
			const d = c + 1;

			// 两个三角形拼成一个格子；绕序决定法线朝上还是朝下
			indices.push( a, c, b, b, c, d );

		}

	}

	g.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	g.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );
	g.setIndex( indices );
	g.computeVertexNormals();
	return g;

}

// 波浪高度场：给 (x, z) 和时间，返回 y
function waveHeight( x, z, t ) {

	const d = Math.sqrt( x * x + z * z );
	return Math.sin( d * 1.7 - t * 2.2 ) * 0.5 / ( 1 + d * 0.22 )
		+ Math.sin( x * 1.3 + t ) * 0.14
		+ Math.cos( z * 1.1 - t * 1.4 ) * 0.1;

}

// ---------------------------------------------------------------------------
// 场景里只保留一个 mesh，切换模式时换几何体
// ---------------------------------------------------------------------------
const mesh = new THREE.Mesh( triangleGeometry(), material );
scene.add( mesh );

let normalsHelper = null;
let showNormals = false;
let paused = false;
let simTime = 0;
let currentMode = 'triangle';

const MODES = {
	triangle: { name: '三角形', build: triangleGeometry, view: { pos: [ 0, 2.0, 7 ], target: [ 0, 0, 0 ] } },
	quad: { name: '索引方形', build: quadGeometry, view: { pos: [ 0, 2.0, 7 ], target: [ 0, 0, 0 ] } },
	cube: { name: '立方体 24 顶点', build: cubeGeometry, view: { pos: [ 3.2, 3.0, 6.4 ], target: [ 0, 0, 0 ] } },
	wave: { name: '波浪（动态）', build: waveGeometry, view: { pos: [ 0, 6.6, 11 ], target: [ 0, 0, 0 ] } },
};

function rebuildNormalsHelper() {

	if ( normalsHelper ) {

		scene.remove( normalsHelper );
		normalsHelper.dispose();
		normalsHelper = null;

	}

	if ( showNormals && currentMode !== 'wave' ) {

		// 波浪顶点太多，法线画出来是一团毛线，跳过
		normalsHelper = new VertexNormalsHelper( mesh, 0.45, 0x7ee787 );
		scene.add( normalsHelper );

	}

}

function updateStats() {

	const g = mesh.geometry;
	const verts = g.attributes.position.count;
	const tris = g.index ? g.index.count / 3 : verts / 3;

	modeEl.textContent = MODES[ currentMode ].name;
	vertEl.textContent = String( verts );
	triEl.textContent = String( tris );

}

function setMode( name ) {

	if ( ! MODES[ name ] ) return;

	currentMode = name;

	mesh.geometry.dispose();               // 旧几何体占着 GPU 内存，要还回去
	mesh.geometry = MODES[ name ].build();
	mesh.rotation.set( 0, 0, 0 );          // 立方体会自转，切走时复位

	// 每种模式给一个合适的机位，免得圆球占满屏幕
	const view = MODES[ name ].view;
	camera.position.set( ...view.pos );
	controls.target.set( ...view.target );
	controls.update();

	updateStats();
	rebuildNormalsHelper();

}

updateStats();

// ---------------------------------------------------------------------------
// 键盘
// ---------------------------------------------------------------------------
function refreshFlags() {

	sideEl.textContent = material.side === THREE.FrontSide ? '正面'
		: material.side === THREE.BackSide ? '背面' : '双面';
	wireEl.textContent = material.wireframe ? '开' : '关';
	normEl.textContent = showNormals ? '开' : '关';

}

window.addEventListener( 'keydown', ( e ) => {

	if ( e.code === 'Digit1' ) setMode( 'triangle' );
	else if ( e.code === 'Digit2' ) setMode( 'quad' );
	else if ( e.code === 'Digit3' ) setMode( 'cube' );
	else if ( e.code === 'Digit4' ) setMode( 'wave' );
	else if ( e.key === 'b' || e.key === 'B' ) {

		// 单面 → 双面 → 背面，看"绕序"到底在管什么
		material.side = material.side === THREE.FrontSide ? THREE.DoubleSide : THREE.FrontSide;
		material.needsUpdate = true;
		refreshFlags();

	} else if ( e.key === 'w' || e.key === 'W' ) {

		material.wireframe = ! material.wireframe;
		refreshFlags();

	} else if ( e.key === 'n' || e.key === 'N' ) {

		showNormals = ! showNormals;
		rebuildNormalsHelper();
		refreshFlags();

	} else if ( e.code === 'Space' ) {

		e.preventDefault();
		paused = ! paused;

	}

} );

// ---------------------------------------------------------------------------
// 循环
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const positionAttr = () => mesh.geometry.attributes.position;

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	if ( ! paused ) simTime += delta;

	if ( currentMode === 'wave' ) {

		const attr = positionAttr();
		const arr = attr.array;

		for ( let i = 0; i < arr.length; i += 3 ) {

			arr[ i + 1 ] = waveHeight( arr[ i ], arr[ i + 2 ], simTime );

		}

		// 关键一行：改完 CPU 数组，必须告诉 GPU "这份数据失效了"
		attr.needsUpdate = true;

		// 法线也要跟着重算，否则光照是错的（形状在动，明暗不变）
		mesh.geometry.computeVertexNormals();

	} else if ( currentMode === 'cube' ) {

		mesh.rotation.y = simTime * 0.4;

	}

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

// 控制台实验：
//   __geo.mesh.geometry.attributes.position.array[0] = 3;   // 改数组
//   __geo.mesh.geometry.attributes.position.needsUpdate = true;  // 不写这句就看不到
//   __geo.mesh.geometry.setDrawRange( 0, 3 );               // 只画前 3 个顶点（1 个三角形）
//   __geo.mesh.geometry.setDrawRange( 0, Infinity );        // 恢复
//   __geo.mesh.geometry.computeVertexNormals();             // 重算法线
window.__geo = { scene, camera, mesh, material, MODES, setMode };
