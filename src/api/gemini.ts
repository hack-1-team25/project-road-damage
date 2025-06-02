// src/api/gemini.ts AIレポート
export const generateReport = async (roadInfo: Record<string, any>): Promise<string> => {
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
  
  
    const prompt = `以下の道路情報に基づいて、点検レポートを日本語で出力してください。
  
  ${JSON.stringify(roadInfo, null, 2)}
  
  レポートには、損傷の種類・信頼度・舗装種別・排水性・交通量・水道管/ガス管の情報を踏まえた総合的な説明を含めてください。`;
  
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      });
  
      if (!response.ok) {
        const errorBody = await response.json();
        console.error('レポート生成APIエラー:', errorBody);
        return `レポート生成に失敗しました (HTTPエラー: ${response.status})`;
      }
  
      const json = await response.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || "レポート生成に失敗しました。";
  
    } catch (error) {
      console.error('レポート生成中に予期せぬエラーが発生しました:', error);
      return "レポート生成中に予期せぬエラーが発生しました。";
    }
  };