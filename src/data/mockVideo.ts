// src/data/mockVideo.ts

// 空のダミー動画Blobを生成（実ファイルではなくテスト用途）
const dummyVideoBlob = new Blob(["dummy content"], { type: "video/mp4" });

export const mockVideoFile = new File([dummyVideoBlob], "mock-video.mp4", {
  type: "video/mp4",
  lastModified: new Date().getTime(),
});
