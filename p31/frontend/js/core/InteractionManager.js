class InteractionManager {
    constructor(renderer, modelLoader) {
        this.renderer = renderer;
        this.modelLoader = modelLoader;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        this.hoveredObject = null;
        this.isDragging = false;
        this.dragPlane = null;
        this.dragOffset = new THREE.Vector3();
        
        this.animationProgress = 0;
        this.isAnimating = false;
        this.isPaused = false;
        this.animationDirection = 1;
        this.playbackSpeed = 1.0;
        
        this.stressViewEnabled = false;
        this.forceSimulationEnabled = false;
        this.stressMarkers = [];
        this.forceVectors = [];
        this.deformationMeshes = [];
        this.dockingMarkers = [];
        
        this.callbacks = {};
        
        this._initEventListeners();
    }

    _initEventListeners() {
        const canvas = this.renderer.canvas;
        
        canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
        canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
        canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        canvas.addEventListener('click', this._onClick.bind(this));
    }

    _onMouseMove(event) {
        const rect = this.renderer.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this._checkHover();
        
        if (this.isDragging && this.selectedObject) {
            this._updateDragPosition();
        }
    }

    _onMouseDown(event) {
        if (event.button !== 0) return;
        
        const intersects = this._getIntersects();
        if (intersects.length > 0) {
            this.selectedObject = intersects[0].object;
            this.isDragging = true;
            this.renderer.controls.enabled = false;
            
            this._createDragPlane();
            this._calculateDragOffset(intersects[0].point);
            
            this._trigger('objectSelected', this.selectedObject);
        }
    }

    _onMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.renderer.controls.enabled = true;
            this._trigger('objectDeselected', this.selectedObject);
            this.selectedObject = null;
        }
    }

    _onMouseLeave() {
        this.hoveredObject = null;
        this._updateCursor();
    }

    _onClick(event) {
        const intersects = this._getIntersects();
        if (intersects.length > 0) {
            this._trigger('objectClicked', intersects[0].object);
        }
    }

    _getIntersects() {
        this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
        const meshes = [];
        this.modelLoader.getLoadedModelKeys().forEach(key => {
            this.modelLoader.getComponentMeshes(key).forEach(mesh => meshes.push(mesh));
        });
        return this.raycaster.intersectObjects(meshes, true);
    }

    _checkHover() {
        const intersects = this._getIntersects();
        const prevHovered = this.hoveredObject;
        
        if (intersects.length > 0) {
            this.hoveredObject = intersects[0].object;
            if (prevHovered !== this.hoveredObject) {
                this._trigger('objectHovered', this.hoveredObject);
            }
        } else {
            this.hoveredObject = null;
            if (prevHovered) {
                this._trigger('objectUnhovered', prevHovered);
            }
        }
        
        this._updateCursor();
    }

    _updateCursor() {
        this.renderer.canvas.style.cursor = this.hoveredObject ? 'pointer' : 'grab';
    }

    _createDragPlane() {
        const normal = new THREE.Vector3(0, 1, 0);
        this.dragPlane = new THREE.Plane(normal, 0);
    }

    _calculateDragOffset(intersectPoint) {
        this.dragOffset.copy(this.selectedObject.position).sub(intersectPoint);
    }

    _updateDragPosition() {
        const planeIntersect = new THREE.Vector3();
        const ray = new THREE.Ray();
        ray.setFromCamera(this.mouse, this.renderer.camera);
        ray.intersectPlane(this.dragPlane, planeIntersect);
        this.selectedObject.position.copy(planeIntersect.add(this.dragOffset));
    }

    _trigger(eventName, data) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].forEach(cb => cb(data));
        }
    }

    on(eventName, callback) {
        if (!this.callbacks[eventName]) {
            this.callbacks[eventName] = [];
        }
        this.callbacks[eventName].push(callback);
        return this;
    }

    off(eventName, callback) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName] = this.callbacks[eventName].filter(cb => cb !== callback);
        }
        return this;
    }

    startDisassemblyAnimation(modelKey) {
        const meshes = this.modelLoader.getComponentMeshes(modelKey);
        if (meshes.length === 0) return;

        this.isAnimating = true;
        this.isPaused = false;
        this.animationDirection = 1;
        
        this._trigger('animationStarted', { modelKey, type: 'disassembly' });
    }

    startAssemblyAnimation(modelKey) {
        const meshes = this.modelLoader.getComponentMeshes(modelKey);
        if (meshes.length === 0) return;

        this.isAnimating = true;
        this.isPaused = false;
        this.animationDirection = -1;
        
        this._trigger('animationStarted', { modelKey, type: 'assembly' });
    }

    pauseAnimation() {
        this.isPaused = true;
        this._trigger('animationPaused');
    }

    resumeAnimation() {
        this.isPaused = false;
        this._trigger('animationResumed');
    }

    stopAnimation() {
        this.isAnimating = false;
        this.isPaused = false;
        this._trigger('animationStopped');
    }

    setAnimationProgress(progress) {
        this.animationProgress = Math.max(0, Math.min(1, progress));
        this._trigger('progressUpdated', this.animationProgress);
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(5, speed));
    }

    updateAnimation(deltaTime) {
        if (!this.isAnimating || this.isPaused) return;

        const speed = this.playbackSpeed * 0.001;
        this.animationProgress += this.animationDirection * speed * deltaTime;
        this.animationProgress = Math.max(0, Math.min(1, this.animationProgress));

        if (this.animationProgress <= 0 || this.animationProgress >= 1) {
            this.isAnimating = false;
            this._trigger('animationComplete');
        }

        this._trigger('animationProgress', this.animationProgress);
    }

    enableStressView(enabled) {
        this.stressViewEnabled = enabled;
        this._trigger('stressViewToggled', enabled);
    }

    enableForceSimulation(enabled) {
        this.forceSimulationEnabled = enabled;
        this._trigger('forceSimulationToggled', enabled);
    }

    addStressMarker(position, stressLevel) {
        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const color = this._getStressColor(stressLevel);
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        this.stressMarkers.push(marker);
        this.renderer.addObject(marker);
        return marker;
    }

    clearStressMarkers() {
        this.stressMarkers.forEach(marker => {
            this.renderer.removeObject(marker);
            marker.geometry.dispose();
            marker.material.dispose();
        });
        this.stressMarkers = [];
    }

    addForceVector(position, direction, length = 1) {
        const arrowHelper = new THREE.ArrowHelper(
            direction.normalize(),
            position,
            length,
            0xffff00,
            0.1,
            0.05
        );
        this.forceVectors.push(arrowHelper);
        this.renderer.addObject(arrowHelper);
        return arrowHelper;
    }

    clearForceVectors() {
        this.forceVectors.forEach(vector => {
            this.renderer.removeObject(vector);
        });
        this.forceVectors = [];
    }

    addDockingMarker(position, success = true) {
        const geometry = new THREE.RingGeometry(0.1, 0.15, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: success ? 0x00ff00 : 0xff0000,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        marker.lookAt(this.renderer.camera.position);
        this.dockingMarkers.push(marker);
        this.renderer.addObject(marker);
        
        setTimeout(() => {
            this.renderer.removeObject(marker);
            this.dockingMarkers = this.dockingMarkers.filter(m => m !== marker);
        }, 2000);
        
        return marker;
    }

    _getStressColor(level) {
        if (level < 0.3) return 0x00ff00;
        if (level < 0.6) return 0xffff00;
        return 0xff0000;
    }

    checkDocking(mesh1, mesh2, precision = 0.05) {
        const docking1 = mesh1.userData.dockingPoint;
        const docking2 = mesh2.userData.dockingPoint;
        
        const worldPos1 = mesh1.localToWorld(docking1.clone());
        const worldPos2 = mesh2.localToWorld(docking2.clone());
        
        const distance = worldPos1.distanceTo(worldPos2);
        const success = distance < precision;
        
        return { success, distance };
    }

    resetAllToOriginal(modelKey) {
        const meshes = this.modelLoader.getComponentMeshes(modelKey);
        meshes.forEach(mesh => {
            mesh.position.copy(mesh.userData.originalPosition);
            mesh.rotation.set(0, 0, 0);
        });
    }

    getSelectedObject() {
        return this.selectedObject;
    }

    getHoveredObject() {
        return this.hoveredObject;
    }

    dispose() {
        this.clearStressMarkers();
        this.clearForceVectors();
        this.selectedObject = null;
        this.hoveredObject = null;
    }
}
