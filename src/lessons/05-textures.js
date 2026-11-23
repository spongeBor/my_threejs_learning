import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 05 · 纹理与颜色管理
 *
 * 左边：正确示范 —— colorSpace = SRGBColorSpace
 * 右边：实验对象 —— 按下面的键切换各种纹理参数，观察差别
 *
 *   C  颜色空间      sRGB ↔ 线性（线性读 = 发灰、发暗）
 *   R  重复          repeat 1×1 ↔ 4×4（同时切 WrapS/T = RepeatWrapping）
 *   F  过滤          Linear ↔ Nearest（近邻采样 = 马赛克）
 *   A  各向异性      1 ↔ 最大（斜视角地面糊成一团时最有用）
 *   M  mipmap        开 ↔ 关（关掉远处会闪烁）
 *
 * 一张纹理 = 一张图 + 一组采样规则 + 一段 UV 坐标。
 * 画面"发灰"十有八九是颜色空间没设对，"远处闪烁"是 mipmap，
 * "斜着看糊"是各向异性。
 */

const hud = createHUD( {
	title: 'Lesson 05 · 纹理与颜色管理',
	tips: [
		'<kbd>C</kbd> 颜色空间 · <kbd>R</kbd> 重复 · <kbd>F</kbd> 过滤',
		'<kbd>A</kbd> 各向异性 · <kbd>M</kbd> mipmap',
		'左侧是正确示范（sRGB），右侧随按键变化',
	],
} );

const stateRow = document.createElement( 'div' );
stateRow.className = 'row';
stateRow.innerHTML = `
	colorSpace <b id="t-cs">sRGB</b> ·
	repeat <b id="t-rep">1×1</b> ·
	filter <b id="t-fil">Linear</b><br>
	anisotropy <b id="t-aniso">1</b> ·
	mipmap <b id="t-mip">开</b>`;
document.getElementById( 'hud' ).appendChild( stateRow );

const csEl = stateRow.querySelector( '#t-cs' );
const repEl = stateRow.querySelector( '#t-rep' );
const filEl = stateRow.querySelector( '#t-fil' );
const anisoEl = stateRow.querySelector( '#t-aniso' );
const mipEl = stateRow.querySelector( '#t-mip' );

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

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 100 );
camera.position.set( 0, 1.2, 8.2 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0, 0 );
controls.enableDamping = true;

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 0.6 ) );

const keyLight = new THREE.DirectionalLight( 0xffffff, 2.6 );
keyLight.position.set( 3, 5, 6 );
scene.add( keyLight );

// ---------------------------------------------------------------------------
// 程序化贴图：棋盘 + 渐变 + 细线 + 小圆点
// 细线用来观察过滤/mipmap，渐变用来观察颜色空间
// ---------------------------------------------------------------------------
function makeCheckerCanvas() {

	const size = 512;
	const canvas = document.createElement( 'canvas' );
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext( '2d' );

	// 底色渐变：中间亮、四角暗。颜色空间出错时，这部分会最先"塌陷"
	const g = ctx.createRadialGradient( size / 2, size / 2, 20, size / 2, size / 2, size * 0.72 );
	g.addColorStop( 0, '#f2f4f8' );
	g.addColorStop( 1, '#6b7686' );
	ctx.fillStyle = g;
	ctx.fillRect( 0, 0, size, size );

	// 棋盘
	const cells = 8;
	const step = size / cells;

	for ( let y = 0; y < cells; y ++ ) {

		for ( let x = 0; x < cells; x ++ ) {

			if ( ( x + y ) % 2 === 0 ) continue;

			ctx.fillStyle = 'rgba(40, 60, 120, 0.55)';
			ctx.fillRect( x * step, y * step, step, step );

		}

	}

	// 细线：1px，靠近看才清楚 —— 观察过滤与各向异性
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

	// 彩色圆点：给颜色偏移一个参照
	const dots = [ '#ff6b6b', '#7ee787', '#79c0ff', '#ffd166' ];
	dots.forEach( (color, i) => {

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
// 两块相同的平面，只有纹理参数不同
// ---------------------------------------------------------------------------
const PLANE = 3.2;
const geometry = new THREE.PlaneGeometry( PLANE, PLANE );

const leftTexture = makeTexture( THREE.SRGBColorSpace );
const rightTexture = makeTexture( THREE.SRGBColorSpace );

const materialOptions = { roughness: 0.75, metalness: 0.05 };

const leftMesh = new THREE.Mesh(
	geometry,
	new THREE.MeshStandardMaterial( { ...materialOptions, map: leftTexture } ),
);
leftMesh.position.x = - 2.0;
scene.add( leftMesh );

const rightMesh = new THREE.Mesh(
	geometry,
	new THREE.MeshStandardMaterial( { ...materialOptions, map: rightTexture } ),
);
rightMesh.position.x = 2.0;
scene.add( rightMesh );

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
const labelRight = makeLabel( '实验：按 C/R/F/A/M 改参数', '' );

const projected = new THREE.Vector3();

function updateLabels() {

	const targets = [
		{ el: labelLeft, x: - 2.0 },
		{ el: labelRight, x: 2.0 },
	];

	for ( const t of targets ) {

		projected.set( t.x, - PLANE / 2 - 0.35, 0 ).project( camera );
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
};

function applyTextureState() {

	// 颜色空间：颜色贴图必须是 sRGB，否则会被当成线性值读，导致发灰
	rightTexture.colorSpace = state.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;

	// 重复：超出 0~1 的 UV 怎么取
	rightTexture.wrapS = state.repeat > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
	rightTexture.wrapT = rightTexture.wrapS;
	rightTexture.repeat.set( state.repeat, state.repeat );

	// 过滤：像素之间怎么插值
	rightTexture.magFilter = state.nearest ? THREE.NearestFilter : THREE.LinearFilter;
	rightTexture.minFilter = state.nearest
		? THREE.NearestFilter
		: ( state.mipmap ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter );

	rightTexture.generateMipmaps = state.mipmap;

	rightTexture.anisotropy = state.anisotropy;

	// 纹理参数改变后要重新上传
	rightTexture.needsUpdate = true;

	refreshHUD();

}

function refreshHUD() {

	csEl.textContent = state.srgb ? 'sRGB' : '线性（错）';
	csEl.style.color = state.srgb ? '#7ee787' : '#ff8b8b';

	repEl.textContent = `${ state.repeat }×${ state.repeat }`;
	filEl.textContent = state.nearest ? 'Nearest' : 'Linear';

	anisoEl.textContent = String( state.anisotropy );
	mipEl.textContent = state.mipmap ? '开' : '关';

}

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

window.addEventListener( 'keydown', ( e ) => {

	const k = e.key.toLowerCase();

	if ( k === 'c' ) {

		state.srgb = ! state.srgb;

	} else if ( k === 'r' ) {

		state.repeat = state.repeat === 1 ? 4 : 1;

	} else if ( k === 'f' ) {

		state.nearest = ! state.nearest;

	} else if ( k === 'a' ) {

		state.anisotropy = state.anisotropy === 1 ? MAX_ANISO : 1;

	} else if ( k === 'm' ) {

		state.mipmap = ! state.mipmap;

	} else {

		return;

	}

	applyTextureState();

} );

applyTextureState();

// HUD 里顺手标出这台机器的上限
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
//   __tex.right.map.colorSpace = THREE.NoColorSpace;   // 手动改颜色空间
//   __tex.right.map.repeat.set( 8, 8 );                // 纹理放大 8 倍
//   __tex.right.map.dispose();                         // 显存要手动还
//   __tex.renderer.info.memory.textures                // 当前吃了几张纹理
window.__tex = { scene, camera, renderer, left: leftMesh, right: rightMesh, state, MAX_ANISO };
