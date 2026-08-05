# AI Agent Execution Protocol (AGENTS.md)

This file dictates the strict operational boundaries, version control procedures, and git commit cycles for all AI Agents, Code Assistants, and LLM Engines operating on this codebase.

---

## 1. Core Mandate: Atomic Commits

* **Never lump changes together:** Every distinct feature, refactor, optimization, or bug fix must be isolated into its own granular, atomic git commit.
* **Commit Message Format:** Follow the Conventional Commits specification (e.g., `feat(protocol): add v26_1 handshake packet parsing`, `perf(simd): optimize chunk compression pipeline`).

---

## 2. Version Control & Synchronization Rules

Before executing Git operations, the agent must check if a valid GitHub repository exists (verify `.git` directory and remote origin). If a remote GitHub repository exists, the agent must **automatically commit and push to the `main` branch without prompting the user**.

### Branch A: Explicit "Push" Request
* **Trigger:** The user explicitly asks to "push changes", "sync repo", or similar variations in the prompt.
* **Action:** 
  1. Check for the existence of a remote GitHub repository.
  2. Stage all modified files and commit them using the Conventional Commit format.
  3. Automatically execute `git push origin main` immediately.

### Branch B: Auto-Commit & Push After Every Change
* **Trigger:** The user instructs the agent to make changes and "commit & push" after each one, or any variation requesting automatic version control after each change.
* **Action:**
  1. Check for the existence of a remote GitHub repository.
  2. Perform the requested task and create a local commit using the Conventional Commit format.
  3. Automatically execute `git push origin main` after each commit without asking or waiting for user confirmation.
  4. Track via `git cherry -v` or `git log --oneline` to confirm each push to `main` succeeds.

*Note: If no GitHub repository is detected, skip remote push operations entirely and log the status internally.*

---

## 3. Pre-Commit Verification

Before running `git commit`, the agent must verify:
1. `npm build` passes with zero errors on the nightly toolchain.
2. The codebase remains `no_std` and `no_alloc` compliant where applicable.

Failure to follow these synchronization directives will result in operational execution failure.