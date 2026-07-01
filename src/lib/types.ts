export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RetrievedChunk = {
  id: number;
  text: string;
  breadcrumb?: string;
  section_title?: string;
  relevance_score: number;
};

export type Identity = {
  subjectType: "user" | "fingerprint_fallback";
  subjectId: string;
  role: "visitor" | "user" | "admin";
  public: {
    id: number;
    email: string | null;
    role: string;
    mode: string;
  };
};
