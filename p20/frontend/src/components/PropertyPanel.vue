<template>
  <div class="property-panel">
    <div class="panel-section">
      <h3>Add Object</h3>
      <div class="button-group">
        <el-button size="small" @click="addObject('Cube')">Cube</el-button>
        <el-button size="small" @click="addObject('Sphere')">Sphere</el-button>
        <el-button size="small" @click="addObject('Cylinder')">Cylinder</el-button>
        <el-button size="small" @click="addObject('Torus')">Torus</el-button>
        <el-button size="small" @click="addObject('Plane')">Plane</el-button>
      </div>
    </div>

    <div class="panel-section" v-if="selectedObject">
      <h3>Properties</h3>
      
      <div class="property-row">
        <label>Name</label>
        <el-input 
          v-model="nameValue" 
          size="small" 
          @change="updateName"
        />
      </div>

      <div class="property-row">
        <label>Color</label>
        <el-color-picker 
          v-model="colorValue" 
          size="small" 
          @change="updateColor"
          show-alpha
        />
      </div>

      <h4>Position</h4>
      <div class="vector-input">
        <div class="vector-item">
        <label>X</label>
        <el-input-number 
          v-model="positionX" 
          size="small" 
          :step="0.1"
          @change="updateTransform"
        />
        </div>
        <div class="vector-item">
        <label>Y</label>
        <el-input-number 
          v-model="positionY" 
          size="small" 
          :step="0.1"
          @change="updateTransform"
        />
        </div>
        <div class="vector-item">
        <label>Z</label>
        <el-input-number 
          v-model="positionZ" 
          size="small" 
          :step="0.1"
          @change="updateTransform"
        />
        </div>
      </div>

      <h4>Rotation</h4>
      <div class="vector-input">
        <div class="vector-item">
        <label>X</label>
        <el-input-number 
          v-model="rotationX" 
          size="small" 
          :step="0.1"
          @change="updateTransform"
        />
        </div>
        <div class="vector-item">
        <label>Y</label>
        <el-input-number 
          v-model="rotationY" 
          size="small" 
          :step="0.1"
          @change="updateTransform"
        />
        </div>
        <div class="vector-item">
        <label>Z</label>
        <el-input-number 
          v-model="rotationZ" 
          size="small" 
          :step="0.1"
          @change="updateTransform"
        />
        </div>
      </div>

      <h4>Scale</h4>
      <div class="vector-input">
        <div class="vector-item">
        <label>X</label>
        <el-input-number 
          v-model="scaleX" 
          size="small" 
          :step="0.1"
          :min="0.01"
          @change="updateTransform"
        />
        </div>
        <div class="vector-item">
        <label>Y</label>
        <el-input-number 
          v-model="scaleY" 
          size="small" 
          :step="0.1"
          :min="0.01"
          @change="updateTransform"
        />
        </div>
        <div class="vector-item">
        <label>Z</label>
        <el-input-number 
          v-model="scaleZ" 
          size="small" 
          :step="0.1"
          :min="0.01"
          @change="updateTransform"
        />
        </div>
      </div>

      <el-button 
        type="danger" 
        size="small" 
        @click="deleteObject"
        style="margin-top: 16px; width: 100%"
      >
        Delete Object
      </el-button>
    </div>

    <div class="panel-section">
      <h3>History</h3>
      <el-button 
        type="primary" 
        size="small" 
        @click="createSnapshot"
        style="width: 100%; margin-bottom: 8px"
      >
        Save Snapshot
      </el-button>
      
      <div class="snapshot-list">
        <div 
          v-for="snapshot in snapshots" 
          :key="snapshot.id"
          class="snapshot-item"
          @click="rollback(snapshot.version)"
        >
          <span class="version">v{{ snapshot.version }}</span>
          <span class="date">{{ formatDate(snapshot.created_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useSceneStore } from '../store/scene';

const sceneStore = useSceneStore();

const selectedObject = computed(() => sceneStore.selectedObject);
const snapshots = computed(() => sceneStore.snapshots);

const nameValue = ref('');
const colorValue = ref('#ffffff');
const positionX = ref(0);
const positionY = ref(0);
const positionZ = ref(0);
const rotationX = ref(0);
const rotationY = ref(0);
const rotationZ = ref(0);
const scaleX = ref(1);
const scaleY = ref(1);
const scaleZ = ref(1);

watch(selectedObject, (obj) => {
  if (obj) {
    nameValue.value = obj.name;
    colorValue.value = obj.color;
    positionX.value = obj.position.x;
    positionY.value = obj.position.y;
    positionZ.value = obj.position.z;
    rotationX.value = obj.rotation.x;
    rotationY.value = obj.rotation.y;
    rotationZ.value = obj.rotation.z;
    scaleX.value = obj.scale.x;
    scaleY.value = obj.scale.y;
    scaleZ.value = obj.scale.z;
  }
}, { immediate: true });

const addObject = (type) => {
  sceneStore.addObject(type);
};

const updateName = () => {
  if (selectedObject.value) {
    sceneStore.updateObjectName(selectedObject.value.id, nameValue.value);
  }
};

const updateColor = () => {
  if (selectedObject.value) {
    sceneStore.updateObjectColor(selectedObject.value.id, colorValue.value);
  }
};

const updateTransform = () => {
  if (selectedObject.value) {
    sceneStore.updateObjectTransform(selectedObject.value.id, {
      position: { x: positionX.value, y: positionY.value, z: positionZ.value },
      rotation: { x: rotationX.value, y: rotationY.value, z: rotationZ.value },
      scale: { x: scaleX.value, y: scaleY.value, z: scaleZ.value }
    });
  }
};

const deleteObject = () => {
  if (selectedObject.value) {
    sceneStore.deleteObject(selectedObject.value.id);
  }
};

const createSnapshot = async () => {
  await sceneStore.createSnapshot();
  await sceneStore.fetchSnapshots();
};

const rollback = async (version) => {
  await sceneStore.rollbackToVersion(version);
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};
</script>

<style scoped>
.property-panel {
  width: 280px;
  height: 100%;
  background: #252526;
  color: #cccccc;
  padding: 16px;
  overflow-y: auto;
  border-right: 1px solid #3c3c3c;
}

.panel-section {
  margin-bottom: 24px;
}

.panel-section h3 {
  font-size: 14px;
  margin: 0 0 12px 0;
  color: #ffffff;
}

.panel-section h4 {
  font-size: 12px;
  margin: 16px 0 8px 0;
  color: #bbbbbb;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.property-row {
  margin-bottom: 12px;
}

.property-row label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}

.vector-input {
  display: flex;
  gap: 8px;
}

.vector-item {
  flex: 1;
}

.vector-item label {
  display: block;
  font-size: 11px;
  margin-bottom: 2px;
}

.snapshot-list {
  max-height: 200px;
  overflow-y: auto;
}

.snapshot-item {
  padding: 8px;
  background: #2d2d30;
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.snapshot-item:hover {
  background: #3e3e42;
}

.snapshot-item .version {
  font-weight: bold;
  color: #4fc3f7;
}

.snapshot-item .date {
  color: #888;
}
</style>
