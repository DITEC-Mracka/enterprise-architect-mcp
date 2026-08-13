# Agent Eval Tasks

Structured analytical tasks for manual subagent dispatch. Each task simulates a real analyst question. Dispatch as a subagent with MCP tools (ea_*) available. Score against the rubric below.

---

## Task A1 — Attribute-level mapping from diagram

**Question:** "Diagram `0103 Spracovanie eFORM - žiadosť o výživné` maps eForm attributes to screen fields. Which eForm attribute fills `Vyživovaná osoba.02. Meno`?"

**Expected key facts:**
- [REQUIRED] The source attribute is `a7680.a897` ("Meno dieťaťa")
- [REQUIRED] The target is `Vyživovaná osoba.02. Meno`
- [BONUS] The mapping is visible via connector feature links (LFSP/LFEP)
- [BONUS] Agent used ea_resolve or ea_search to find the diagram, then ea_get_diagram_elements

**Scoring:** Required facts = 1 point each. Bonus = 0.5 each. Max: 3.

---

## Task A2 — Use case step with constraint

**Question:** "What does step 2 of use case UC_FEO_2027 say, and what business rules apply to this use case?"

**Expected key facts:**
- [REQUIRED] Step 2 text mentions displaying records based on calculated date
- [REQUIRED] The Process constraint `Pravidlo nastavenia auditovanej činnosti` with LOG_FEO_083 is returned
- [REQUIRED] Pre-condition `Spis je v stave uzatvorený` is returned
- [BONUS] Agent found the use case via ea_search or ea_resolve, then used ea_get_scenarios + ea_get_element

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 3.5.

---

## Task A5 — Discovery without a GUID

**Question:** "I need to see the diagram for element `a7680`. I only have the name — find it."

**Expected key facts:**
- [REQUIRED] Agent identifies which diagram(s) `a7680` appears on
- [REQUIRED] Agent retrieves the diagram contents (elements and connectors)
- [BONUS] Agent used ea_search → ea_get_element (which shows diagrams) → ea_get_diagram_elements
- [BONUS] The mapping connectors with feature links are visible

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 3.

---

## Task A6 — Search across encodings

**Question:** "Find all elements related to `právnická osoba` in the model."

**Expected key facts:**
- [REQUIRED] Search returns results despite entity-encoded notes
- [REQUIRED] Results include elements whose notes contain `Právnická` (decoded from `Pr&#225;vnick&#225;`)
- [BONUS] Case-insensitive: `PRÁVNICKÁ` and `právnická` produce the same results

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 2.5.

---

## Task A9 — Disambiguation

**Question:** "I need to find the element named `Osoba` — which one is it?"

**Expected key facts:**
- [REQUIRED] Agent reports that multiple elements with this name exist
- [REQUIRED] Each candidate is identified with a distinguishing package path
- [BONUS] Agent used ea_resolve and reported candidateCount > 1

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 2.5.

---

## Task A12 — Discover unknown column

**Question:** "Does t_connector have any column that stores style information? What columns does it have?"

**Expected key facts:**
- [REQUIRED] Agent uses ea_get_schema to list t_connector columns
- [REQUIRED] `StyleEx` column is identified
- [BONUS] Agent explains that StyleEx carries feature link data (LFSP/LFEP)

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 2.5.

---

## Task B1 — Cross-reference from step to constraint

**Question:** "Use case UC_FEO_2027 step 2 references a constraint. Find the constraint text and explain what it requires."

**Expected key facts:**
- [REQUIRED] Agent finds the step and its reference to a constraint by name
- [REQUIRED] Agent retrieves the constraint via ea_get_element on the use case
- [REQUIRED] Constraint notes text is returned decoded (not with raw &#NNN; entities)

**Scoring:** Required = 1pt each. Max: 3.

---

## Task B2 — Schema exploration for unknown data

**Question:** "I heard the model has glossary terms. Can you find them? What table holds them?"

**Expected key facts:**
- [REQUIRED] Agent uses ea_get_schema to explore tables
- [REQUIRED] Agent identifies t_glossary (if it exists) or reports that no glossary table exists
- [BONUS] Agent reports the row count and column names

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 2.5.

---

## Task B3 — Model provenance

**Question:** "Which model export file is the server reading? When was it last modified?"

**Expected key facts:**
- [REQUIRED] Agent uses ea_get_model_info
- [REQUIRED] Reports file name, size, and modification time
- [BONUS] Notes that the resolved path is local detail

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 2.5.

---

## Task B4 — End-to-end defect investigation

**Question:** "We have a defect on screen `SC_FEO_0204: Obnovenie finančného spisu` — something is wrong with record deletion behavior. Find the specification — which use cases, constraints, and business rules define this screen's behavior?"

**Expected key facts:**
- [REQUIRED] Agent finds screen SC_FEO_0204 and its connectors
- [REQUIRED] Agent discovers the linked use case UC_FEO_2027: Vyradenie spisu po lehote uloženia
- [REQUIRED] Agent retrieves connectors showing LOG_FEO_083 and related audit artifacts
- [BONUS] Agent retrieves scenarios (13 steps) and constraints (5, including Process rule for logging)
- [BONUS] Agent provides a coherent summary of the specification chain (screen → UC → constraints → logs)

**Scoring:** Required = 1pt each. Bonus = 0.5. Max: 4.
