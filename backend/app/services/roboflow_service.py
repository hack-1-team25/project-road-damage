"""
Roboflow API integration service for YOLO inference
"""
import httpx
import io
from typing import List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont
from app.core.config import settings
from app.models.schemas import RoboflowResponse, RoboflowPrediction


class RoboflowService:
    """Service for Roboflow API integration"""
    
    def __init__(self):
        self.api_key = settings.ROBOFLOW_API_KEY
        self.model_id = "road-damages-detection/1"
        self.api_url = f"https://detect.roboflow.com/{self.model_id}"
    
    async def analyze_image(self, image_bytes: bytes) -> RoboflowResponse:
        """
        Analyze image using Roboflow YOLO API
        
        Args:
            image_bytes: Image file bytes (JPEG/PNG)
            
        Returns:
            RoboflowResponse with predictions
        """
        # Resize image if needed
        image = Image.open(io.BytesIO(image_bytes))
        image = self._resize_image(image, max_dimension=1024)
        
        # Convert to JPEG bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=95)
        img_byte_arr.seek(0)
        
        # Call Roboflow API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.api_url,
                params={
                    "api_key": self.api_key,
                    "format": "json"
                },
                files={"file": ("image.jpg", img_byte_arr, "image/jpeg")}
            )
            response.raise_for_status()
            data = response.json()
        
        return RoboflowResponse(**data)
    
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
