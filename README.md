# Report Ranking Agent
## BM25 → LLM Scorer for Workday Legacy Report Discovery

A two-stage report discovery agent that helps users find the most relevant
legacy reports from a catalog of ~10,000 Workday reports using natural
language queries.

---

## Architecture

```
                          ONLINE QUERY PATH
┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
│  User Query   │───>│ Query Preprocess  │───>│  BM25 Search   │
│  (natural     │    │ • Tokenize        │    │  • Full catalog │
│   language)   │    │ • Stem            │    │  • Field boosts │
└──────────────┘    │ • Expand synonyms │    │  • Top-N cands  │
                    └──────────────────┘    └───────┬────────┘
                                                    │
                                                    ▼
                    ┌──────────────────┐    ┌────────────────┐
                    │  Final Response   │<───│  LLM Scorer    │
                    │ • Ranked reports  │    │  • Score 0-100  │
                    │ • Relevance band  │    │  • Band H/M/L   │
                    │ • Explanation     │    │  • Explanation   │
                    └──────────────────┘    └────────────────┘

                        OFFLINE PREPARATION
┌──────────────────────────────────────────────────────────┐
│  Report Catalog  →  Composite Text  →  BM25 Index        │
│  (JSON from Workday RaaS API export)                      │
└──────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Report_Ranking_Agent/
├── README.md               ← You are here
├── requirements.txt        ← Python dependencies
├── .env.example            ← Environment variable template
├── config.py               ← Configuration and defaults
├── stemmer.py              ← Suffix-stripping stemmer
├── synonyms.py             ← HR/Workday synonym dictionary
├── bm25_engine.py          ← BM25 search engine (from scratch)
├── llm_scorer.py           ← LLM-based candidate re-ranker
├── report_catalog.py       ← Report metadata loader + quality checks
├── agent.py                ← Main orchestrator (the Agent)
├── app.py                  ← Streamlit web UI
├── cli.py                  ← Rich CLI interface
├── evaluation.py           ← Evaluation harness with test cases
├── data/
│   └── sample_reports.json ← Sample Workday report metadata
└── prompts/
    └── scoring_prompt.txt  ← LLM scoring prompt template
```

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 3. Run the Streamlit app
```bash
streamlit run app.py
```

### 4. Or use the CLI
```bash
python cli.py
```

### 5. Or use programmatically
```python
from agent import ReportDiscoveryAgent

agent = ReportDiscoveryAgent("data/sample_reports.json")
results = agent.search("I want a report that gives pre-hire details")
for r in results:
    print(f"[{r['band']}] {r['report_name']} — {r['score']}/100")
    print(f"  Why: {r['explanation']}")
```

---

## Running the Evaluation Harness
```bash
python evaluation.py
```
This runs 20 predefined test queries across 4 scenarios and prints
Hit@1, Hit@3, MRR metrics with a comparison table.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `MODEL_NAME` | `gpt-4o` | LLM model for scoring |
| `BM25_TOP_N` | `30` | Candidates passed from BM25 to LLM |
| `LLM_TOP_K` | `5` | Final results returned to user |
| `NAME_BOOST` | `3` | Weight multiplier for report name |
| `DESC_BOOST` | `2` | Weight multiplier for description |
| `DS_DESC_BOOST` | `1.5` | Weight for data source description |
| `FIELD_BOOST` | `1` | Weight for field names |

---

## Extending the Synonym Dictionary

Edit `synonyms.py` and add new groups to `SYNONYM_GROUPS`:

```python
SYNONYM_GROUPS.append(
    {"new_term", "existing_synonym_stem", "another_stem"}
)
```

All terms should be in their **stemmed** form (run `stemmer.stem("word")`
to check).

---

## Known Limitations

1. **Reports without metadata** (no description/fields) will rank poorly.
   Ensure the Workday RaaS export captures all available metadata.
2. **Synonym coverage** is finite. Expand the dictionary as you discover
   new user vocabulary patterns.
3. **BM25 cannot bridge pure paraphrase gaps** (e.g., "workforce expansion"
   vs "hires"). Synonyms mitigate this but don't eliminate it.
4. **LLM scoring adds latency** (~2-5 seconds) and cost (~$0.01-0.03/query).
5. **Numeric scores are relevance indicators**, not exact match percentages.

---

## Validated Performance (Sample Dataset)

| Stage | Hit@1 | Hit@3 | MRR |
|---|---|---|---|
| Baseline (names only) | 50% | 75% | 0.668 |
| +Stemming +Synonyms | 80% | 95% | 0.873 |
| +Full Metadata | 75% | 90% | 0.848 |
| +LLM Re-ranking | 80% | 90% | 0.864 |

> Missing metadata is the #1 factor limiting accuracy.

---

## License

Internal use only. Not for redistribution.
