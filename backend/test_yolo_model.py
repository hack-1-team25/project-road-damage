#!/usr/bin/env python3
"""
Test script for custom YOLO model
"""
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from services.roboflow_service import roboflow_service


def test_model_loading():
    """Test if the model loads successfully"""
    try:
        print("✅ Model loaded successfully!")
        print(f"   Model type: {type(roboflow_service.model)}")
        print(f"   Model names: {roboflow_service.model.names}")
        return True
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Custom YOLO Model")
    print("=" * 60)
    
    success = test_model_loading()
    
    if success:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Tests failed!")
        sys.exit(1)
