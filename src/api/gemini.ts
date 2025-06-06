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
  // もとのプロンプト部分をそのまま活用
  const prompt = `あなたは道路インフラの点検・維持管理を専門とするAIアナリストです。
以下の道路情報に基づいて、**点検・補修の意思決定をサポートする**ための、簡潔かつ分かりやすい日本語のレポートを生成してください。

---
## 道路情報

${JSON.stringify(roadInfo, null, 2)}

---

## レポートの構成と指示事項

以下の項目を必ず含め、専門性と平易さを両立した記述を心がけてください。

1.  **概要と総合評価:**
    * この道路区間の現在の状態と、総合的なリスクレベル（高・中・低など）を簡潔にまとめてください。
    * **総合損傷スコア**（数値と意味合い）に言及し、その数値が何を意味するのかを説明してください。
2.  **主要な損傷と特徴:**
    * 画像認識AIが検出した主要な損傷の種類（例：ひび割れ、ポットホール）とその信頼度を具体的に記述してください。
    * 損傷の程度や広がりについて言及してください。
3.  **非画像データからの考察:**
    * 舗装種別、舗装年数、交通量、排水性、そして周辺の水道管/ガス管の補修履歴といった非画像データが、この区間の損傷リスクにどのように影響しているかを考察してください。
    * 特にリスクを高める要因があれば強調してください。
4.  **推奨されるアクション:**
    * 現在の状況に基づき、緊急性や重要度を考慮した具体的な点検・補修アクション（例：詳細調査の実施、応急処置、計画的な補修リストへの追加など）を提案してください。
    * **「感覚」から「科学」への転換**を意識した、データに基づいた提案であることを示唆してください。
5.  **特記事項（任意）:**
    * その他、この区間に関して特筆すべき点や、将来的な監視の必要性などがあれば追記してください。

**出力形式:**
* 専門用語は避け、関係者が理解しやすいように平易な言葉遣いを心がけてください。
* 必要に応じて箇条書きを活用し、視覚的に分かりやすいレポートにしてください。
* レポートの長さはA4用紙1枚程度に収まることを目安としてください。
`;


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
