"""
Search Service - Handles face detection and matching in video files
"""

import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path
from datetime import datetime
import json
import logging
from typing import List, Dict, Any
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SearchService:
    """Service for searching lost persons in video footage"""
    
    def __init__(self):
        """Initialize face detection and recognition models"""
        logger.info("Initializing SearchService...")
        
        # Initialize MediaPipe Face Detection
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # Long-range model for CCTV
            min_detection_confidence=0.5
        )
        
        # Load face recognition model
        self.face_model = self._load_face_model()
        
        # Settings
        self.similarity_threshold = 0.6  # Lower threshold for crowd detection
        self.frame_skip = 5  # Process every 5th frame for speed
        
        logger.info("SearchService initialized successfully")
    
    def _load_face_model(self):
        """Load pre-trained ResNet for face recognition"""
        try:
            import torchvision.models as models
            model = models.resnet18(pretrained=True)
            model = nn.Sequential(*list(model.children())[:-1])
            model.eval()
            logger.info("ResNet18 face model loaded")
            return model
        except Exception as e:
            logger.warning(f"Could not load ResNet: {e}. Using fallback method.")
            return None
    
    def extract_face_embedding(self, face_image: np.ndarray) -> np.ndarray:
        """Extract face embedding from image"""
        try:
            if self.face_model is None:
                # Fallback: histogram-based features
                gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
                gray = cv2.resize(gray, (100, 100))
                hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
                hist = cv2.normalize(hist, hist).flatten()
                return hist
            
            # Use neural network
            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                   std=[0.229, 0.224, 0.225])
            ])
            
            pil_image = Image.fromarray(cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB))
            image_tensor = transform(pil_image).unsqueeze(0)
            
            with torch.no_grad():
                embedding = self.face_model(image_tensor)
            
            embedding = embedding.squeeze().numpy()
            if np.linalg.norm(embedding) > 0:
                embedding = embedding / np.linalg.norm(embedding)
            
            return embedding
            
        except Exception as e:
            logger.warning(f"Error in embedding extraction: {e}")
            # Fallback
            gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (100, 100))
            return cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    
    def detect_faces_in_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Detect all faces in a frame"""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(rgb_frame)
        
        faces = []
        
        if results.detections:
            h, w, _ = frame.shape
            
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                confidence = float(detection.score[0])
                
                # Convert relative coordinates to pixel coordinates
                x1 = max(0, int(bbox.xmin * w) - 15)
                y1 = max(0, int(bbox.ymin * h) - 15)
                x2 = min(w, int((bbox.xmin + bbox.width) * w) + 15)
                y2 = min(h, int((bbox.ymin + bbox.height) * h) + 15)
                
                # Extract face ROI
                face_roi = frame[y1:y2, x1:x2].copy()
                
                if face_roi.size > 0:
                    faces.append({
                        'bbox': (x1, y1, x2, y2),
                        'face': face_roi,
                        'confidence': confidence
                    })
        
        return faces
    
    def calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate similarity between two embeddings (cosine similarity)"""
        # Normalize embeddings
        e1 = embedding1 / (np.linalg.norm(embedding1) + 1e-8)
        e2 = embedding2 / (np.linalg.norm(embedding2) + 1e-8)
        
        # Cosine similarity
        similarity = float(np.dot(e1, e2))
        
        # Convert to 0-1 range
        similarity = (similarity + 1) / 2
        
        return similarity
    
    async def search_in_videos(self, lost_person_path: str, video_paths: List[Path], search_id: str) -> Dict[str, Any]:
        """
        Search for lost person in video files
        
        Args:
            lost_person_path: Path to the lost person's photo
            video_paths: List of video file paths to search in
            search_id: Unique search identifier
            
        Returns:
            Search results with matches
        """
        results_dir = Path("results")
        results_dir.mkdir(exist_ok=True)
        
        logger.info(f"Starting search {search_id} for {len(video_paths)} videos")
        
        try:
            # Extract lost person's face embedding
            lost_person_image = cv2.imread(lost_person_path)
            if lost_person_image is None:
                logger.error(f"Could not read lost person image: {lost_person_path}")
                return {"error": "Could not read uploaded image"}
            
            # Detect face in lost person photo
            lost_person_faces = self.detect_faces_in_frame(lost_person_image)
            
            if not lost_person_faces:
                logger.warning("No face detected in lost person photo")
                return {"error": "No face detected in the uploaded photo"}
            
            # Use the first (largest) face
            lost_person_embedding = self.extract_face_embedding(lost_person_faces[0]['face'])
            logger.info(f"Lost person face embedding extracted")
            
            # Search results
            matches = []
            search_stats = {
                "total_videos": len(video_paths),
                "videos_processed": 0,
                "total_frames_processed": 0,
                "matches_found": 0
            }
            
            # Process each video
            for video_path in video_paths:
                video_path = Path(video_path)
                if not video_path.exists():
                    logger.warning(f"Video file not found: {video_path}")
                    continue
                
                logger.info(f"Processing video: {video_path.name}")
                
                # Open video
                cap = cv2.VideoCapture(str(video_path))
                frame_count = 0
                fps = cap.get(cv2.CAP_PROP_FPS)
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                
                frame_idx = 0
                
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Skip frames for faster processing
                    if frame_idx % self.frame_skip != 0:
                        frame_idx += 1
                        continue
                    
                    frame_idx += 1
                    frame_count += 1
                    
                    # Detect faces in frame
                    detected_faces = self.detect_faces_in_frame(frame)
                    
                    for face_data in detected_faces:
                        face_embedding = self.extract_face_embedding(face_data['face'])
                        similarity = self.calculate_similarity(lost_person_embedding, face_embedding)
                        
                        # If match found
                        if similarity >= self.similarity_threshold:
                            timestamp = (frame_idx / fps) if fps > 0 else 0
                            
                            # Save snapshot
                            snapshot_name = f"{search_id}_{video_path.stem}_{frame_count}.jpg"
                            snapshot_path = results_dir / snapshot_name
                            
                            # Draw box and save
                            frame_copy = frame.copy()
                            x1, y1, x2, y2 = face_data['bbox']
                            cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 255, 0), 2)
                            cv2.imwrite(str(snapshot_path), frame_copy)
                            
                            match = {
                                "camera": video_path.stem,
                                "camera_name": video_path.stem.replace("_", " ").title(),
                                "confidence": round(similarity * 100, 2),
                                "timestamp": round(timestamp, 2),
                                "frame_number": frame_count,
                                "snapshot": snapshot_name,
                                "time_formatted": self._format_time(timestamp)
                            }
                            
                            matches.append(match)
                            search_stats["matches_found"] += 1
                            
                            logger.info(f"Match found: {match['camera']} at {match['time_formatted']} (confidence: {match['confidence']}%)")
                
                cap.release()
                search_stats["videos_processed"] += 1
                search_stats["total_frames_processed"] += frame_count
                logger.info(f"Completed video: {video_path.name} ({frame_count} frames processed)")
            
            # Sort matches by confidence (descending)
            matches.sort(key=lambda x: x['confidence'], reverse=True)
            
            # Prepare final results
            final_results = {
                "search_id": search_id,
                "timestamp": datetime.now().isoformat(),
                "status": "completed",
                "matches": matches,
                "stats": search_stats,
                "summary": {
                    "total_matches": len(matches),
                    "best_match_confidence": matches[0]['confidence'] if matches else 0,
                    "cameras_with_matches": len(set(m['camera'] for m in matches))
                }
            }
            
            # Save results to file
            results_file = results_dir / f"{search_id}.json"
            with open(results_file, "w") as f:
                json.dump(final_results, f, indent=2)
            
            logger.info(f"Search {search_id} completed. Found {len(matches)} matches.")
            
            return final_results
            
        except Exception as e:
            logger.error(f"Error during search: {str(e)}")
            error_result = {
                "search_id": search_id,
                "status": "error",
                "error": str(e)
            }
            
            # Save error result
            results_file = results_dir / f"{search_id}.json"
            with open(results_file, "w") as f:
                json.dump(error_result, f)
            
            return error_result
    
    def _format_time(self, seconds: float) -> str:
        """Format seconds to MM:SS format"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
    async def test_rtsp_connection(self, rtsp_url: str, username: str = None, password: str = None) -> Dict[str, Any]:
        """Test if RTSP stream is accessible"""
        try:
            logger.info(f"Testing RTSP connection: {rtsp_url[:50]}...")
            
            # Try to open stream
            cap = cv2.VideoCapture(rtsp_url)
            
            if not cap.isOpened():
                logger.warning(f"Cannot connect to RTSP stream")
                return {
                    "connected": False,
                    "error": "Cannot open RTSP stream"
                }
            
            # Try to read a frame
            ret, frame = cap.read()
            cap.release()
            
            if ret:
                logger.info("RTSP connection successful")
                return {
                    "connected": True,
                    "message": "Stream is accessible"
                }
            else:
                return {
                    "connected": False,
                    "error": "Cannot read frame from stream"
                }
                
        except Exception as e:
            logger.error(f"RTSP test error: {e}")
            return {
                "connected": False,
                "error": str(e)
            }
    
    async def capture_rtsp_footage(
        self,
        rtsp_url: str,
        duration_seconds: int = 15,
        camera_name: str = "CCTV",
        output_dir: str = "CCTVS"
    ) -> str:
        """
        Capture footage from live RTSP stream (max 15 seconds)
        
        Args:
            rtsp_url: RTSP stream URL
            duration_seconds: How long to record (default/max 15 seconds)
            camera_name: Name of camera for logging
            output_dir: Directory to save captured video
            
        Returns:
            Path to saved video file or None if failed
        """
        try:
            # Enforce 15-second maximum
            duration_seconds = min(duration_seconds, 15)
            
            logger.info(f"Starting RTSP capture from {camera_name} for {duration_seconds}s...")
            
            # Open RTSP stream
            cap = cv2.VideoCapture(rtsp_url)
            
            if not cap.isOpened():
                logger.error(f"Failed to connect to RTSP stream: {camera_name}")
                return None
            
            # Get stream properties
            fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            if width == 0 or height == 0:
                logger.error(f"Invalid stream resolution: {width}x{height}")
                cap.release()
                return None
            
            logger.info(f"Stream {camera_name}: {width}x{height} @ {fps} FPS")
            
            # Create output directory
            output_path_obj = Path(output_dir)
            output_path_obj.mkdir(parents=True, exist_ok=True)
            
            # Create output file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = "".join(c for c in camera_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            output_file = output_path_obj / f"rtsp_capture_{safe_name}_{timestamp}.mp4"
            
            # Setup video writer
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(
                str(output_file),
                fourcc,
                fps,
                (width, height)
            )
            
            if not out.isOpened():
                logger.error(f"Failed to open video writer for {output_file}")
                cap.release()
                return None
            
            # Capture frames
            frame_count = 0
            max_frames = fps * duration_seconds
            start_time = datetime.now()
            
            logger.info(f"Capturing {max_frames} frames ({duration_seconds}s at {fps} FPS)")
            
            while frame_count < max_frames:
                ret, frame = cap.read()
                
                if not ret:
                    logger.warning(f"Lost connection to {camera_name} after {frame_count} frames")
                    break
                
                out.write(frame)
                frame_count += 1
                
                # Log progress every 5 seconds
                if frame_count % max(1, fps * 5) == 0:
                    elapsed = (datetime.now() - start_time).total_seconds()
                    logger.info(f"{camera_name}: {frame_count}/{max_frames} frames ({elapsed:.1f}s)")
            
            # Release resources
            cap.release()
            out.release()
            
            if frame_count == 0:
                logger.error(f"No frames captured from {camera_name}")
                output_file.unlink(missing_ok=True)
                return None
            
            logger.info(f"Capture complete: {output_file} ({frame_count} frames)")
            return str(output_file)
            
        except Exception as e:
            logger.error(f"Error capturing from RTSP {camera_name}: {e}")
            return None