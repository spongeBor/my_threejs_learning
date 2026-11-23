import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 05 · 纹理与颜色管理
 *
 * 场景：两块竖牌（正面看）+ 一块大地面（斜着看到远处）。
 *
 * 左边竖牌：正确示范（sRGB），永远不动
 * 右边竖牌 + 地面：随按键变化
 *
 *   C  颜色空间    sRGB ↔ 线性（线性读 = 发灰、发暗）
 *   R  重复        1×1 ↔ 4×4（地面是 8× / 32×）
 *   F  过滤        Linear ↔ Nearest（近邻 = 马赛克）
 *   A  各向异性    1 ↔ 设备上限
 *   M  mipmap      开 ↔ 关
 *   V  机位        正面 ↔ 贴地斜视（看远处细节必须用这个）
 *
 * 为什么要有地面：mipmap 和各向异性只在"远处、斜视、大量重复"时才显形。
 * 两块近处的小平面永远看不出差别。
 */

const hud = createHUD( {
	title: 'Lesson 05 · 纹理与颜色管理',
	tips: [
		'<kbd>C</kbd> 颜色空间 · <kbd>R</kbd> 重复 · <kbd>F</kbd> 过滤',
		'<kbd>A</kbd> 各向异性 · <kbd>M</kbd> mipmap · <kbd>V</kbd> 换机位',
		'看 mipmap / 各向异性：先按 <kbd>V</kbd> 贴地，再对比',
	],
} );

const stateRow = document.createElement( 'div' );
stateRow.className = 'row';
stateRow.innerHTML = `
	colorSpace <b id="t-cs">sRGB</b> ·
	repeat <b id="t-rep">1×1</b> ·
	filter <b id="t-fil">Linear</b><br>
	anisotropy <b id="t-aniso">1</b> ·
	mipmap <b id="t-mip">开</b> ·
	机位 <b id="t-view">正面</b>`;
document.getElementById( 'hud' ).appendChild( stateRow );

const csEl = stateRow.querySelector( '#t-cs' );
const repEl = stateRow.querySelector( '#t-rep' );
const filEl = stateRow.querySelector( '#t-fil' );
const anisoEl = stateRow.querySelector( '#t-aniso' );
const mipEl = stateRow.querySelector( '#t-mip' );
const viewEl = stateRow.querySelector( '#t-view' );

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

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 400 );
camera.position.set( 0, 1.4, 8.4 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, - 0.4, 0 );
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.52;   // 别让相机钻到地面下面

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 0.7 ) );

const keyLight = new THREE.DirectionalLight( 0xffffff, 2.4 );
keyLight.position.set( 4, 7, 6 );
scene.add( keyLight );

// ---------------------------------------------------------------------------
// 程序化贴图：棋盘 + 渐变 + 1px 细线 + 彩点
// 细线是"远处/斜视"效果的探针：mipmap 一关就闪，各向异性一开就复清晰
// ---------------------------------------------------------------------------
function makeCheckerCanvas() {

	const size = 512;
	const canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext( '2d' );

	const g = ctx.createRadialGradient( size / 2, size / 2, 20, size / 2, size / 2, size * 0.72 );
	g.addColorStop( 0, '#f2f4f8' );
	g.addColorStop( 1, '#6b7686' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, size, size );

	const cells = 8;
	const step = size / cells;

	for ( let y = 0; y < cells; y ++ ) {

		for ( let x = 0; x < cells; x ++ ) {

			if ( ( x + y ) % 2 === 0 ) continue;

			ctx.fillStyle = 'rgba(40, 60, 120, 0.55)';
			ctx.fillRect( x * step, y * step, step, step );

		}

	}

	ctx.strokeStyle = 'rgba(255, 120, 90, 0.9)';
	ctx.lineWidth = 1;

	for ( let i = 0; i <= 32; i ++ ) {

		const p = ( i / 32 ) * size;

		ctx.beginPath();
		ctx.moveTo( p, 0 );
		ctx.lineTo( p, size );
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo( 0, p );
		ctx.lineTo( size, p );
		ctx.stroke();

	}

	const dots = [ '#ff6b6b', '#7ee787', '#79c0ff', '#ffd166' ];
	dots.forEach( ( color, i ) => {

		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc( size * ( 0.18 + i * 0.21 ), size * 0.88, size * 0.055, 0, Math.PI * 2 );
		ctx.fill();

	} );

	return canvas;

}

const canvas = makeCheckerCanvas();

function makeTexture( colorSpace ) {

	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = colorSpace;
	tex.anisotropy = 1;
	return tex;

}

// ---------------------------------------------------------------------------
// 两块竖牌
// ---------------------------------------------------------------------------
const PLANE = 3.2;
const planeGeometry = new THREE.PlaneGeometry( PLANE, PLANE );

const leftTexture = makeTexture( THREE.SRGBColorSpace );
const rightTexture = makeTexture( THREE.SRGBColorSpace );

const leftMesh = new THREE.Mesh(
	planeGeometry,
	new THREE.MeshStandardMaterial( { map: leftTexture, roughness: 0.75, metalness: 0.05 } ),
);
leftMesh.position.set( - 2.0, 0, 0 );
scene.add( leftMesh );

const rightMesh = new THREE.Mesh(
	planeGeometry,
	new THREE.MeshStandardMaterial( { map: rightTexture, roughness: 0.75, metalness: 0.05 } ),
);
rightMesh.position.set( 2.0, 0, 0 );
scene.add( rightMesh );

// ---------------------------------------------------------------------------
// 大地面：这才是看 mipmap / 各向异性的地方
// ---------------------------------------------------------------------------
const FLOOR_SIZE = 120;
const FLOOR_BASE_REPEAT = 8;      // 基础平铺次数，密度足够高才看得出远处糊不糊

const floorTexture = makeTexture( THREE.SRGBColorSpace );
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set( FLOOR_BASE_REPEAT, FLOOR_BASE_REPEAT );

const floor = new THREE.Mesh(
	new THREE.PlaneGeometry( FLOOR_SIZE, FLOOR_SIZE ),
	new THREE.MeshStandardMaterial( { map: floorTexture, roughness: 0.85, metalness: 0.0 } ),
);
floor.rotation.x = - Math.PI / 2;
floor.position.y = - 1.7;
scene.add( floor );

// 标签
function makeLabel( text, cls ) {

	const el = document.createElement( 'div' );
	el.className = `cmp-label ${ cls }`;
	el.innerHTML = text;
	el.style.textAlign = 'center';
	el.style.lineHeight = '1.5';
	document.body.appendChild( el );
	return el;

}

const labelLeft = makeLabel( '正确：sRGB 解码', 'good' );
const labelRight = makeLabel( '实验：C/R/F/A/M 改参数', '' );

const projected = new THREE.Vector3();

function updateLabels() {

	const targets = [
		{ el: labelLeft, x: - 2.0 },
		{ el: labelRight, x: 2.0 },
	];

	for ( const t of targets ) {

		projected.set( t.x, - PLANE / 2 - 0.3, 0 ).project( camera );
		t.el.style.left = `${ ( projected.x * 0.5 + 0.5 ) * window.innerWidth }px`;
		t.el.style.top = `${ ( - projected.y * 0.5 + 0.5 ) * window.innerHeight }px`;

	}

}

// ---------------------------------------------------------------------------
// 参数状态
// ---------------------------------------------------------------------------
const state = {
	srgb: true,
	repeat: 1,
	nearest: false,
	anisotropy: 1,
	mipmap: true,
	grazing: false,
};

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

// 把当前状态应用到一个纹理上；baseRepeat 决定它自身的基础平铺密度
function applyTo( tex, baseRepeat ) {

	// 颜色空间：颜色贴图必须 sRGB，否则被当线性值读 → 发灰
	tex.colorSpace = state.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;

	// 重复：UV 超出 0~1 怎么取
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;

	const r = baseRepeat * state.repeat;
	tex.repeat.set( r, r );

	// 过滤：像素之间怎么插值
	tex.magFilter = state.nearest ? THREE.NearestFilter : THREE.LinearFilter;
	tex.minFilter = state.nearest
		? THREE.NearestFilter
		: ( state.mipmap ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter );

	tex.generateMipmaps = state.mipmap;
	tex.anisotropy = state.anisotropy;

	tex.needsUpdate = true;

}

function applyTextureState() {

	applyTo( rightTexture, 1 );
	applyTo( floorTexture, FLOOR_BASE_REPEAT );

	refreshHUD();

}

function refreshHUD() {

	csEl.textContent = state.srgb ? 'sRGB' : '线性（错）';
	csEl.style.color = state.srgb ? '#7ee787' : '#ff8b8b';

	repEl.textContent = `${ state.repeat * FLOOR_BASE_REPEAT }× / ${ state.repeat }×`;
	filEl.textContent = state.nearest ? 'Nearest' : 'Linear';

	anisoEl.textContent = String( state.anisotropy );
	mipEl.textContent = state.mipmap ? '开' : '关';
	viewEl.textContent = state.grazing ? '贴地斜视' : '正面';

}

// 两个机位：正面看竖牌；贴地看远处地面
function applyCameraPose() {

	if ( state.grazing ) {

		camera.position.set( 0, 0.45, 2.2 );
		controls.target.set( 0, - 0.9, - 26 );

	} else {

		camera.position.set( 0, 1.4, 8.4 );
		controls.target.set( 0, - 0.4, 0 );

	}

	controls.update();

}

window.addEventListener( 'keydown', ( e ) => {

	const k = e.key.toLowerCase();

	if ( k === 'c' ) state.srgb = ! state.srgb;
	else if ( k === 'r' ) state.repeat = state.repeat === 1 ? 4 : 1;
	else if ( k === 'f' ) state.nearest = ! state.nearest;
	else if ( k === 'a' ) state.anisotropy = state.anisotropy === 1 ? MAX_ANISO : 1;
	else if ( k === 'm' ) state.mipmap = ! state.mipmap;
	else if ( k === 'v' ) {

		state.grazing = ! state.grazing;
		applyCameraPose();

	} else return;

	applyTextureState();

} );

applyTextureState();

const capsRow = document.createElement( 'div' );
capsRow.className = 'row';
capsRow.innerHTML = `设备上限：各向异性 <b>${ MAX_ANISO }</b> · 最大纹理 <b>${ renderer.capabilities.maxTextureSize }</b>`;
document.getElementById( 'hud' ).appendChild( capsRow );

// ---------------------------------------------------------------------------
// 循环
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();

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
//   __tex.right.map.colorSpace = THREE.NoColorSpace;
//   __tex.floor.material.map.anisotropy = 16;
//   __tex.renderer.info.memory.textures
window.__tex = { scene, camera, renderer, left: leftMesh, right: rightMesh, floor, state, MAX_ANISO };
