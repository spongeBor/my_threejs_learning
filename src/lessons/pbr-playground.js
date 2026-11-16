import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHUD } from '../lib/hud.js';

/**
 * PBR 对照台
 * 上排 metalness = 0（塑料/陶瓷/木头这类非金属）
 * 下排 metalness = 1（金属）
 * 左 → 右 roughness 0.05 → 0.95
 * 按 E 开关环境贴图，重点看下排发生了什么。
 */

const hud = createHUD( {
	title: 'PBR 对照台',
	tips: [
		'<kbd>E</kbd> 开 / 关环境贴图',
		'上排 metalness=0 · 下排 metalness=1',
		'左 → 右 roughness 0.05 → 0.95',
	],
} );

const envRow = document.createElement( 'div' );
envRow.className = 'row';
envRow.innerHTML = '环境贴图 <b id="env-state">开</b>';
document.getElementById( 'hud' ).appendChild( envRow );
const envStateEl = envRow.querySelector( '#env-state' );

// ---------------------------------------------------------------------------
// 渲染器：PBR 一定要配 tone mapping，否则高光会直接爆成白块
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x11151c );

const camera = new THREE.PerspectiveCamera( 38, window.innerWidth / window.innerHeight, 0.1, 100 );
camera.position.set( 0, 0, 7.4 );

// ---------------------------------------------------------------------------
// 环境贴图（IBL）：PBR 的"间接光"来源
// RoomEnvironment 是 three 内置的一个虚拟房间，用 PMREM 预卷积成环境贴图。
// 没有它，金属就没有东西可反射 —— 这就是你看到"变黑"的原因。
// ---------------------------------------------------------------------------
const pmrem = new THREE.PMREMGenerator( renderer );
const envTexture = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
scene.environment = envTexture;
scene.environmentIntensity = 1.0;

// 直接光：只负责"灯打出来的高光和明暗"，不负责环境反射
scene.add( new THREE.HemisphereLight( 0xffffff, 0x223344, 0.25 ) );

const key = new THREE.DirectionalLight( 0xffffff, 2.2 );
key.position.set( 4, 5, 5 );
scene.add( key );

const rim = new THREE.DirectionalLight( 0x9ecbff, 1.2 );
rim.position.set( -6, -2, 2 );
scene.add( rim );

// ---------------------------------------------------------------------------
// 球体阵列
// ---------------------------------------------------------------------------
const ROUGHNESS = [ 0.05, 0.2, 0.4, 0.65, 0.95 ];
const METALNESS = [ 0.0, 1.0 ];

const geometry = new THREE.SphereGeometry( 0.45, 64, 32 );
const spheres = [];

for ( let row = 0; row < 2; row ++ ) {

	for ( let col = 0; col < ROUGHNESS.length; col ++ ) {

		const material = new THREE.MeshStandardMaterial( {
			color: 0x4f8cff,
			metalness: METALNESS[ row ],
			roughness: ROUGHNESS[ col ],
		} );

		const mesh = new THREE.Mesh( geometry, material );
		// +0.85 是为了把整个阵列推离左上角的 HUD，避免第一个球被挡住
		mesh.position.set( ( col - 2 ) * 1.3 + 0.85, row === 0 ? 0.8 : -0.8, 0 );
		scene.add( mesh );
		spheres.push( mesh );

	}

}

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.8;
controls.minDistance = 4;
controls.maxDistance = 14;
controls.enablePan = false;

// ---------------------------------------------------------------------------
// 开关环境贴图：这是整页的重点
// ---------------------------------------------------------------------------
let envOn = true;

window.addEventListener( 'keydown', ( e ) => {

	if ( e.key !== 'e' && e.key !== 'E' ) return;

	envOn = ! envOn;
	scene.environment = envOn ? envTexture : null;
	envStateEl.textContent = envOn ? '开' : '关';

} );

const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	controls.update();
	renderer.render( scene, camera );
	hud.tick( clock.getDelta() );

} );

window.addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// 控制台可以继续玩：
//   __pbr.scene.environmentIntensity = 0.2   → 环境变暗
//   __pbr.spheres[0].material.envMapIntensity = 2
window.__pbr = { scene, camera, renderer, spheres, controls };
