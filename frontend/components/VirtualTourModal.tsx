"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  X,
  Maximize2,
  Minimize2,
  Compass as CompassIcon,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Sparkles,
  Box,
  Eye,
} from "lucide-react";

interface VirtualTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelName: string;
  cityName?: string;
  imageUrl: string;
  altText?: string;
}

export function VirtualTourModal({
  isOpen,
  onClose,
  hotelName,
  cityName,
  imageUrl,
  altText,
}: VirtualTourModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [headingDegrees, setHeadingDegrees] = useState(0);
  const [fov, setFov] = useState(75);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Spherical coordinate tracking
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const targetLonRef = useRef(0);
  const targetLatRef = useRef(0);
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const autoRotateRef = useRef(true);

  // Sync autoRotate state with ref
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Handle Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Handle key shortcuts (Escape, F)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (e.key === " ") {
        e.preventDefault();
        setAutoRotate((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, toggleFullscreen]);

  // Three.js Scene Setup & Animation Loop
  useEffect(() => {
    if (!isOpen || !canvasContainerRef.current) return;

    setIsLoading(true);
    setLoadError(null);
    lonRef.current = 0;
    latRef.current = 0;
    targetLonRef.current = 0;
    targetLatRef.current = 0;
    velocityRef.current = { x: 0, y: 0 };

    const width = canvasContainerRef.current.clientWidth || 800;
    const height = canvasContainerRef.current.clientHeight || 600;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    const currentCanvasContainer = canvasContainerRef.current;
    currentCanvasContainer.innerHTML = "";
    currentCanvasContainer.appendChild(renderer.domElement);

    // 3. Inverted 360° Sphere Geometry
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    // Invert geometry normals so inner faces receive texture
    geometry.scale(-1, 1, 1);

    // 4. Load High-Res Texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";

    let mesh: THREE.Mesh | null = null;

    textureLoader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({ map: texture });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.warn("Failed to load 360 texture from primary URL, trying fallback:", err);
        // Fallback luxury photosphere texture
        const fallbackUrl =
          "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=2400&q=90";
        textureLoader.load(
          fallbackUrl,
          (fallbackTex) => {
            fallbackTex.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.MeshBasicMaterial({ map: fallbackTex });
            mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            setIsLoading(false);
          },
          undefined,
          (fatalErr) => {
            console.error("Fatal texture load failure", fatalErr);
            setLoadError("Unable to render 360° scene. Please try again.");
            setIsLoading(false);
          }
        );
      }
    );

    // 5. Render Loop with Inertia Damping & Dynamic Compass Yaw
    let lastTime = performance.now();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!isDraggingRef.current) {
        if (autoRotateRef.current) {
          // Subtle idle ambient spin
          targetLonRef.current += 4.5 * delta;
        } else {
          // Inertia damping
          targetLonRef.current += velocityRef.current.x;
          targetLatRef.current += velocityRef.current.y;
          velocityRef.current.x *= 0.92;
          velocityRef.current.y *= 0.92;
        }
      }

      // Smooth interpolation toward target coordinates
      lonRef.current += (targetLonRef.current - lonRef.current) * 0.15;
      latRef.current += (targetLatRef.current - latRef.current) * 0.15;

      // Clamp latitude to avoid pole gimbal flipping
      latRef.current = Math.max(-85, Math.min(85, latRef.current));
      targetLatRef.current = Math.max(-85, Math.min(85, targetLatRef.current));

      const phi = THREE.MathUtils.degToRad(90 - latRef.current);
      const theta = THREE.MathUtils.degToRad(lonRef.current);

      const targetX = 500 * Math.sin(phi) * Math.cos(theta);
      const targetY = 500 * Math.cos(phi);
      const targetZ = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(targetX, targetY, targetZ);
      renderer.render(scene, camera);

      // Compute normalized compass heading (0° - 360°)
      const normalizedYaw = ((lonRef.current % 360) + 360) % 360;
      setHeadingDegrees(Math.round(normalizedYaw));
    };

    animate();

    // 6. Resize Observer for dynamic responsiveness
    const handleResize = () => {
      if (!currentCanvasContainer || !rendererRef.current || !cameraRef.current) return;
      const newWidth = currentCanvasContainer.clientWidth;
      const newHeight = currentCanvasContainer.clientHeight;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentCanvasContainer);

    // Cleanup on unmount or close
    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      geometry.dispose();
      if (mesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
      renderer.dispose();
      if (currentCanvasContainer) {
        currentCanvasContainer.innerHTML = "";
      }
    };
  }, [isOpen, imageUrl]);

  // Pointer Drag Interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { x: 0, y: 0 };
    setAutoRotate(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - prevMousePosRef.current.x;
    const dy = e.clientY - prevMousePosRef.current.y;

    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    const sensitivity = 0.18;
    const deltaLon = -dx * sensitivity;
    const deltaLat = dy * sensitivity;

    targetLonRef.current += deltaLon;
    targetLatRef.current += deltaLat;

    velocityRef.current = {
      x: deltaLon * 0.4,
      y: deltaLat * 0.4,
    };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Zoom control (Mouse Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!cameraRef.current) return;

    const delta = e.deltaY * 0.05;
    const nextFov = Math.max(35, Math.min(95, cameraRef.current.fov + delta));
    cameraRef.current.fov = nextFov;
    cameraRef.current.updateProjectionMatrix();
    setFov(Math.round(nextFov));
  };

  // Zoom buttons
  const adjustZoom = (deltaFov: number) => {
    if (!cameraRef.current) return;
    const nextFov = Math.max(35, Math.min(95, cameraRef.current.fov + deltaFov));
    cameraRef.current.fov = nextFov;
    cameraRef.current.updateProjectionMatrix();
    setFov(Math.round(nextFov));
  };

  // Reset View
  const handleResetView = () => {
    targetLonRef.current = 0;
    targetLatRef.current = 0;
    velocityRef.current = { x: 0, y: 0 };
    if (cameraRef.current) {
      cameraRef.current.fov = 75;
      cameraRef.current.updateProjectionMatrix();
      setFov(75);
    }
  };

  // Cardinal direction label
  const getCardinalDirection = (deg: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-stone-950/95 backdrop-blur-xl animate-fade-in select-none text-stone-100"
    >
      {/* Top Bar / Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-stone-800/80 bg-stone-900/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white tracking-wide">{hotelName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                360° Digital Twin
              </span>
            </div>
            <p className="text-xs text-stone-400">
              {cityName ? `${cityName} • ` : ""}
              {altText || "Immersive Photosphere • Real-time WebGL Spherical Projection"}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
            className="p-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/60 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            title="Close Tour (Esc)"
            className="p-2.5 rounded-xl bg-stone-800/80 hover:bg-red-500/20 hover:text-red-300 text-stone-300 border border-stone-700/60 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div
        className="relative flex-1 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div ref={canvasContainerRef} className="w-full h-full" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/80 backdrop-blur-md z-20">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-ping" />
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-medium text-stone-200 tracking-wide flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              Calibrating 360° Photosphere Twin...
            </p>
            <p className="text-xs text-stone-400 mt-1">Inverting spherical geometry & mapping high-res textures</p>
          </div>
        )}

        {/* Error State */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950/90 z-20">
            <p className="text-sm text-red-400 font-medium mb-3">{loadError}</p>
            <button
              onClick={handleResetView}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Floating Directional Compass HUD (Top Left) */}
        <div className="absolute top-6 left-6 z-10 flex items-center gap-3 px-3 py-2 rounded-2xl bg-stone-900/80 border border-stone-700/60 backdrop-blur-md shadow-2xl">
          <div className="relative w-9 h-9 flex items-center justify-center">
            {/* Compass outer ring */}
            <div className="absolute inset-0 rounded-full border border-stone-600/80" />
            {/* Rotating needle aligned with camera yaw */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75"
              style={{ transform: `rotate(${-headingDegrees}deg)` }}
            >
              <CompassIcon className="w-7 h-7 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
            </div>
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-stone-400 font-mono">Bearing</div>
            <div className="text-xs font-bold text-white font-mono">
              {String(headingDegrees).padStart(3, "0")}° {getCardinalDirection(headingDegrees)}
            </div>
          </div>
        </div>

        {/* Floating Interaction Tips (Top Right) */}
        <div className="hidden md:flex absolute top-6 right-6 z-10 items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900/70 border border-stone-800/80 backdrop-blur-md text-[11px] text-stone-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Click & Drag to Look • Scroll to Zoom</span>
        </div>

        {/* Floating Controls Dock (Bottom Center) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 p-1.5 rounded-2xl bg-stone-900/85 border border-stone-700/60 backdrop-blur-lg shadow-2xl">
          {/* Auto-Rotate Toggle */}
          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            title={autoRotate ? "Pause Auto-Rotation (Space)" : "Start Auto-Rotation (Space)"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              autoRotate
                ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
                : "bg-stone-800/90 text-stone-300 hover:bg-stone-700 hover:text-white"
            }`}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRotate ? "Orbiting" : "Orbit"}</span>
          </button>

          <div className="w-[1px] h-5 bg-stone-700/60 mx-0.5" />

          {/* Zoom Out */}
          <button
            onClick={() => adjustZoom(10)}
            title="Zoom Out"
            className="p-2 rounded-xl bg-stone-800/90 hover:bg-stone-700 text-stone-300 hover:text-white transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Current FOV indicator */}
          <span className="text-[11px] font-mono text-stone-400 w-10 text-center">{fov}°</span>

          {/* Zoom In */}
          <button
            onClick={() => adjustZoom(-10)}
            title="Zoom In"
            className="p-2 rounded-xl bg-stone-800/90 hover:bg-stone-700 text-stone-300 hover:text-white transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-stone-700/60 mx-0.5" />

          {/* Reset View */}
          <button
            onClick={handleResetView}
            title="Reset Angle & Zoom"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
