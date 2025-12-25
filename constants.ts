export const APP_NAME = "VisionToData";
export const MAX_IMAGE_SIZE_MB = 10;
export const SUPPORTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Default processing settings simulating basic OpenCV pre-processing
export const DEFAULT_SETTINGS = {
  brightness: 0,
  contrast: 0,
  threshold: 0,
  grayscale: false,
  rotation: 0,
};