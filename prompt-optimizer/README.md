# Prompt Evaluator

Simple evaluation system for testing prompt performance.

## Overview

**No automatic optimization** - just labeling and evaluation.

1. **Label** - Mark cached results as correct/incorrect
2. **Evaluate** - Test current prompts and see metrics
3. **Manually tweak** - Edit `prompts.json` based on results
4. **Repeat** - Re-evaluate until performance is good

## Usage

### Step 1: Label Test Cases

```bash
npm run label
```

Interactive CLI that samples random results from cache:
- Choose filter or analyzer
- Review 20 random results
- Mark each as correct/incorrect
- Saves to `test_cases.json`

### Step 2: Evaluate Prompts

```bash
# Evaluate filter prompt
npm run eval-filter

# Evaluate analyzer prompt
npm run eval-analyzer

# Evaluate both
npm run eval-both
```

Shows:
- Overall accuracy
- Precision, Recall, F1 (for filter)
- Per-field accuracy (for analyzer)
- Confusion matrix
- List of errors

### Step 3: Improve Prompts

Based on errors, manually edit `prompts.json`:
- Make prompt more specific
- Add examples
- Adjust instructions

### Step 4: Re-evaluate

```bash
npm run eval-filter
```

Repeat until metrics are acceptable.

## Files

```
prompt-optimizer/
├── labeler.js         - Create labeled test cases
├── evaluator.js       - Run evaluation on test cases
├── test_cases.json    - Labeled data (gitignored)
└── README.md          - This file
```

## Test Case Format

### Filter Test Cases

```json
{
  "id": "filter_1",
  "headline": "New cycle lane divides opinion",
  "snippet": "",
  "topic": "liveable neighbourhoods",
  "expected": true,
  "ai_result": true,
  "is_correct": true,
  "reason": "About cycle infrastructure",
  "created_at": "2025-10-18T17:00:00Z"
}
```

### Analyzer Test Cases

```json
{
  "id": "analyzer_1",
  "url": "https://...",
  "title": "Residents protest LTN scheme",
  "text": "Full article text...",
  "expected": {
    "sentiment": "negative",
    "sentiment_score": "3",
    "main_angle": "opposition_controversy",
    "balance": "one_sided_critical"
  },
  "ai_result": { ... },
  "is_correct": false,
  "reason": "Should be negative not neutral",
  "created_at": "2025-10-18T17:00:00Z"
}
```

## Metrics Explained

### Filter (Binary Classification)

- **Accuracy**: Overall % correct
- **Precision**: Of articles marked relevant, % actually relevant
- **Recall**: Of actually relevant articles, % caught by filter
- **F1 Score**: Harmonic mean of precision and recall

### Analyzer (Multi-field Classification)

- **Overall Accuracy**: % with all key fields correct
- **Field Accuracy**: % correct per field (sentiment, main_angle, balance)

## Example Session

```bash
# 1. Label 20 test cases
npm run label
# Choose option 1 (filter)
# Mark y/n for each result

# 2. Evaluate current prompt
npm run eval-filter

# Output:
# 📊 FILTER EVALUATION RESULTS
# 📈 Overall Metrics:
#   Total cases:    20
#   Correct:        15 (75.0%)
#   Incorrect:      5 (25.0%)
# 
# 🎯 Classification Metrics:
#   Precision:      80.0%
#   Recall:         85.0%
#   F1 Score:       82.4%
#
# ❌ Errors (5 total):
# [1] Bristol restaurant wins award
#   Expected: false
#   Actual:   true
#   Reason:   Not about transport

# 3. Edit prompts.json
# Make prompt more specific based on errors

# 4. Re-evaluate
npm run eval-filter
# Check if accuracy improved

# 5. Repeat until satisfied
```

## Tips

**Creating good test cases:**
- Include edge cases (borderline relevance)
- Mix of obvious and ambiguous examples
- Representative of real data
- Aim for 20-30 test cases minimum

**Improving prompts:**
- Look at error patterns
- Add specific instructions for edge cases
- Give examples in the prompt
- Be more precise in definitions

**When to stop:**
- Filter F1 > 85%
- Analyzer accuracy > 80%
- Manual review of errors shows they're acceptable

## Workflow

```
Label data → Evaluate → See errors → Edit prompts.json → Re-evaluate
    ↑                                                          ↓
    └──────────────────────────────────────────────────────────┘
```

This is a manual iterative process - no automation, full control.
