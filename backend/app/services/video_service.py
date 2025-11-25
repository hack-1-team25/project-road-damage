"""
Video processing service for frame extraction and GPS mapping
"""
import os
import csv
import subprocess
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import tempfile
from dataclasses import dataclass
import gpxpy
import gpxpy.gpx


@dataclass
class GPSPoint:
    """GPS data point"""
    timestamp: datetime
    latitude: float
    longitude: float


class VideoProcessingService:
    """Service for video processing and GPS integration"""
    
    def parse_gps_csv(self, csv_path: str) -> List[GPSPoint]:
        """
        Parse GPS CSV file
        
        CSV Format:
        - Row 0: Header (skipped)
        - Row 1+: Data rows
        - Column 0: Timestamp (ISO 8601)
        - Column 3: Latitude
        - Column 4: Longitude
        
        Args:
            csv_path: Path to GPS CSV file
            
        Returns:
            List of GPSPoint sorted by timestamp
        """
        gps_points = []
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            
            # Skip header
            next(reader)
            
            for row in reader:
                if len(row) < 5:
                    continue
                
                try:
                    timestamp = self._parse_timestamp(row[0])
                    latitude = float(row[3])
                    longitude = float(row[4])
                    
                    gps_points.append(GPSPoint(
                        timestamp=timestamp,
                        latitude=latitude,
                        longitude=longitude
                    ))
                except (ValueError, IndexError) as e:
                    print(f"Warning: Skipping invalid GPS row: {row}. Error: {e}")
                    continue
        
        # Sort by timestamp
        gps_points.sort(key=lambda p: p.timestamp)
        
        return gps_points
    
    def parse_gps_gpx(self, gpx_path: str) -> List[GPSPoint]:
        """
        Parse GPS GPX file
        
        Args:
            gpx_path: Path to GPS GPX file
            
        Returns:
            List of GPSPoint sorted by timestamp
        """
        gps_points = []
        
        with open(gpx_path, 'r', encoding='utf-8') as f:
            gpx = gpxpy.parse(f)
            
            # Extract points from all tracks and segments
            for track in gpx.tracks:
                for segment in track.segments:
                    for point in segment.points:
                        if point.time is not None:
                            gps_points.append(GPSPoint(
                                timestamp=point.time,
                                latitude=point.latitude,
                                longitude=point.longitude
                            ))
            
            # Also extract waypoints if available
            for waypoint in gpx.waypoints:
                if waypoint.time is not None:
                    gps_points.append(GPSPoint(
                        timestamp=waypoint.time,
                        latitude=waypoint.latitude,
                        longitude=waypoint.longitude
                    ))
        
        # Sort by timestamp
        gps_points.sort(key=lambda p: p.timestamp)
        
        return gps_points
    
    def parse_gps_file(self, file_path: str) -> List[GPSPoint]:
        """
        Parse GPS file (auto-detect CSV or GPX)
        
        Args:
            file_path: Path to GPS file
            
        Returns:
            List of GPSPoint sorted by timestamp
        """
        file_extension = Path(file_path).suffix.lower()
        
        if file_extension == '.gpx':
            return self.parse_gps_gpx(file_path)
        elif file_extension == '.csv':
            return self.parse_gps_csv(file_path)
        else:
            raise ValueError(f"Unsupported GPS file format: {file_extension}. Supported formats: .csv, .gpx")
    
    def find_closest_gps_point(
        self, 
        frame_timestamp_ms: int, 
        gps_points: List[GPSPoint]
    ) -> Optional[GPSPoint]:
        """
        Find closest GPS point to frame timestamp
        
        Algorithm:
        - Video start time = first GPS point timestamp
        - Frame real time = video_start_time + frame_timestamp_ms
        - Find GPS point with closest timestamp
        
        Args:
            frame_timestamp_ms: Frame timestamp in milliseconds from video start
            gps_points: List of GPS points sorted by timestamp
            
        Returns:
            Closest GPS point or None
        """
        if not gps_points:
            return None
        
        # Video start time = first GPS timestamp
        video_start_time = gps_points[0].timestamp
        
        # Calculate frame real time
        target_time = video_start_time + timedelta(milliseconds=frame_timestamp_ms)
        
        # Find closest point (linear search)
        closest = min(
            gps_points,
            key=lambda gps: abs((gps.timestamp - target_time).total_seconds())
        )
        
        return closest
    
    def get_video_metadata(self, video_path: str) -> Dict:
        """
        Get video metadata using ffprobe
        
        Args:
            video_path: Path to video file
            
        Returns:
            Dict with duration, frame_rate
        """
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            video_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        import json
        data = json.loads(result.stdout)
        
        # Get video stream
        video_stream = next(
            (s for s in data['streams'] if s['codec_type'] == 'video'),
            None
        )
        
        if not video_stream:
            raise ValueError("No video stream found")
        
        # Parse duration
        duration_seconds = float(data['format'].get('duration', 0))
        
        # Parse frame rate
        fps_parts = video_stream['r_frame_rate'].split('/')
        frame_rate = float(fps_parts[0]) / float(fps_parts[1])
        
        return {
            'duration_seconds': duration_seconds,
            'frame_rate': frame_rate
        }
    
    def extract_frame(
        self, 
        video_path: str, 
        timestamp_seconds: float, 
        output_path: str
    ) -> None:
        """
        Extract single frame from video at specific timestamp
        
        Args:
            video_path: Path to video file
            timestamp_seconds: Timestamp in seconds
            output_path: Output image path
        """
        cmd = [
            'ffmpeg',
            '-ss', str(timestamp_seconds),
            '-i', video_path,
            '-frames:v', '1',
            '-q:v', '2',  # High quality
            '-y',  # Overwrite
            output_path
        ]
        
        subprocess.run(cmd, capture_output=True, check=True)
    
    def extract_frames_at_interval(
        self,
        video_path: str,
        interval_seconds: int,
        output_dir: str
    ) -> List[Tuple[int, str, float]]:
        """
        Extract frames from video at regular intervals
        
        Args:
            video_path: Path to video file
            interval_seconds: Interval in seconds (e.g., 10 for every 10 seconds)
            output_dir: Output directory for frames
            
        Returns:
            List of (frame_index, output_path, timestamp_ms) tuples
        """
        # Get video metadata
        metadata = self.get_video_metadata(video_path)
        duration = metadata['duration_seconds']
        
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Extract frames
        frames = []
        frame_index = 0
        timestamp = 0.0
        
        while timestamp < duration:
            output_path = os.path.join(output_dir, f"frame_{frame_index:04d}.jpg")
            
            try:
                self.extract_frame(video_path, timestamp, output_path)
                timestamp_ms = timestamp * 1000
                frames.append((frame_index, output_path, timestamp_ms))
            except subprocess.CalledProcessError as e:
                print(f"Warning: Failed to extract frame at {timestamp}s: {e}")
            
            frame_index += 1
            timestamp += interval_seconds
        
        return frames
    
    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """
        Parse timestamp string to datetime
        
        Supports ISO 8601 format: 2024-01-01T10:00:00Z
        
        Args:
            timestamp_str: Timestamp string
            
        Returns:
            datetime object
        """
        # Try ISO 8601 format
        formats = [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"Unable to parse timestamp: {timestamp_str}")


# Global service instance
video_processing_service = VideoProcessingService()
