"""
Custom YOLO model inference service
"""
import io
import os
from typing import List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont

# Patch torch.load to work with custom YOLO models in PyTorch 2.6+
import torch
_original_torch_load = torch.load

def _patched_torch_load(f, map_location=None, pickle_module=None, weights_only=None, **kwargs):
    """Patched torch.load that sets weights_only=False for .pt files"""
    # For .pt files (YOLO models), we trust them and set weights_only=False
    if isinstance(f, str) and f.endswith('.pt'):
        weights_only = False
    return _original_torch_load(f, map_location=map_location, pickle_module=pickle_module, 
                                weights_only=weights_only, **kwargs)

torch.load = _patched_torch_load

from ultralytics import YOLO
from app.models.schemas import RoboflowResponse, RoboflowPrediction


class RoboflowService:
    """Service for custom YOLO model inference"""
    
    def __init__(self):
        # Load custom YOLO model (best.pt)
        model_path = os.path.join(os.path.dirname(__file__), "best.pt")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        self.model = YOLO(model_path)
    
    async def analyze_image(self, image_bytes: bytes) -> RoboflowResponse:
        """
        Analyze image using custom YOLO model
        
        Args:
            image_bytes: Image file bytes (JPEG/PNG)
            
        Returns:
            RoboflowResponse with predictions
        """
        # Load and resize image if needed
        image = Image.open(io.BytesIO(image_bytes))
        image = self._resize_image(image, max_dimension=1024)
        
        # Run inference with custom YOLO model
        results = self.model(image)
        
        # Extract predictions from YOLO results
        predictions = []
        detections = results[0].boxes.data.cpu().numpy().tolist()
        class_names = results[0].names
        
        for det in detections:
            x1, y1, x2, y2, conf, cls_id = det
            
            # Convert bounding box format from (x1, y1, x2, y2) to (center_x, center_y, width, height)
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            width = x2 - x1
            height = y2 - y1
            
            predictions.append(RoboflowPrediction(
                x=float(center_x),
                y=float(center_y),
                width=float(width),
                height=float(height),
                confidence=float(conf),
                class_name=class_names[int(cls_id)],
                class_id=int(cls_id)
            ))
        
        # Return in RoboflowResponse format for compatibility
        return RoboflowResponse(
            predictions=predictions,
            image={"width": image.width, "height": image.height}
        )
    
    def calculate_damage_score(self, predictions: List[RoboflowPrediction]) -> int:
        """
        Calculate damage score from predictions (0-5 scale)
        
        Args:
            predictions: List of predictions from Roboflow
            
        Returns:
            Damage score (0-5)
        """
        if not predictions:
            return 0
        
        max_confidence = max(p.confidence for p in predictions)
        score = min(5, max(0, round(max_confidence * 5)))
        
        return score
    
    def get_primary_damage(self, predictions: List[RoboflowPrediction]) -> Tuple[Optional[str], Optional[float]]:
        """
        Get primary damage class and confidence from predictions
        
        Args:
            predictions: List of predictions from Roboflow
            
        Returns:
            Tuple of (damage_class, confidence)
        """
        if not predictions:
            return None, None
        
        # Get prediction with highest confidence
        primary = max(predictions, key=lambda p: p.confidence)
        return primary.class_name, primary.confidence
    
    async def create_annotated_image(
        self, 
        image_bytes: bytes, 
        predictions: List[RoboflowPrediction]
    ) -> bytes:
        """
        Create annotated image with bounding boxes and labels
        
        Args:
            image_bytes: Original image bytes
            predictions: List of predictions from Roboflow
            
        Returns:
            Annotated image bytes (JPEG)
        """
        # Load image
        image = Image.open(io.BytesIO(image_bytes))
        image = self._resize_image(image, max_dimension=1024)
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Draw on image
        draw = ImageDraw.Draw(image)
        
        # Try to load a font, fallback to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            font = ImageFont.load_default()
        
        # Draw each prediction
        for pred in predictions:
            # Calculate box coordinates (center x,y,width,height -> top-left x,y,bottom-right x,y)
            x1 = pred.x - pred.width / 2
            y1 = pred.y - pred.height / 2
            x2 = pred.x + pred.width / 2
            y2 = pred.y + pred.height / 2
            
            # Draw red bounding box
            draw.rectangle(
                [(x1, y1), (x2, y2)],
                outline="red",
                width=2
            )
            
            # Draw label
            label = f"{pred.class_name} {pred.confidence:.0%}"
            
            # Draw text background
            bbox = draw.textbbox((x1, y1 - 20), label, font=font)
            draw.rectangle(bbox, fill="red")
            draw.text((x1, y1 - 20), label, fill="white", font=font)
        
        # Convert to bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=95)
        img_byte_arr.seek(0)
        
        return img_byte_arr.getvalue()
    
    def _resize_image(self, image: Image.Image, max_dimension: int = 1024) -> Image.Image:
        """
        Resize image to max dimension while maintaining aspect ratio
        
        Args:
            image: PIL Image
            max_dimension: Maximum width or height
            
        Returns:
            Resized PIL Image
        """
        width, height = image.size
        
        if width <= max_dimension and height <= max_dimension:
            return image
        
        # Calculate new size
        if width > height:
            new_width = max_dimension
            new_height = int(height * (max_dimension / width))
        else:
            new_height = max_dimension
            new_width = int(width * (max_dimension / height))
        
        return image.resize((new_width, new_height), Image.Resampling.LANCZOS)


# Global service instance
roboflow_service = RoboflowService()
