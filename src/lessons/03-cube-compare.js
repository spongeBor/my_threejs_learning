import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 03 附录 · 8 顶点 vs 24 顶点
 *
 * 同一个立方体，两种数据组织：
 *
 *   左：8 个顶点 + 索引复用   → 每个角只有 1 条法线（三个面平均出来的斜向）
 *   右：24 个顶点，每面独立   → 每个面 4 条法线，全都垂直朝外
 *
 * 左边不是"画错了"，是"属性被迫共享"：索引只能指向整个顶点，
 * 不能只共享位置、另外各用各的法线。
 *
 * 按 F 给左边的立方体开 flatShading —— 法线改由片元着色器现算，
 * 于是 8 顶点也能出硬边。这就是"不改顶点数据"的补救办法。
 */

const hud = createHUD( {
	title: 'Lesson 03 附录 · 8 顶点 vs 24 顶点',
	tips: [
		'<kbd>F</kbd> 给左边开 flatShading（补救办法）',
		'<kbd>N</kbd> 显示顶点法线 · <kbd>W</kbd> 线框',
		'<kbd>拖拽</kbd> 旋转，看高光怎么扫过棱边',
	],
} );

const stateRow = document.createElement( 'div' );
stateRow.className = 'row';
stateRow.innerHTML = 'flatShading <b id="cmp-flat">关</b> · 法线 <b id="cmp-norm">关</b>';
document.getElementById( 'hud' ).appendChild( stateRow );
const flatEl = stateRow.querySelector( '#cmp-flat' );
const normEl = stateRow.querySelector( '#cmp-norm' );

// ---------------------------------------------------------------------------
// 场景
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x05070c );

const camera = new THREE.PerspectiveCamera( 42, window.innerWidth / window.innerHeight, 0.1, 100 );
camera.position.set( 0, 3.4, 9 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0, 0 );
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 30;

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 0.55 ) );

// 一个方向光 + 一个点光：高光扫过棱边时，硬边/软边的差别最明显
const keyLight = new THREE.DirectionalLight( 0xffffff, 3.2 );
keyLight.position.set( 5, 7, 4 );
scene.add( keyLight );

const rimLight = new THREE.PointLight( 0x88aaff, 60, 0, 2 );
rimLight.position.set( -5, 1, 6 );
scene.add( rimLight );

// ---------------------------------------------------------------------------
// 立方体 ①：8 个顶点 + 索引复用
// ---------------------------------------------------------------------------
function cube8Geometry( s = 1.2 ) {

	const positions = [
		[ - s, - s, - s ], // 0
		[ s, - s, - s ],   // 1
		[ s, s, - s ],     // 2
		[ - s, s, - s ],   // 3
		[ - s, - s, s ],   // 4
		[ s, - s, s ],     // 5
		[ s, s, s ],       // 6
		[ - s, s, s ],     // 7
	].flat();

	// 6 个面，每个面 2 个三角形；所有面都引用这 8 个顶点
	const quads = [
		[ 1, 2, 6, 5 ], // +X
		[ 0, 4, 7, 3 ], // -X
		[ 3, 7, 6, 2 ], // +Y
		[ 0, 1, 5, 4 ], // -Y
		[ 4, 5, 6, 7 ], // +Z
		[ 0, 3, 2, 1 ], // -Z
	];

	const indices = [];

	for ( const [ a, b, c, d ] of quads ) {

		indices.push( a, b, c, a, c, d );

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
	g.setIndex( indices );
	g.computeVertexNormals();   // ← 会把三个面的法线平均到一个角上
	return g;

}

// ---------------------------------------------------------------------------
// 立方体 ②：24 个顶点，每个面独立
// ---------------------------------------------------------------------------
function cube24Geometry( s = 1.2 ) {

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
	const indices = [];

	faces.forEach( ( face, fi ) => {

		const base = fi * 4;

		face.v.forEach( ( p ) => {

			positions.push( ...p );
			normals.push( ...face.n );

		} );

		indices.push( base, base + 1, base + 2, base, base + 2, base + 3 );

	} );

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
	g.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
	g.setIndex( indices );
	return g;

}

// ---------------------------------------------------------------------------
// 两个立方体并排
// ---------------------------------------------------------------------------
const leftMaterial = new THREE.MeshStandardMaterial( {
	color: 0x7fb2ff, roughness: 0.3, metalness: 0.25,
} );

const rightMaterial = new THREE.MeshStandardMaterial( {
	color: 0x7fb2ff, roughness: 0.3, metalness: 0.25,
} );

const left = new THREE.Mesh( cube8Geometry(), leftMaterial );
left.position.x = - 2.2;
scene.add( left );

const right = new THREE.Mesh( cube24Geometry(), rightMaterial );
right.position.x = 2.2;
scene.add( right );

// 标签
function makeLabel( text, cls, x ) {

	const el = document.createElement( 'div' );
	el.className = `cmp-label ${ cls }`;
	el.textContent = text;
	document.body.appendChild( el );
	return { el, x };

}

const labelLeft = makeLabel( '8 顶点 + 索引（法线被平均）', 'bad', - 2.2 );
const labelRight = makeLabel( '24 顶点（每面独立法线）', 'good', 2.2 );

const projected = new THREE.Vector3();

function updateLabels() {

	for ( const l of [ labelLeft, labelRight ] ) {

		projected.set( l.x, - 2.0, 0 ).project( camera );
		l.el.style.left = `${ ( projected.x * 0.5 + 0.5 ) * window.innerWidth }px`;
		l.el.style.top = `${ ( - projected.y * 0.5 + 0.5 ) * window.innerHeight }px`;

	}

}

// ---------------------------------------------------------------------------
// 法线可视化
// ---------------------------------------------------------------------------
let helperLeft = null;
let helperRight = null;
let showNormals = false;

function rebuildHelpers() {

	for ( const h of [ helperLeft, helperRight ] ) {

		if ( h ) {

			scene.remove( h );
			h.dispose();

		}

	}

	helperLeft = null;
	helperRight = null;

	if ( showNormals ) {

		helperLeft = new VertexNormalsHelper( left, 0.7, 0x7ee787 );
		helperRight = new VertexNormalsHelper( right, 0.7, 0x7ee787 );
		scene.add( helperLeft, helperRight );

	}

}

// ---------------------------------------------------------------------------
// 键盘
// ---------------------------------------------------------------------------
let flat = false;

function refreshFlags() {

	flatEl.textContent = flat ? '开（左边）' : '关';
	normEl.textContent = showNormals ? '开' : '关';

}

window.addEventListener( 'keydown', ( e ) => {

	if ( e.key === 'f' || e.key === 'F' ) {

		flat = ! flat;

		// 只给左边开：flatShading 让法线在片元着色器里现算，不再读属性
		leftMaterial.flatShading = flat;
		leftMaterial.needsUpdate = true;

		refreshFlags();

	} else if ( e.key === 'n' || e.key === 'N' ) {

		showNormals = ! showNormals;
		rebuildHelpers();
		refreshFlags();

	} else if ( e.key === 'w' || e.key === 'W' ) {

		leftMaterial.wireframe = ! leftMaterial.wireframe;
		rightMaterial.wireframe = ! rightMaterial.wireframe;

	}

} );

// ---------------------------------------------------------------------------
// 循环：两个立方体同相位缓慢自转，方便比较高光
// ---------------------------------------------------------------------------
let spin = 0;
const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	spin += delta * 0.35;

	left.rotation.y = spin;
	right.rotation.y = spin;

	// 法线辅助线跟着转，要同步更新
	if ( helperLeft ) helperLeft.update();
	if ( helperRight ) helperRight.update();

	controls.update();
	renderer.render( scene, camera );
	updateLabels();
	hud.tick( delta );

} );

window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// 控制台实验：
//   __cube8.left.geometry.attributes.position.count     // 8
//   __cube8.right.geometry.attributes.position.count    // 24
//   __cube8.left.geometry.attributes.normal.array.slice(0, 3)   // 斜向 ~0.577
//   __cube8.right.geometry.attributes.normal.array.slice(0, 3)  // 垂直 (0,0,1) 之类
window.__cube8 = { scene, camera, left, right, leftMaterial, rightMaterial };
