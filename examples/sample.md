# Learnable Deck Example

This sample document explains a small concept so the fixed-loop pipeline can be tested without a PDF parser.

A learner-friendly deck should not simply copy the source order. It should first explain why the topic matters, then introduce the core idea, then show how to reason about the result.

The central design idea is to keep a DeckSpec JSON file as the canonical representation. The renderer can then produce Marp Markdown, PDF, or later an editable PowerPoint file from the same DeckSpec.

The Professor Critic asks questions that reveal missing prerequisites, unclear causal links, unsupported claims, dense slides, and confusing visual descriptions.

The Builder should answer those questions and revise the DeckSpec. Every round should preserve file-backed state so the process can be resumed and audited.

For long configured runs, the final round is not always the best round. The system should save snapshots and select the best candidate using simple quality scores.
