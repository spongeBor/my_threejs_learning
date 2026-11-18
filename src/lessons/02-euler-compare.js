import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 02 附录 · 欧拉角：单节点 vs 分层（左右对照）
 *
 * 两个地球，同样的倾角 23.5°，同样的自转速度，差别只在"倾角放在哪一层"：
 *
 *   左（错）：mesh.rotation.z = 23.5°，mesh.rotation.y = spin
 *            → 合成 R = Rx·Ry·Rz，倾角在内层、自转在外层
 *            → 被掰斜的自转轴，又整体绕世界 Y 转 → 轴画圆锥 = 晃
 *
 *   右（对）：tiltGroup.rotation.z = 23.5°（父级），mesh.rotation.y = spin（子级）
 *            → 合成 R = Rz·Ry，倾角在外层、自转在内层
 *            → 自转转的是自己的 Y 轴，转完才整体歪 → 轴固定
 *
 * 判断依据只看一根线：自转轴线画成 mesh 的子物体，它就是"这一帧真正的自转轴"。
 * 左边的线会绕圈，右边的线不动。
 */

const hud = createHUD( {
	title: 'Lesson 02 附录 · 欧拉角对照',
	tips: [
		'<kbd>空格</kbd> 暂停（暂停后拖到正上方看）',
		'<kbd>拖拽</kbd> 旋转视角 · <kbd>滚轮</kbd> 缩放',
		'轴线是 mesh 的子物体 = 真实的这一帧自转轴',
	],
} );

const row = document.createElement( 'div' );
row.className = 'row';
row.innerHTML = '状态 <b id="cmp-state">运行中</b> · 自转 <b id="cmp-spin">0.0°</b>';
document.getElementById( 'hud' ).appendChild( row );
const stateEl = row.querySelector( '#cmp-state' );
const spinEl = row.querySelector( '#cmp-spin' );

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

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 200 );
camera.position.set( 0, 5.2, 13 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.1, 0 );
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 40;

// 光照：一侧主光 + 环境底子，保证球面有明暗、能看出转动
scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 1.1 ) );

const key = new THREE.DirectionalLight( 0xffe9d0, 2.2 );
key.position.set( 5, 8, 6 );
scene.add( key );

// 地面网格：给"竖直方向"一个参照
const grid = new THREE.GridHelper( 24, 24, 0x1b2330, 0x121821 );
grid.position.y = -2.6;
scene.add( grid );

// ---------------------------------------------------------------------------
// 程序化贴图：纯色球看不出自转，经纬网才看得出来（同第 2 课）
// ---------------------------------------------------------------------------
function makePlanetTexture() {

	const w = 512, h = 256;
	const canvas = document.createElement( 'canvas' );
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext( '2d' );

	ctx.fillStyle = '#ffffff';
	ctx.fillRect( 0, 0, w, h );

	ctx.strokeStyle = 'rgba(40,52,68,0.75)';
	ctx.lineWidth = 2;
	for ( let i = 1; i < 8; i ++ ) {

		ctx.beginPath();
		ctx.moveTo( 0, ( i / 8 ) * h );
		ctx.lineTo( w, ( i / 8 ) * h );
		ctx.stroke();

	}

	for ( let i = 1; i < 16; i ++ ) {

		ctx.beginPath();
		ctx.moveTo( ( i / 16 ) * w, 0 );
		ctx.lineTo( ( i / 16 ) * w, h );
		ctx.stroke();

	}

	// 赤道加粗：一眼能看出"哪条线在转"
	ctx.strokeStyle = 'rgba(255,120,90,0.9)';
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo( 0, h / 2 );
	ctx.lineTo( w, h / 2 );
	ctx.stroke();

	// 本初子午线：判断自转进度
	ctx.strokeStyle = 'rgba(120,180,255,0.9)';
	ctx.beginPath();
	ctx.moveTo( w / 2, 0 );
	ctx.lineTo( w / 2, h );
	ctx.stroke();

	const texture = new THREE.CanvasTexture( canvas );
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;

}

const planetTexture = makePlanetTexture();
const TILT = THREE.MathUtils.degToRad( 23.5 );
const RADIUS = 1.25;

// ---------------------------------------------------------------------------
// 造一个地球：layered = true 用父级放倾角，false 全写在 mesh 上
// ---------------------------------------------------------------------------
function buildPlanet( x, layered, labelText, labelClass, axisColor ) {

	const root = new THREE.Group();
	root.position.x = x;
	scene.add( root );

	const mesh = new THREE.Mesh(
		new THREE.SphereGeometry( RADIUS, 64, 32 ),
		new THREE.MeshStandardMaterial( {
			map: planetTexture,
			color: layered ? 0x7fb2ff : 0xff9b8a,
			roughness: 0.65,
			metalness: 0.0,
		} ),
	);

	// 自转轴线：挂在 mesh 上，所以它就是"当前这一帧真正生效的自转轴"
	const axis = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints( [
			new THREE.Vector3( 0, - RADIUS * 1.9, 0 ),
			new THREE.Vector3( 0, RADIUS * 1.9, 0 ),
		] ),
		new THREE.LineBasicMaterial( { color: axisColor } ),
	);
	mesh.add( axis );

	// 北极点：一眼判断"倾斜方向有没有在动"
	const pole = new THREE.Mesh(
		new THREE.SphereGeometry( 0.1, 16, 12 ),
		new THREE.MeshBasicMaterial( { color: 0xffffff } ),
	);
	pole.position.set( 0, RADIUS, 0 );
	mesh.add( pole );

	if ( layered ) {

		// 正确：倾角在外层（父级），自转在内层
		const tiltGroup = new THREE.Group();
		tiltGroup.rotation.z = TILT;
		tiltGroup.add( mesh );
		root.add( tiltGroup );

	} else {

		// 错误：倾角和自转挤在同一层
		mesh.rotation.z = TILT;
		root.add( mesh );

	}

	// 世界竖直参考线：对比"地球自己的轴"和"世界的 Y 轴"
	const worldUp = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints( [
			new THREE.Vector3( 0, -2.4, 0 ),
			new THREE.Vector3( 0, 2.4, 0 ),
		] ),
		new THREE.LineDashedMaterial( { color: 0x2c3849, dashSize: 0.18, gapSize: 0.12 } ),
	);
	worldUp.computeLineDistances();
	root.add( worldUp );

	const label = document.createElement( 'div' );
	label.className = `cmp-label ${ labelClass }`;
	label.textContent = labelText;
	document.body.appendChild( label );

	return { root, mesh, label };

}

const left = buildPlanet( -3.1, false, '① 全写在 mesh 上（错）', 'bad', 0xff6b6b );
const right = buildPlanet( 3.1, true, '② 倾角放父级（对）', 'good', 0x7ee787 );

// 标签跟着球走
const projected = new THREE.Vector3();

function updateLabels() {

	for ( const p of [ left, right ] ) {

		projected.set( p.root.position.x, -2.15, 0 ).project( camera );
		p.label.style.left = `${ ( projected.x * 0.5 + 0.5 ) * window.innerWidth }px`;
		p.label.style.top = `${ ( - projected.y * 0.5 + 0.5 ) * window.innerHeight }px`;

	}

}

// ---------------------------------------------------------------------------
// 循环：两个球共用同一个 simTime，保证"同一时刻、同一转速"
// ---------------------------------------------------------------------------
let paused = false;
let simTime = 0;
const clock = new THREE.Clock();

window.addEventListener( 'keydown', ( e ) => {

	if ( e.code === 'Space' ) {

		e.preventDefault();
		paused = ! paused;
		stateEl.textContent = paused ? '暂停' : '运行中';

	}

} );

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();
	if ( ! paused ) simTime += delta;

	const spin = simTime * 1.2;

	// 两边都只改 rotation.y：差别全在"倾角写在哪"
	left.mesh.rotation.y = spin;
	right.mesh.rotation.y = spin;

	spinEl.textContent = `${ THREE.MathUtils.radToDeg( spin % ( Math.PI * 2 ) ).toFixed( 0 ) }°`;

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
//   __euler.left.mesh.rotation.order = 'ZYX';    // 左边立刻不晃（但这是隐式修法，不推荐）
//   __euler.left.mesh.rotation.z = 0;            // 把倾角去掉，晃动消失（对照用）
window.__euler = { scene, camera, left, right, controls };
