import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- Configuration ---
const LANE_WIDTH = 10;
const LANE_LENGTH = 50;
const PIN_RADIUS = 0.5;
const PIN_HEIGHT = 2.0;
const PUCK_RADIUS = 0.8;
const PUCK_HEIGHT = 0.4;
const HITTER_RADIUS = 1.2;
const HITTER_HEIGHT = 1.2;

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 18, 40);
camera.lookAt(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dLight = new THREE.DirectionalLight(0xffffff, 0.8);
dLight.position.set(10, 20, 10);
dLight.castShadow = true;
scene.add(dLight);

// --- Physics Setup ---
const world = new CANNON.World();
world.gravity.set(0, -25, 0);
world.solver.iterations = 40;
world.allowSleep = false;

const floorMat = new CANNON.Material('floor');
const puckMat = new CANNON.Material('puck');
const pinMat = new CANNON.Material('pin');
const hitterMat = new CANNON.Material('hitter');

world.addContactMaterial(new CANNON.ContactMaterial(floorMat, puckMat, { friction: 0.1, restitution: 0.0 }));
world.addContactMaterial(new CANNON.ContactMaterial(floorMat, pinMat, { friction: 0.5, restitution: 0.0 }));
world.addContactMaterial(new CANNON.ContactMaterial(puckMat, pinMat, { friction: 0.3, restitution: 0.2 }));
world.addContactMaterial(new CANNON.ContactMaterial(hitterMat, puckMat, { friction: 0.2, restitution: 0.1 }));

const syncList = [];
function addObj(mesh, body) {
    scene.add(mesh);
    world.addBody(body);
    const obj = { mesh, body };
    syncList.push(obj);
    return obj;
}

// Environment
const floor = new THREE.Mesh(new THREE.BoxGeometry(LANE_WIDTH, 1, LANE_LENGTH), new THREE.MeshStandardMaterial({ color: 0x4a3728 }));
floor.receiveShadow = true;
const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(LANE_WIDTH/2, 0.5, LANE_LENGTH/2)), material: floorMat });
floorBody.position.set(0, -0.5, 0);
addObj(floor, floorBody);

// Walls
const wallH = 4;
function createWall(x) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallH, LANE_LENGTH), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    const b = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.25, wallH/2, LANE_LENGTH/2)) });
    b.position.set(x, wallH/2, 0);
    addObj(m, b);
}
createWall(-LANE_WIDTH/2 - 0.25);
createWall(LANE_WIDTH/2 + 0.25);

// Back Wall
const backWallH = 6;
const backWall = new THREE.Mesh(new THREE.BoxGeometry(LANE_WIDTH + 1, backWallH, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
const backWallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3((LANE_WIDTH + 1)/2, backWallH/2, 0.25)) });
backWallBody.position.set(0, backWallH/2, -LANE_LENGTH/2 - 0.25);
addObj(backWall, backWallBody);

// Separator
const sep = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 15), new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
const sepB = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.2, 0.4, 7.5)) });
sepB.position.set(0, 0.4, 2);
addObj(sep, sepB);

// --- Pins ---
let pins = [];
function spawnPins() {
    pins.forEach(p => {
        scene.remove(p.mesh); world.removeBody(p.body);
        const idx = syncList.indexOf(p);
        if (idx > -1) syncList.splice(idx, 1);
    });
    pins = [];
    const startZ = -15, rGap = 2.4, cGap = 1.8;
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c <= r; c++) {
            const x = (c - r / 2) * cGap;
            const z = startZ - r * rGap;
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(PIN_RADIUS, PIN_RADIUS, PIN_HEIGHT, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            mesh.castShadow = true;
            const body = new CANNON.Body({ 
                mass: 2.5, 
                shape: new CANNON.Box(new CANNON.Vec3(PIN_RADIUS, PIN_HEIGHT/2, PIN_RADIUS)), 
                material: pinMat,
                linearDamping: 0.2,
                angularDamping: 0.2
            });
            body.position.set(x, PIN_HEIGHT/2 + 2, z);
            pins.push(addObj(mesh, body));
        }
    }
}
spawnPins();

// --- Puck ---
const puckMesh = new THREE.Mesh(new THREE.CylinderGeometry(PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
puckMesh.castShadow = true;
const puckBody = new CANNON.Body({ 
    mass: 15.0, // MASSIVE WEIGHT
    shape: new CANNON.Sphere(PUCK_RADIUS), 
    material: puckMat, 
    linearDamping: 0.1, 
    angularDamping: 0.1 
});
puckBody.position.set(0, PUCK_RADIUS, 12);
puckBody.linearFactor.set(1, 0, 1); 
puckBody.angularFactor.set(0, 1, 0); 
addObj(puckMesh, puckBody);

// --- Hitter ---
const hitterMesh = new THREE.Mesh(new THREE.CylinderGeometry(HITTER_RADIUS, HITTER_RADIUS, HITTER_HEIGHT, 32), new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x001122 }));
hitterMesh.castShadow = true;
const hitterBody = new CANNON.Body({ 
    mass: 100, 
    shape: new CANNON.Sphere(HITTER_RADIUS), 
    type: CANNON.Body.KINEMATIC,
    material: hitterMat
});
hitterBody.position.set(0, HITTER_RADIUS, 22);
addObj(hitterMesh, hitterBody);

// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let isDragging = false, lastTime = performance.now();
const targetPos = new THREE.Vector3(0, HITTER_RADIUS, 22);

window.addEventListener('mousedown', (e) => {
    mouse.x = (e.clientX/window.innerWidth)*2-1;
    mouse.y = -(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.intersectObject(hitterMesh).length > 0) isDragging = true;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    mouse.x = (e.clientX/window.innerWidth)*2-1;
    mouse.y = -(e.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, pt);
    targetPos.x = Math.max(-LANE_WIDTH/2 + HITTER_RADIUS, Math.min(LANE_WIDTH/2 - HITTER_RADIUS, pt.x));
    targetPos.z = Math.max(5, Math.min(LANE_LENGTH/2, pt.z));
});

window.addEventListener('mouseup', () => { isDragging = false; hitterBody.velocity.set(0,0,0); });

document.getElementById('reset-btn').addEventListener('click', () => {
    spawnPins();
    const xPos = parseFloat(document.getElementById('puck-x').value || 0);
    const zPos = parseFloat(document.getElementById('puck-z').value || 12);
    puckBody.position.set(xPos, PUCK_RADIUS, zPos);
    puckBody.velocity.set(0,0,0); puckBody.angularVelocity.set(0,0,0);
    puckBody.quaternion.set(0,0,0,1);
    targetPos.set(0, HITTER_RADIUS, 22);
    hitterBody.position.set(0, HITTER_RADIUS, 22);
    hitterBody.velocity.set(0,0,0);
});

document.getElementById('puck-x').addEventListener('input', (e) => {
    puckBody.position.x = parseFloat(e.target.value);
    puckBody.velocity.set(0,0,0);
});

document.getElementById('puck-z').addEventListener('input', (e) => {
    puckBody.position.z = parseFloat(e.target.value);
    puckBody.velocity.set(0,0,0);
});

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (isDragging) {
        const strength = 30; 
        const vx = (targetPos.x - hitterBody.position.x) * strength;
        const vz = (targetPos.z - hitterBody.position.z) * strength;
        const maxV = 80;
        const mag = Math.sqrt(vx*vx + vz*vz);
        if (mag > maxV) {
            hitterBody.velocity.set((vx/mag)*maxV, 0, (vz/mag)*maxV);
        } else {
            hitterBody.velocity.set(vx, 0, vz);
        }
    } else {
        // Safe damping
        hitterBody.velocity.x *= 0.9;
        hitterBody.velocity.z *= 0.9;
    }

    world.step(1/60, dt, 15);
    
    let knockedCount = 0;
    syncList.forEach(o => {
        o.mesh.position.copy(o.body.position);
        if (o.body === puckBody || o.body === hitterBody) {
            o.mesh.quaternion.set(0, 0, 0, 1);
        } else {
            o.mesh.quaternion.copy(o.body.quaternion);
            
            // Check if it's a pin and if it's knocked over
            if (pins.includes(o)) {
                // Get the up vector of the pin mesh (0,1,0) and rotate it by current quaternion
                const up = new THREE.Vector3(0, 1, 0);
                up.applyQuaternion(o.mesh.quaternion);
                // If y component is small, the pin is tilted/down (threshold refined)
                if (up.y < 0.85) {
                    knockedCount++;
                }
            }
        }
    });
    
    // Update score display
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) scoreVal.innerText = knockedCount;

    renderer.render(scene, camera);
}
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
animate();
