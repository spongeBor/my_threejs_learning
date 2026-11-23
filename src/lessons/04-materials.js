import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 04 · 材质与光照（PBR）
 *
 * 四个球，同样的颜色、同样的光源，只换材质：
 *
 *   ① MeshBasicMaterial    不参与光照，颜色 = 输出
 *   ② MeshLambertMaterial  只有漫反射：N·L，没有任何高光
 *   ③ MeshPhongMaterial    漫反射 + 经验高光：(N·H)^shininess
 *   ④ MeshStandardMaterial 物理渲染：GGX 微表面 + 菲涅尔 + 能量守恒
 *
 * 拨参数看第 ④ 个球：
 *   ↑ ↓            粗糙度 roughness（高光变宽、变暗）
 *   Shift + ↑ ↓    金属度 metalness（非金属 → 金属，漫反射消失）
 *
 * 按 E 打开环境光照（IBL）——
 * 只有 ④ 变亮，因为 scene.environment 只自动作用于 PBR 材质。
 * 这就是"为什么 PBR 模型没有环境贴图会显得脏"。
 */

const hud = createHUD( {
	title: 'Lesson 04 · 材质与光照',
	tips: [
		'<kbd>↑</kbd><kbd>↓</kbd> 粗糙度 · <kbd>Shift</kbd>+<kbd>↑</kbd><kbd>↓</kbd> 金属度',
		'<kbd>E</kbd> 环境光照 · <kbd>H</kbd> 灯光辅助 · <kbd>W</kbd> 线框',
		'<kbd>拖拽</kbd> 旋转，从侧面看高光形状',
	],
} );

const paramRow = document.createElement( 'div' );
paramRow.className = 'row';
paramRow.innerHTML = `
	roughness <b id="m-rough">0.35</b> ·
	metalness <b id="m-metal">0.00</b> ·
	env <b id="m-env">关</b> · 辅助 <b id="m-help">关</b>`;
document.getElementById( 'hud' ).appendChild( paramRow );

const roughEl = paramRow.querySelector( '#m-rough' );
const metalEl = paramRow.querySelector( '#m-metal' );
const envEl = paramRow.querySelector( '#m-env' );
const helpEl = paramRow.querySelector( '#m-help' );

// ---------------------------------------------------------------------------
// 基础三件套
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x05070c );

const camera = new THREE.PerspectiveCamera( 42, window.innerWidth / window.innerHeight, 0.1, 200 );
camera.position.set( 0, 2.6, 13.5 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.2, 0 );
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 40;

// ---------------------------------------------------------------------------
// 光照：一盏主光 + 一盏补光 + 一盏轮廓光
// ---------------------------------------------------------------------------
scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 0.4 ) );

const keyLight = new THREE.DirectionalLight( 0xfff2e0, 3.2 );
keyLight.position.set( 5, 7, 6 );
scene.add( keyLight );

const fillLight = new THREE.DirectionalLight( 0x88aaff, 0.9 );
fillLight.position.set( - 6, 2, 4 );
scene.add( fillLight );

// 轮廓光放在物体后方：边缘亮起来，才能看出"形状"
const rimLight = new THREE.PointLight( 0xffd9b0, 160, 0, 2 );
rimLight.position.set( - 1, 1.6, - 7 );
scene.add( rimLight );

// 灯光辅助：把不可见的光源位置画出来（调试惯用手段）
const helpers = new THREE.Group();
helpers.add( new THREE.DirectionalLightHelper( keyLight, 2, 0xffd166 ) );
helpers.add( new THREE.DirectionalLightHelper( fillLight, 2, 0x74c0fc ) );
helpers.add( new THREE.PointLightHelper( rimLight, 0.35, 0xffb86b ) );
helpers.visible = false;
scene.add( helpers );

const grid = new THREE.GridHelper( 24, 24, 0x1b2330, 0x121821 );
grid.position.y = - 1.6;
scene.add( grid );

// ---------------------------------------------------------------------------
// 环境贴图（IBL）：用 PMREM 把一张"房间"烘成预过滤环境图
// ---------------------------------------------------------------------------
const pmrem = new THREE.PMREMGenerator( renderer );
const envTexture = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
let envOn = false;

// ---------------------------------------------------------------------------
// 四种材质：同一个球体，同样的颜色，只换材质
// ---------------------------------------------------------------------------
const COLOR = 0x6ea8ff;
const RADIUS = 1.15;
const geometry = new THREE.SphereGeometry( RADIUS, 64, 32 );

const basicMat = new THREE.MeshBasicMaterial( { color: COLOR } );
const lambertMat = new THREE.MeshLambertMaterial( { color: COLOR } );
const phongMat = new THREE.MeshPhongMaterial( { color: COLOR, shininess: 40, specular: 0x555555 } );
const standardMat = new THREE.MeshStandardMaterial( { color: COLOR, roughness: 0.35, metalness: 0.0 } );

const SPECS = [
	{ mat: basicMat, name: 'MeshBasic', note: '不受光', x: - 4.9 },
	{ mat: lambertMat, name: 'MeshLambert', note: '只有漫反射', x: - 1.65 },
	{ mat: phongMat, name: 'MeshPhong', note: '经验高光', x: 1.65 },
	{ mat: standardMat, name: 'MeshStandard', note: 'PBR', x: 4.9 },
];

for ( const spec of SPECS ) {

	const mesh = new THREE.Mesh( geometry, spec.mat );
	mesh.position.set( spec.x, 0, 0 );
	scene.add( mesh );

	spec.mesh = mesh;

}

// 标签：跟着球走
const labels = SPECS.map( ( spec ) => {

	const el = document.createElement( 'div' );
	el.className = 'cmp-label';
	el.innerHTML = `${ spec.name }<br><span style="color:#8b949e">${ spec.note }</span>`;
	el.style.textAlign = 'center';
	el.style.lineHeight = '1.5';
	document.body.appendChild( el );
	return { el, x: spec.x };

} );

const projected = new THREE.Vector3();

function updateLabels() {

	for ( const l of labels ) {

		projected.set( l.x, - 1.85, 0 ).project( camera );
		l.el.style.left = `${ ( projected.x * 0.5 + 0.5 ) * window.innerWidth }px`;
		l.el.style.top = `${ ( - projected.y * 0.5 + 0.5 ) * window.innerHeight }px`;

	}

}

// ---------------------------------------------------------------------------
// 参数与交互
// ---------------------------------------------------------------------------
function refreshHUD() {

	roughEl.textContent = standardMat.roughness.toFixed( 2 );
	metalEl.textContent = standardMat.metalness.toFixed( 2 );
	envEl.textContent = envOn ? '开（只影响 PBR）' : '关';
	helpEl.textContent = helpers.visible ? '开' : '关';

}

window.addEventListener( 'keydown', ( e ) => {

	if ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) {

		e.preventDefault();
		const dir = e.key === 'ArrowUp' ? 1 : - 1;

		if ( e.shiftKey ) {

			// 金属度：0 = 塑料，1 = 纯金属（漫反射消失）
			standardMat.metalness = THREE.MathUtils.clamp( standardMat.metalness + dir * 0.05, 0, 1 );

		} else {

			// 粗糙度：越小越像镜子，越大越像磨砂
			standardMat.roughness = THREE.MathUtils.clamp( standardMat.roughness + dir * 0.05, 0, 1 );

		}

		refreshHUD();

	} else if ( e.key === 'e' || e.key === 'E' ) {

		envOn = ! envOn;

		// 渲染器会把 environment 也传给 Lambert/Phong，但它们的 shader 只认 CubeTexture
		// （ENVMAP_TYPE_CUBE），PMREM 纹理用不上 —— 所以实际只有 PBR 会变
		scene.environment = envOn ? envTexture : null;

		// 环境贴图的有无会改变 shader 的 define，需要重编译
		for ( const spec of SPECS ) spec.mat.needsUpdate = true;

		refreshHUD();

	} else if ( e.key === 'h' || e.key === 'H' ) {

		helpers.visible = ! helpers.visible;
		refreshHUD();

	} else if ( e.key === 'w' || e.key === 'W' ) {

		for ( const spec of SPECS ) spec.mat.wireframe = ! spec.mat.wireframe;

	}

} );

refreshHUD();

// ---------------------------------------------------------------------------
// 循环：慢慢转，方便看高光扫过
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	elapsed += delta;

	for ( const spec of SPECS ) {

		spec.mesh.rotation.y = elapsed * 0.25;

	}

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
//   __mats.standard.roughness = 0;      // 镜面（配合 E 开环境光）
//   __mats.standard.metalness = 1;      // 纯金属
//   __mats.key.intensity = 0;           // 关掉主光，看四个球各自的反应
window.__mats = {
	scene, camera, renderer,
	basic: basicMat, lambert: lambertMat, phong: phongMat, standard: standardMat,
	key: keyLight, fill: fillLight, rim: rimLight,
};
