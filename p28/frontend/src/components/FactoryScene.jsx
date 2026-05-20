import React, { useEffect, useRef, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Color3, MeshBuilder, StandardMaterial, ActionManager, ExecuteCodeAction, TransformNode } from '@babylonjs/core';
import '@babylonjs/core/Helpers/sceneHelpers';
import { useDeviceStore } from '../store/deviceStore';
import ModelLoader from './ModelLoader';
import VRMode from './VRMode';

function FactoryScene() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const cameraRef = useRef(null);
  const meshesRef = useRef(new Map());
  const [sceneReady, setSceneReady] = useState(false);
  const { devices, selectDevice, connectWebSocket } = useDeviceStore();

  const highlightMesh = (mesh) => {
    if (!sceneRef.current) return;
    sceneRef.current.meshes.forEach((m) => {
      if (m.material && m.material.emissiveColor) {
        if (!m.metadata?.keepEmissive) {
          m.material.emissiveColor = new Color3(0, 0, 0);
        }
      }
    });

    if (mesh.getChildMeshes) {
      mesh.getChildMeshes().forEach((child) => {
        if (child.material && !child.metadata?.keepEmissive) {
          child.material.emissiveColor = new Color3(0.3, 0.3, 0.1);
        }
      });
    }
  };

  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new Engine(canvasRef.current, true);
    engineRef.current = engine;
    const scene = new Scene(engine);
    sceneRef.current = scene;

    scene.clearColor = new Color3(0.1, 0.1, 0.2);

    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 15, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 30;
    cameraRef.current = camera;

    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    const vrLight = new HemisphericLight('vrLight', new Vector3(0, 2, 0), scene);
    vrLight.intensity = 0.9;

    createFactoryFloor(scene);

    setTimeout(() => setSceneReady(true), 500);

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    devices.forEach((device) => {
      if (!meshesRef.current.has(device.id)) {
        const mesh = createDeviceMesh(sceneRef.current, device);
        meshesRef.current.set(device.id, mesh);

        if (mesh.getChildMeshes) {
          mesh.getChildMeshes().forEach((child) => {
            if (!child.metadata) child.metadata = {};
            child.metadata.deviceId = device.id;
          });
        }
        if (!mesh.metadata) mesh.metadata = {};
        mesh.metadata.deviceId = device.id;

        mesh.actionManager = new ActionManager(sceneRef.current);
        mesh.actionManager.registerAction(
          new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
            selectDevice(device.id);
            highlightMesh(mesh);
          })
        );
      }
      updateDeviceAnimation(meshesRef.current.get(device.id), device);
    });
  }, [devices, selectDevice, highlightMesh]);

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="canvas-container" />
      {sceneReady && (
        <div className="vr-controls">
          <VRMode
            scene={sceneRef.current}
            engine={engineRef.current}
            camera={cameraRef.current}
          />
        </div>
      )}
    </div>
  );
}

function createFactoryFloor(scene) {
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 12 }, scene);
  const groundMaterial = new StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseColor = new Color3(0.3, 0.3, 0.35);
  groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
  ground.material = groundMaterial;

  const gridSize = 2;
  for (let x = -10; x <= 10; x += gridSize) {
    const line = MeshBuilder.CreateLines(`gridX${x}`, {
      points: [new Vector3(x, 0.01, -6), new Vector3(x, 0.01, 6)]
    }, scene);
    line.color = new Color3(0.4, 0.4, 0.5);
  }
  for (let z = -6; z <= 6; z += gridSize) {
    const line = MeshBuilder.CreateLines(`gridZ${z}`, {
      points: [new Vector3(-10, 0.01, z), new Vector3(10, 0.01, z)]
    }, scene);
    line.color = new Color3(0.4, 0.4, 0.5);
  }

  const wallMaterial = new StandardMaterial('wallMaterial', scene);
  wallMaterial.diffuseColor = new Color3(0.5, 0.5, 0.55);
  const backWall = MeshBuilder.CreateBox('backWall', { width: 20, height: 5, depth: 0.2 }, scene);
  backWall.position = new Vector3(0, 2.5, -6.1);
  backWall.material = wallMaterial;
}

function createDeviceMesh(scene, device) {
  const pos = new Vector3(device.position?.x || 0, 0, device.position?.z || 0);
  let mesh;

  switch (device.type) {
    case 'conveyor':
      mesh = createConveyor(scene, device.id, pos);
      break;
    case 'robot_arm':
      mesh = createRobotArm(scene, device.id, pos);
      break;
    case 'agv':
      mesh = createAGV(scene, device.id, pos);
      break;
    default:
      mesh = MeshBuilder.CreateBox(`default_${device.id}`, { size: 1 }, scene);
      mesh.position = pos;
  }

  return mesh;
}

function createConveyor(scene, id, position) {
  const group = new TransformNode(`conveyor_${id}`, scene);
  group.position = position;

  const frameMaterial = new StandardMaterial(`conveyorFrame_${id}`, scene);
  frameMaterial.diffuseColor = new Color3(0.4, 0.4, 0.4);

  const beltMaterial = new StandardMaterial(`conveyorBelt_${id}`, scene);
  beltMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);

  const frame1 = MeshBuilder.CreateBox(`frame1_${id}`, { width: 0.1, height: 0.5, depth: 4 }, scene);
  frame1.position = new Vector3(-0.45, 0.25, 0);
  frame1.material = frameMaterial;
  frame1.parent = group;

  const frame2 = MeshBuilder.CreateBox(`frame2_${id}`, { width: 0.1, height: 0.5, depth: 4 }, scene);
  frame2.position = new Vector3(0.45, 0.25, 0);
  frame2.material = frameMaterial;
  frame2.parent = group;

  const belt = MeshBuilder.CreateBox(`belt_${id}`, { width: 0.8, height: 0.05, depth: 3.8 }, scene);
  belt.position = new Vector3(0, 0.52, 0);
  belt.material = beltMaterial;
  belt.parent = group;

  const rollerMaterial = new StandardMaterial(`roller_${id}`, scene);
  rollerMaterial.diffuseColor = new Color3(0.3, 0.3, 0.3);
  for (let i = -1; i <= 1; i++) {
    const roller = MeshBuilder.CreateCylinder(`roller_${id}_${i}`, { height: 0.9, diameter: 0.12 }, scene);
    roller.rotation.z = Math.PI / 2;
    roller.position = new Vector3(0, 0.45, i * 1.5);
    roller.material = rollerMaterial;
    roller.parent = group;
  }

  group.metadata = { type: 'conveyor', belt };
  return group;
}

function createRobotArm(scene, id, position) {
  const group = new TransformNode(`robot_${id}`, scene);
  group.position = position;

  const baseMaterial = new StandardMaterial(`baseMat_${id}`, scene);
  baseMaterial.diffuseColor = new Color3(0.2, 0.4, 0.7);

  const armMaterial = new StandardMaterial(`armMat_${id}`, scene);
  armMaterial.diffuseColor = new Color3(0.85, 0.3, 0.1);

  const base = MeshBuilder.CreateCylinder(`base_${id}`, { height: 0.3, diameter: 0.8 }, scene);
  base.position.y = 0.15;
  base.material = baseMaterial;
  base.parent = group;

  const shoulder = MeshBuilder.CreateCylinder(`shoulder_${id}`, { height: 0.4, diameter: 0.4 }, scene);
  shoulder.position.y = 0.5;
  shoulder.material = armMaterial;
  shoulder.parent = group;

  const arm1 = MeshBuilder.CreateBox(`arm1_${id}`, { width: 0.15, height: 1.2, depth: 0.15 }, scene);
  arm1.position = new Vector3(0, 1.2, 0);
  arm1.material = armMaterial;
  arm1.parent = group;

  const elbow = MeshBuilder.CreateCylinder(`elbow_${id}`, { height: 0.3, diameter: 0.3 }, scene);
  elbow.position.y = 1.85;
  elbow.material = armMaterial;
  elbow.parent = group;

  const arm2 = MeshBuilder.CreateBox(`arm2_${id}`, { width: 0.12, height: 0.8, depth: 0.12 }, scene);
  arm2.position = new Vector3(0, 2.4, 0.4);
  arm2.rotation.x = Math.PI / 4;
  arm2.material = armMaterial;
  arm2.parent = group;

  const gripperBase = MeshBuilder.CreateSphere(`gripperBase_${id}`, { diameter: 0.2 }, scene);
  gripperBase.position = new Vector3(0, 2.7, 0.7);
  gripperBase.material = baseMaterial;
  gripperBase.parent = group;

  group.metadata = { type: 'robot_arm', shoulder, arm1, elbow, arm2, gripperBase };
  return group;
}

function createAGV(scene, id, position) {
  const group = new TransformNode(`agv_${id}`, scene);
  group.position = position;

  const bodyMaterial = new StandardMaterial(`bodyMat_${id}`, scene);
  bodyMaterial.diffuseColor = new Color3(0.1, 0.6, 0.3);

  const wheelMaterial = new StandardMaterial(`wheelMat_${id}`, scene);
  wheelMaterial.diffuseColor = new Color3(0.15, 0.15, 0.15);

  const body = MeshBuilder.CreateBox(`body_${id}`, { width: 1.2, height: 0.4, depth: 0.8 }, scene);
  body.position.y = 0.35;
  body.material = bodyMaterial;
  body.parent = group;

  const top = MeshBuilder.CreateBox(`top_${id}`, { width: 1.0, height: 0.15, depth: 0.6 }, scene);
  top.position.y = 0.65;
  top.material = bodyMaterial;
  top.parent = group;

  const wheelPositions = [
    new Vector3(-0.45, 0.12, 0.3),
    new Vector3(0.45, 0.12, 0.3),
    new Vector3(-0.45, 0.12, -0.3),
    new Vector3(0.45, 0.12, -0.3)
  ];

  wheelPositions.forEach((pos, i) => {
    const wheel = MeshBuilder.CreateCylinder(`wheel_${id}_${i}`, { height: 0.1, diameter: 0.25 }, scene);
    wheel.rotation.z = Math.PI / 2;
    wheel.position = pos;
    wheel.material = wheelMaterial;
    wheel.parent = group;
  });

  const light = MeshBuilder.CreateSphere(`light_${id}`, { diameter: 0.08 }, scene);
  light.position = new Vector3(0, 0.85, 0.35);
  const lightMaterial = new StandardMaterial(`lightMat_${id}`, scene);
  lightMaterial.emissiveColor = new Color3(0, 1, 0);
  light.material = lightMaterial;
  light.parent = group;

  group.metadata = { type: 'agv', light, lightMaterial };
  return group;
}

function updateDeviceAnimation(mesh, device) {
  if (!mesh || !mesh.metadata) return;

  const isRunning = device.running !== false;
  const hasFault = device.faultCode > 0;

  if (mesh.metadata.type === 'conveyor' && mesh.metadata.belt) {
    if (isRunning) {
      mesh.metadata.belt.position.z += 0.02;
      if (mesh.metadata.belt.position.z > 0.5) {
        mesh.metadata.belt.position.z = 0;
      }
    }
  }

  if (mesh.metadata.type === 'robot_arm') {
    const { shoulder, arm1, arm2 } = mesh.metadata;
    if (isRunning && shoulder) {
      shoulder.rotation.y += 0.01;
      if (arm1) arm1.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
      if (arm2) arm2.rotation.x = Math.PI / 4 + Math.sin(Date.now() * 0.0015) * 0.15;
    }
  }

  if (mesh.metadata.type === 'agv' && mesh.metadata.lightMaterial) {
    if (hasFault) {
      mesh.metadata.lightMaterial.emissiveColor = new Color3(1, Math.sin(Date.now() * 0.01) * 0.5 + 0.5, 0);
    } else if (isRunning) {
      mesh.metadata.lightMaterial.emissiveColor = new Color3(0, 1, 0);
    } else {
      mesh.metadata.lightMaterial.emissiveColor = new Color3(1, 0.6, 0);
    }
  }
}

export default FactoryScene;
