import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Html } from '@react-three/drei';
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import DemoModel from './DemoModel';
import Annotations from './Annotations';
import CorrosionEffect from './CorrosionEffect';
import StressEffect from './StressEffect';
import SectionClipper from './SectionClipper';
import InspectionPath from './InspectionPath';
import RepairNotes from './RepairNotes';
import HistoryCompare from './HistoryCompare';
import VRMode from './VRMode';

function SceneSetup() {
  const { gl, camera } = useThree();
  const { vr } = useStore();
  
  useEffect(() => {
    gl.localClippingEnabled = true;
    gl.shadowMap.enabled = true;
  }, [gl]);

  useEffect(() => {
    if (camera) {
      camera.fov = vr.fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, vr.fov]);

  return null;
}

export default function Viewport() {
  const { activeTool, vr } = useStore();

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [10, 10, 10], fov: vr.fov || 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneSetup />
        <color attach="background" args={['#121417']} />
        <fog attach="fog" args={['#121417', 20, 50]} />
        
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={1} castShadow />
        <directionalLight position={[-10, 5, -10]} intensity={0.3} />
        
        <DemoModel />
        <Annotations />
        <CorrosionEffect />
        <StressEffect />
        <SectionClipper />
        <InspectionPath />
        <RepairNotes />
        <HistoryCompare />
        <VRMode />
        
        {!vr.enabled && (
          <Grid
            args={[30, 30]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#4E5969"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#165DFF"
            fadeDistance={40}
            fadeStrength={1}
            infiniteGrid
          />
        )}
        
        {!vr.enabled && (
          <OrbitControls
            makeDefault
            minDistance={3}
            maxDistance={40}
            enableDamping
            dampingFactor={0.05}
          />
        )}
        
        <Environment preset="city" />
      </Canvas>
      
      {activeTool && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-dark-700/90 px-4 py-2 rounded-lg text-sm">
          当前工具: {getToolName(activeTool)}
        </div>
      )}
    </div>
  );
}

function getToolName(tool: string): string {
  const names: Record<string, string> = {
    model: '模型加载',
    annotation: '构件标注',
    corrosion: '腐蚀查看',
    stress: '受力模拟',
    section: '截面查看',
    inspection: '自动巡检',
    repair: '维修标注',
    history: '版本对比',
    vr: 'VR模式',
  };
  return names[tool] || tool;
}
