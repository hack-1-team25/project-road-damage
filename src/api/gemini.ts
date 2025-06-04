// src/api/gemini.ts — Gen AI SDK（@google/genai）を使ったレポート生成
import { GoogleGenAI } from "@google/genai";

export const generateReport = async (
  roadInfo: Record<string, any>
): Promise<string> => {
  // .env に定義してある API キー（VITE_GEMINI_API_KEY）を使う想定
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY が設定されていません。");
    return "API キーが設定されていないため、レポートを生成できません。";
  }

  // Gen AI SDK のクライアントを生成（Gemini Developer API を利用するので vertexai: false）
  const ai = new GoogleGenAI({ vertexai: false, apiKey }); 
  // :contentReference[oaicite:1]{index=1}

  // もとのプロンプト部分をそのまま活用
  const prompt = `以下の道路情報に基づいて、点検レポートを日本語で出力してください。

${JSON.stringify(roadInfo, null, 2)}

レポートには、損傷の種類・信頼度・舗装種別・排水性・交通量・水道管/ガス管の情報を踏まえた総合的な説明を含めてください。`;

  try {
    // generateContent に渡すオブジェクトの形は、
    // { model: "<モデル名>", contents: [{ role: "user", parts: [{ text: "<プロンプト>" }] }] }
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // 使いたい Gemini モデル名（
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      // 必要ならここに generationConfig: { temperature, maxOutputTokens, ... } を追加できます
    }); 
    // :contentReference[oaicite:2]{index=2}

    // response.text の中に生成された日本語レポートが入っている想定
    return response.text || "レポート生成に失敗しました。";
  } catch (error: any) {
    console.error("レポート生成中にエラーが発生しました:", error);
    return "レポート生成中に予期せぬエラーが発生しました。";
  }
};
