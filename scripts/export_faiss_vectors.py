import json
from pathlib import Path

import faiss
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
NEXT_ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data" / "bal_faiss.index"
CHUNKS_PATH = ROOT / "data" / "bal_chunks.json"
CONFIG_PATH = ROOT / "data" / "vectorstore_config.json"
OUT_PATH = NEXT_ROOT / "src" / "data" / "vectorstore.json"


def main() -> None:
    index = faiss.read_index(str(INDEX_PATH))
    vectors = np.empty((index.ntotal, index.d), dtype="float32")
    index.reconstruct_n(0, index.ntotal, vectors)

    with CHUNKS_PATH.open("r", encoding="utf-8") as f:
        chunks = json.load(f)

    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        config = json.load(f)

    if len(chunks) != index.ntotal:
        raise RuntimeError(f"Chunk/vector count mismatch: chunks={len(chunks)} vectors={index.ntotal}")

    payload = {
        "embedding_model": config.get("embedding_model", "intfloat/multilingual-e5-small"),
        "embedding_dim": int(index.d),
        "chunks": [
            {
                **chunk,
                "embedding": [round(float(value), 7) for value in vectors[i]],
            }
            for i, chunk in enumerate(chunks)
        ],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {OUT_PATH} with {index.ntotal} vectors x {index.d} dims")


if __name__ == "__main__":
    main()
