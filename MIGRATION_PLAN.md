# Switching Our AI Provider — Plain English Summary

**Project:** Ifeakandum AI Integration  
**Date:** 15 March 2026  

---

## What Are We Doing?

Right now, our system uses a service called **OpenRouter** to power the AI that analyses medical records. Think of OpenRouter as a middleman — we talk to them, and they pass our questions on to an AI called DeepSeek, then send the answer back to us.

We are switching from using that middleman to going **directly to OpenAI** (the company behind ChatGPT). This means our system will talk to OpenAI directly instead, with no middleman in between.

---

## Why Are We Switching?

| Reason | Detail |
|---|---|
| **Reliability** | Talking directly to OpenAI removes an extra link in the chain that can fail or slow things down |
| **Better AI quality** | OpenAI's models (like GPT-4o) are well-proven, widely trusted, and give very accurate, structured answers |
| **Easier to manage** | One account, one invoice, one place to check usage — no middlemen |
| **Industry standard** | OpenAI is the most widely used AI provider; long-term support and updates are guaranteed |

---

## What Exactly Will Change?

Only **one small part** of the system changes — the piece responsible for sending questions to the AI and receiving answers. Everything the users see and experience stays exactly the same.

Here is a simple way to think about it:

> Imagine you used to order food through a delivery app (OpenRouter), which picked it up from a restaurant (DeepSeek). Now, you're going to order directly from a different restaurant (OpenAI) that delivers themselves. Your plate of food looks the same. Only the kitchen changed.

### Changes checklist

- [ ] **Swap the AI address** — update where the system sends its questions (from OpenRouter to OpenAI)
- [ ] **Swap the AI model** — switch from DeepSeek to GPT-4o Mini
- [ ] **Swap the access key** — replace the old password/key for OpenRouter with a new one from OpenAI
- [ ] **Update 3 code files** — small text changes in the background code to point at the new provider
- [ ] **Test everything** — run checks to make sure medical record analysis still works correctly

---

## What Does NOT Change?

- ✅ How doctors and users interact with the system (no changes to the app/website)
- ✅ Patient data and medical records (nothing is deleted or moved)
- ✅ How results are stored and displayed
- ✅ The batch processing feature (uploading files with many records at once)
- ✅ Everything else running in the background

---

## What Will It Cost?

This is an important consideration for the project owner.

**Currently**, we use a **free** AI model through OpenRouter. This is why it costs nothing but can sometimes be slower or less reliable.

**After the switch**, OpenAI charges based on usage — meaning, how many medical records are analysed.

| Model Option | Quality | Estimated Cost | Status |
|---|---|---|---|
| **GPT-4o Mini** | Very Good | ~$0.001 per analysis (approx.) | ✅ **Starting with this** |
| **GPT-4o** | Excellent | ~$0.01 per analysis (approx.) | 🔜 Future upgrade |

> **Decision made:** We will start with `GPT-4o Mini` to keep costs low while the system is established. When the project is ready to scale or needs higher accuracy, upgrading to `GPT-4o` is a simple one-line change.

Both require an **OpenAI account with billing enabled** at [platform.openai.com](https://platform.openai.com).

---

## What Do We Need From the Project Owner?

Before we can proceed, we need answers to these remaining questions:

1. ~~**Which AI model should we use?**~~ ✅ **Decided — GPT-4o Mini** (with GPT-4o as a future upgrade)

2. **Is there already an OpenAI account/key available?** If yes, please share it securely. If no, a new account needs to be created at [platform.openai.com](https://platform.openai.com).

3. **Are there other places the system is running** (e.g. a live server, a staging environment) that will also need the key updated?

---

## How Long Will This Take?

Once the project owner answers the questions above, the actual changes are **very quick** — estimated **1 to 2 hours** of work, followed by testing to confirm everything runs correctly.

---

## Is There Any Risk?

Very low. The switch is easy to reverse if anything goes wrong — we simply restore the old settings. We will also take a backup snapshot of the code before starting.
