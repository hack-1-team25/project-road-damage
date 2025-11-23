#!/usr/bin/env python3
"""
Test script to demonstrate custom YOLO model inference on an image
"""
import sys
import os
import asyncio

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.roboflow_service import roboflow_service
from PIL import Image
import io


async def test_image_inference(image_path: str):
    """
    Test YOLO model inference on a single image
    
    Args:
        image_path: Path to test image file
    """
    print(f"\n📸 Loading image: {image_path}")
    
    # Check if image exists
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}")
        return False
    
    # Load image as bytes
    with open(image_path, 'rb') as f:
        image_bytes = f.read()
    
    print("🔍 Running inference...")
    
    # Run inference
    result = await roboflow_service.analyze_image(image_bytes)
    
    # Display results
    print(f"\n✅ Inference completed!")
    print(f"   Detections found: {len(result.predictions)}")
    print(f"   Image size: {result.image['width']}x{result.image['height']}")
    
    if result.predictions:
        print(f"\n📊 Detection results:")
        for i, pred in enumerate(result.predictions, 1):
            print(f"   {i}. {pred.class_name} - Confidence: {pred.confidence:.2%}")
            print(f"      Position: ({pred.x:.1f}, {pred.y:.1f})")
            print(f"      Size: {pred.width:.1f}x{pred.height:.1f}")
        
        # Calculate damage score
        damage_score = roboflow_service.calculate_damage_score(result.predictions)
        primary_class, primary_conf = roboflow_service.get_primary_damage(result.predictions)
        
        print(f"\n🎯 Analysis summary:")
        print(f"   Damage Score: {damage_score}/5")
        print(f"   Primary Damage: {primary_class} ({primary_conf:.2%})")
        
        # Create annotated image
        print(f"\n🎨 Creating annotated image...")
        annotated_bytes = await roboflow_service.create_annotated_image(
            image_bytes,
            result.predictions
        )
        
        # Save annotated image
        output_dir = os.path.join(os.path.dirname(__file__), "test_output")
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, f"annotated_{os.path.basename(image_path)}")
        with open(output_path, 'wb') as f:
            f.write(annotated_bytes)
        
        print(f"   ✅ Annotated image saved to: {output_path}")
    else:
        print(f"\n   ℹ️  No damage detected in this image")
    
    return True


async def main():
    """Main entry point"""
    print("=" * 70)
    print("Custom YOLO Model - Image Inference Test")
    print("=" * 70)
    
    # Check if image path is provided
    if len(sys.argv) < 2:
        print("\n❌ Usage: python test_image_inference.py <image_path>")
        print("\nExample:")
        print("   python test_image_inference.py /path/to/road_image.jpg")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    success = await test_image_inference(image_path)
    
    if success:
        print("\n✅ Test completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Test failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
