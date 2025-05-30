interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
}

interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image: {
    width: number;
    height: number;
  };
}

const ROBOFLOW_API_KEY = "Jg5nNY2yVf0uOReHR3C7";
const ROBOFLOW_MODEL = "road-damages-detection/1";

export const simulateAIDamageAssessment = async (file: File): Promise<number> => {
  try {
    // Create form data for the API request
    const formData = new FormData();
    formData.append('file', file);

    // Make API request to Roboflow
    const response = await fetch(
      `https://detect.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_API_KEY}`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as RoboflowResponse;

    // If no predictions, return 0 (no damage)
    if (!data.predictions || data.predictions.length === 0) {
      return 0;
    }

    // Get the highest confidence prediction
    const highestConfidence = Math.max(
      ...data.predictions.map(pred => pred.confidence)
    );

    // Convert confidence (0-1) to damage score (0-5)
    const damageScore = Math.round(highestConfidence * 5);

    return Math.min(5, Math.max(0, damageScore));
  } catch (error) {
    console.error('Error in Roboflow API call:', error);
    // Return 0 if API call fails
    return 0;
  }
};