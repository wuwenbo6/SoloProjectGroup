import React, { useState, useEffect, useRef } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { Color3, Vector3, MeshBuilder, StandardMaterial, ActionManager, ExecuteCodeAction } from '@babylonjs/core';

function VRMode({ scene, engine, camera }) {
  const [vrSupported, setVrSupported] = useState(false);
  const [inVR, setInVR] = useState(false);
  const xrHelperRef = useRef(null);
  const { selectDevice, devices, sendControlCommand } = useDeviceStore();

  useEffect(() => {
    if (!scene || !engine) return;
    initXR();
    return () => {
      if (xrHelperRef.current) {
        xrHelperRef.current.dispose();
      }
    };
  }, [scene, engine]);

  const initXR = async () => {
    try {
      const xrHelper = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [scene.getMeshByName('ground')].filter(Boolean),
        uiOptions: {
          sessionMode: 'immersive-vr',
          referenceSpaceType: 'local-floor'
        }
      });

      xrHelperRef.current = xrHelper;
      setVrSupported(true);

      xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        if (state === 'IN_XR') {
          setInVR(true);
          setupVRLocomotion(xrHelper);
          setupVRInteractions(xrHelper);
          createVRDashboard(xrHelper);
        } else {
          setInVR(false);
        }
      });

      xrHelper.input.onControllerAddedObservable.add((controller) => {
        console.log('VR控制器已连接:', controller.uniqueId);
      });

    } catch (e) {
      console.log('WebXR not supported:', e);
      setVrSupported(false);
    }
  };

  const setupVRLocomotion = (xrHelper) => {
    const featuresManager = xrHelper.baseExperience.featuresManager;

    const teleportation = featuresManager.enableFeature('BABYLON.Teleportation', 'latest', {
      xrInput: xrHelper.input,
      floorMeshes: [scene.getMeshByName('ground')].filter(Boolean),
      parabolicCheckRadius: 0.5,
      forceHandedness: 'right',
      renderingGroupId: 1,
      pickBlockerMeshes: []
    });

    featuresManager.enableFeature('BABYLON.SnapTurn', 'latest', {
      snapTurnAngle: Math.PI / 8,
      useMainComponentOnly: true
    });

    const walking = featuresManager.enableFeature('BABYLON.WalkingLocomotion', 'latest', {
      xrInput: xrHelper.input,
      speed: 1.5,
      slidingEnabled: true,
      gravity: -9.81
    });
  };

  const setupVRInteractions = (xrHelper) => {
    const featuresManager = xrHelper.baseExperience.featuresManager;

    const pointerSelection = featuresManager.enableFeature('BABYLON.PointerSelection', 'latest', {
      xrInput: xrHelper.input,
      enablePointerSelectionOnAllControllers: true,
      displayLaserPointer: true,
      displayGaze: true,
      laserPointerColor: new Color3(0.2, 0.8, 1),
      gazeColor: new Color3(1, 0.8, 0.2)
    });

    if (pointerSelection) {
      pointerSelection.onPointerDownObservable.add(({ mesh, controller }) => {
        const deviceId = mesh?.metadata?.deviceId || mesh?.parent?.metadata?.deviceId;
        if (deviceId && devices.has(deviceId)) {
          selectDevice(deviceId);
          showVRNotification(`选中: ${devices.get(deviceId).name}`);
          highlightDeviceVR(deviceId);
        }
      });
    }

    xrHelper.input.onControllerAddedObservable.add((controller) => {
      controller.onMotionControllerInitObservable.add((motionController) => {
        const triggerComponent = motionController.getComponent('xr-standard-trigger');
        if (triggerComponent) {
          triggerComponent.onButtonStateChangedObservable.add((component) => {
            if (component.pressed) {
              const ray = controller.getWorldPointerRayToRef();
              const hit = scene.pickWithRay(ray);
              if (hit.hit && hit.pickedMesh) {
                const deviceId = hit.pickedMesh.metadata?.deviceId || hit.pickedMesh.parent?.metadata?.deviceId;
                if (deviceId) {
                  sendControlCommand(deviceId, 'toggle');
                  showVRNotification(`已发送控制指令`);
                }
              }
            }
          });
        }
      });
    });
  };

  const highlightDeviceVR = (deviceId) => {
    scene.meshes.forEach((m) => {
      if (m.metadata?.deviceId === deviceId && m.material) {
        const originalEmissive = m.material.emissiveColor.clone();
        m.material.emissiveColor = new Color3(0.5, 0.5, 0.2);
        setTimeout(() => {
          if (m.material) m.material.emissiveColor = originalEmissive;
        }, 2000);
      }
    });
  };

  const createVRDashboard = (xrHelper) => {
    const gui = xrHelper.guisManager;
    if (!gui) return;

    const panel = gui.createPanel();
    panel.mesh.position.set(0, 2, -0.5);
    panel.mesh.rotation.x = -0.2;

    const title = gui.createTextPanel('🏭 数字孪生工厂', 0.4, 0.08);
    title.color = 'white';
    title.background = 'rgba(102, 126, 234, 0.9)';
    title.fontSize = 24;
    panel.addControl(title);

    const stats = gui.createTextPanel(`设备总数: ${devices.size}`, 0.4, 0.08);
    stats.color = 'white';
    stats.background = 'rgba(0, 0, 0, 0.7)';
    panel.addControl(stats);

    const help = gui.createTextPanel('操作: 射线指向设备+扣动扳机选中', 0.4, 0.1);
    help.color = '#aaa';
    help.background = 'rgba(0, 0, 0, 0.5)';
    help.fontSize = 16;
    panel.addControl(help);

    const updateStats = () => {
      if (panel.mesh.isEnabled()) {
        const running = Array.from(devices.values()).filter(d => d.running).length;
        stats.text = `运行中: ${running}/${devices.size}`;
        requestAnimationFrame(updateStats);
      }
    };
    setTimeout(updateStats, 1000);
  };

  const showVRNotification = (message) => {
    if (!xrHelperRef.current) return;

    const gui = xrHelperRef.current.guisManager;
    if (!gui) return;

    const panel = gui.createPanel();
    panel.mesh.position.set(0, 1.5, 1);

    const textMesh = gui.createTextPanel(message, 0.4, 0.08);
    textMesh.background = 'rgba(82, 196, 26, 0.9)';
    textMesh.color = 'white';
    textMesh.fontSize = 20;
    panel.addControl(textMesh);

    setTimeout(() => panel.dispose(), 2500);
  };

  const enterVR = async () => {
    if (xrHelperRef.current && !inVR) {
      try {
        await xrHelperRef.current.baseExperience.enterXRAsync(
          'immersive-vr',
          'local-floor'
        );
      } catch (e) {
        console.error('Failed to enter VR:', e);
        alert('无法进入VR模式\n\n请确保:\n1. VR设备已连接并启动SteamVR/Oculus\n2. 使用Chrome/Edge浏览器\n3. 已在浏览器中启用WebXR实验功能');
      }
    }
  };

  const exitVR = async () => {
    if (xrHelperRef.current && inVR) {
      await xrHelperRef.current.baseExperience.exitXRAsync();
    }
  };

  if (!vrSupported) {
    return (
      <div className="vr-button disabled">
        <span>🥽 VR不可用</span>
        <small>请使用Chrome/Edge浏览器，并连接VR设备（Meta Quest, HTC Vive等）</small>
      </div>
    );
  }

  return (
    <div className={`vr-button ${inVR ? 'active' : ''}`}>
      {inVR ? (
        <button onClick={exitVR} className="vr-exit-btn">
          退出VR模式
        </button>
      ) : (
        <button onClick={enterVR} className="vr-enter-btn">
          🥽 进入VR模式
        </button>
      )}
      <div className="vr-status">
        <span className={`vr-dot ${inVR ? 'connected' : ''}`}></span>
        {inVR ? 'VR会话中' : 'WebXR就绪'}
      </div>

      <style jsx>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(82, 196, 26, 0.4); }
          50% { box-shadow: 0 0 40px rgba(82, 196, 26, 0.7); }
        }
        .active {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default VRMode;
