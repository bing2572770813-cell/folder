import type { Vector3, Camera, OrthographicCamera } from 'three';
export function squareViewSpan(camera: Camera, center: Vector3, size?: number, aspect?: number): number;
export function followTarget(camera: Camera, controls: { target: Vector3 }, target: Vector3, offset: Vector3): void;
export function boundedFollowTarget(position: Vector3, width: number, height: number, size?: number): Vector3;
