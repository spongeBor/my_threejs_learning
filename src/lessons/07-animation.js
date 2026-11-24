import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHUD } from '../lib/hud.js';

/**
 * Lesson 07 · 动画系统
 *
 * 这一课不用外部模型，动画 clip 全部用代码构建 —— 这样你能看清
 * "clip 里到底存了什么"。
 *
 * 三个循环动画（状态机）：
 *   1  Idle   待机：身体轻微起伏，手臂下垂微摆
 *   2  Walk   走路：手脚交替摆动，节奏慢
 *   3  Run    奔跑：幅度更大、频率更快、身体前倾
 *   4  Wave   挥手（一次性）：LoopOnce + clampWhenFinished，结束后回到 Idle
 *
 * 按键：
 *   1/2/3/4  切换状态（crossFadeTo 平滑过渡）
 *   空格     暂停/继续（把 mixer.timeScale 设为 0）
 *   ↑/↓      整体速度快慢（mixer.timeScale）
 *
 * 核心链条：
 *   AnimationClip（关键帧数据）
 *        ↓ mixer.clipAction(clip)
 *   AnimationAction（某个 clip 的一次播放实例）
 *        ↓ action.play() / crossFadeTo()
 *   AnimationMixer（每帧 update(delta) 推进时间，写回对象属性）
 */

const hud = createHUD( {
	title: 'Lesson 07 · 动画系统',
	tips: [
		'<kbd>1</kbd> Idle · <kbd>2</kbd> Walk · <kbd>3</kbd> Run · <kbd>4</kbd> Wave（一次性）',
		'<kbd>空格</kbd> 暂停 · <kbd>↑</kbd><kbd>↓</kbd> 整体速度',
		'<kbd>拖拽</kbd> 旋转视角',
	],
} );

const stateRow = document.createElement( 'div' );
stateRow.className = 'row';
stateRow.innerHTML = `
	状态 <b id="a-state">Idle</b> ·
	timeScale <b id="a-ts">1.00</b><br>
	权重 Idle <b id="a-w0">1.00</b> ·
	Walk <b id="a-w1">0.00</b> ·
	Run <b id="a-w2">0.00</b>`;
document.getElementById( 'hud' ).appendChild( stateRow );

const stateEl = stateRow.querySelector( '#a-state' );
const tsEl = stateRow.querySelector( '#a-ts' );
const weightEls = [
	stateRow.querySelector( '#a-w0' ),
	stateRow.querySelector( '#a-w1' ),
	stateRow.querySelector( '#a-w2' ),
];

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
camera.position.set( 2.6, 1.9, 4.4 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.55, 0 );
controls.enableDamping = true;

scene.add( new THREE.HemisphereLight( 0x3d5170, 0x0a0d14, 0.9 ) );

const keyLight = new THREE.DirectionalLight( 0xfff2e0, 3.0 );
keyLight.position.set( 4, 6, 5 );
scene.add( keyLight );

const rimLight = new THREE.DirectionalLight( 0x88aaff, 1.0 );
rimLight.position.set( - 4, 3, - 5 );
scene.add( rimLight );

const grid = new THREE.GridHelper( 10, 10, 0x1b2330, 0x121821 );
grid.position.y = - 1.25;
scene.add( grid );

// ---------------------------------------------------------------------------
// 搭一个"小人"：层级就是第 2 课那套
// 动画要改哪个关节，就给它起个名字（clip 靠名字找对象）
// ---------------------------------------------------------------------------
const skin = new THREE.MeshStandardMaterial( { color: 0x6ea8ff, roughness: 0.45, metalness: 0.1 } );
const skinDark = new THREE.MeshStandardMaterial( { color: 0x3b6fd4, roughness: 0.5, metalness: 0.1 } );

const character = new THREE.Group();
character.name = 'Character';
scene.add( character );

// 身体：动画里让它上下起伏
const body = new THREE.Mesh( new THREE.BoxGeometry( 0.75, 0.95, 0.45 ), skin );
body.name = 'Body';
body.position.y = 0.05;
character.add( body );

const head = new THREE.Mesh( new THREE.SphereGeometry( 0.3, 32, 16 ), skin );
head.name = 'Head';
head.position.y = 0.85;
character.add( head );

// 关节：用空的 Group 当支点，网格挂在它下面偏移
function makeLimb( name, x, y, length, material ) {

	const pivot = new THREE.Group();
	pivot.name = name;
	pivot.position.set( x, y, 0 );

	const mesh = new THREE.Mesh( new THREE.BoxGeometry( 0.17, length, 0.17 ), material );
	mesh.position.y = - length / 2;
	pivot.add( mesh );

	character.add( pivot );
	return pivot;

}

const armL = makeLimb( 'ArmL', - 0.48, 0.42, 0.7, skinDark );
const armR = makeLimb( 'ArmR', 0.48, 0.42, 0.7, skinDark );
const legL = makeLimb( 'LegL', - 0.2, - 0.45, 0.75, skin );
const legR = makeLimb( 'LegR', 0.2, - 0.45, 0.75, skin );

// ---------------------------------------------------------------------------
// 构建 clip：关键帧 = 时间数组 + 值数组
// ---------------------------------------------------------------------------
function quatTrack( nodeName, times, eulerList ) {

	const values = [];

	for ( const [ x, y, z ] of eulerList ) {

		const q = new THREE.Quaternion().setFromEuler( new THREE.Euler( x, y, z ) );
		values.push( q.x, q.y, q.z, q.w );

	}

	return new THREE.QuaternionKeyframeTrack( `${ nodeName }.quaternion`, times, values );

}

function vecTrack( nodeName, times, positions ) {

	const values = positions.flat();
	return new THREE.VectorKeyframeTrack( `${ nodeName }.position`, times, values );

}

// --- Idle：2 秒循环，身体轻轻起伏 ---
const idleClip = new THREE.AnimationClip( 'Idle', 2, [
	vecTrack( 'Body', [ 0, 1, 2 ], [ [ 0, 0.05, 0 ], [ 0, 0.13, 0 ], [ 0, 0.05, 0 ] ] ),
	quatTrack( 'Head', [ 0, 1, 2 ], [ [ 0, 0, 0.03 ], [ 0, 0.08, - 0.03 ], [ 0, 0, 0.03 ] ] ),
	quatTrack( 'ArmL', [ 0, 1, 2 ], [ [ 0.06, 0, 0.08 ], [ - 0.02, 0, 0.12 ], [ 0.06, 0, 0.08 ] ] ),
	quatTrack( 'ArmR', [ 0, 1, 2 ], [ [ - 0.06, 0, - 0.08 ], [ 0.02, 0, - 0.12 ], [ - 0.06, 0, - 0.08 ] ] ),
] );

// --- Walk：1 秒循环，手脚交替 ---
const walkClip = new THREE.AnimationClip( 'Walk', 1, [
	vecTrack( 'Body', [ 0, 0.25, 0.5, 0.75, 1 ], [
		[ 0, 0.05, 0 ], [ 0, 0.1, 0 ], [ 0, 0.05, 0 ], [ 0, 0.1, 0 ], [ 0, 0.05, 0 ],
	] ),
	quatTrack( 'ArmL', [ 0, 0.5, 1 ], [ [ 0.7, 0, 0.05 ], [ - 0.7, 0, 0.05 ], [ 0.7, 0, 0.05 ] ] ),
	quatTrack( 'ArmR', [ 0, 0.5, 1 ], [ [ - 0.7, 0, - 0.05 ], [ 0.7, 0, - 0.05 ], [ - 0.7, 0, - 0.05 ] ] ),
	quatTrack( 'LegL', [ 0, 0.5, 1 ], [ [ - 0.55, 0, 0 ], [ 0.55, 0, 0 ], [ - 0.55, 0, 0 ] ] ),
	quatTrack( 'LegR', [ 0, 0.5, 1 ], [ [ 0.55, 0, 0 ], [ - 0.55, 0, 0 ], [ 0.55, 0, 0 ] ] ),
] );

// --- Run：0.6 秒循环，幅度更大、身体前倾 ---
const runClip = new THREE.AnimationClip( 'Run', 0.6, [
	vecTrack( 'Body', [ 0, 0.15, 0.3, 0.45, 0.6 ], [
		[ 0, 0.02, 0 ], [ 0, 0.16, 0 ], [ 0, 0.02, 0 ], [ 0, 0.16, 0 ], [ 0, 0.02, 0 ],
	] ),
	quatTrack( 'Body', [ 0, 0.3, 0.6 ], [ [ 0.22, 0, 0 ], [ 0.28, 0, 0 ], [ 0.22, 0, 0 ] ] ),
	quatTrack( 'ArmL', [ 0, 0.3, 0.6 ], [ [ 1.15, 0, 0.1 ], [ - 1.15, 0, 0.1 ], [ 1.15, 0, 0.1 ] ] ),
	quatTrack( 'ArmR', [ 0, 0.3, 0.6 ], [ [ - 1.15, 0, - 0.1 ], [ 1.15, 0, - 0.1 ], [ - 1.15, 0, - 0.1 ] ] ),
	quatTrack( 'LegL', [ 0, 0.3, 0.6 ], [ [ - 1.0, 0, 0 ], [ 1.0, 0, 0 ], [ - 1.0, 0, 0 ] ] ),
	quatTrack( 'LegR', [ 0, 0.3, 0.6 ], [ [ 1.0, 0, 0 ], [ - 1.0, 0, 0 ], [ 1.0, 0, 0 ] ] ),
] );

// --- Wave：一次性，1.2 秒，结束后停住 ---
const waveClip = new THREE.AnimationClip( 'Wave', 1.2, [
	quatTrack( 'ArmR', [ 0, 0.3, 0.6, 0.9, 1.2 ], [
		[ 0, 0, - 0.08 ],
		[ 0, 0, - 2.2 ],
		[ 2.4, 0, - 2.2 ],
		[ 0, 0, - 2.2 ],
		[ 0, 0, - 0.08 ],
	] ),
] );

const CLIPS = { Idle: idleClip, Walk: walkClip, Run: runClip, Wave: waveClip };

// ---------------------------------------------------------------------------
// Mixer + Action
// ---------------------------------------------------------------------------
const mixer = new THREE.AnimationMixer( character );

const actions = {};

for ( const [ name, clip ] of Object.entries( CLIPS ) ) {

	const action = mixer.clipAction( clip );
	action.enabled = true;

	if ( name === 'Wave' ) {

		// 一次性动作：播完不循环，停在最后一帧
		action.setLoop( THREE.LoopOnce, 1 );
		action.clampWhenFinished = true;

	} else {

		action.setLoop( THREE.LoopRepeat, Infinity );

	}

	actions[ name ] = action;

}

let currentName = 'Idle';
actions.Idle.play();

// 一次性动作播完后自动回到 Idle
mixer.addEventListener( 'finished', ( e ) => {

	if ( e.action === actions.Wave ) {

		switchTo( 'Idle' );

	}

} );

function switchTo( name ) {

	if ( name === currentName ) return;

	const from = actions[ currentName ];
	const to = actions[ name ];

	// 一次性动作要从头播
	if ( name === 'Wave' ) to.reset();

	to.enabled = true;
	to.setEffectiveTimeScale( 1 );
	to.setEffectiveWeight( 1 );
	to.play();

	// 交叉淡入淡出：0.3 秒内旧的权重降到 0、新的升到 1
	from.crossFadeTo( to, 0.3, false );

	currentName = name;
	stateEl.textContent = name;

}

// ---------------------------------------------------------------------------
// 输入
// ---------------------------------------------------------------------------
let paused = false;

window.addEventListener( 'keydown', ( e ) => {

	if ( e.code === 'Space' ) {

		e.preventDefault();
		paused = ! paused;
		mixer.timeScale = paused ? 0 : 1;

	} else if ( e.key === 'ArrowUp' ) {

		mixer.timeScale = Math.min( mixer.timeScale + 0.25, 3 );

	} else if ( e.key === 'ArrowDown' ) {

		mixer.timeScale = Math.max( mixer.timeScale - 0.25, 0.25 );

	} else if ( e.key === '1' ) {

		switchTo( 'Idle' );

	} else if ( e.key === '2' ) {

		switchTo( 'Walk' );

	} else if ( e.key === '3' ) {

		switchTo( 'Run' );

	} else if ( e.key === '4' ) {

		switchTo( 'Wave' );

	}

} );

// ---------------------------------------------------------------------------
// 循环
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const delta = clock.getDelta();

	// 整个世界的时间由 mixer 推进；delta 必须传进去，否则动画不动
	mixer.update( delta );

	tsEl.textContent = mixer.timeScale.toFixed( 2 );

	weightEls.forEach( ( el, i ) => {

		const name = [ 'Idle', 'Walk', 'Run' ][ i ];
		el.textContent = actions[ name ].getEffectiveWeight().toFixed( 2 );

	} );

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
//   __anim.mixer.timeScale = 0.2;          // 慢动作
//   __anim.actions.Run.time = 0.1;         // 跳到某一帧
//   __anim.actions.Walk.getEffectiveWeight()
//   __anim.clips.Run.duration
window.THREE = THREE;
window.__anim = { scene, camera, mixer, actions, clips: CLIPS, character };
