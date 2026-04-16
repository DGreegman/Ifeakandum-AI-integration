"""
patient_service.py
------------------
OpenAI client wired to an agentic two-step pipeline:

  Agent 1 – Diagnosis   : identifies conditions, risk factors, confidence
  Agent 2 – Treatment   : given Agent 1's output, recommends medications & tests

Both agents use Jinja2 prompt templates from src/services/prompt_templates/.
The returned dict always matches the AnalysisResult schema expected by main.py.
"""

import json
import re
from typing import Any, Dict
from fastapi import HTTPException
import httpx
import os
from src.schema.patient_schema import MedicalRecords
from src.services.template_engine import render_template
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# NOTE: load_dotenv() is called once at the entry point (main.py). Do not call it here.


class OpenAIClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1"
        self.model = "gpt-4o-mini"  # Upgrade to "gpt-4o" for production

        if not self.api_key:
            raise ValueError("API key is required for OpenAIClient")

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze_medical_record(self, medical_record: MedicalRecords) -> dict:
        """
        Two-agent pipeline for a Pydantic MedicalRecords object.
        Agent 1 diagnoses; Agent 2 treats based on Agent 1's output.
        """
        p = medical_record.patient_info
        s = medical_record.symptoms
        v = medical_record.vital_signs

        shared_ctx = dict(
            age=p.age,
            gender=p.gender,
            weight=p.weight,
            height=p.height,
            medical_history=p.medical_history or [],
            allergies=p.allergies or [],
            current_medications=p.current_medications or [],
            primary_symptoms=s.primary_symptoms,
            secondary_symptoms=s.secondary_symptoms or [],
            duration=s.symptom_duration,
            severity=s.severity,
            temperature=v.temperature if v else None,
            blood_pressure=v.blood_pressure if v else None,
            heart_rate=v.heart_rate if v else None,
            respiratory_rate=v.respiratory_rate if v else None,
            oxygen_saturation=v.oxygen_saturation if v else None,
            lab_results=medical_record.lab_results or {},
            additional_notes=medical_record.additional_notes,
        )

        return await self._run_pipeline(
            diagnosis_template="diagnosis.j2",
            treatment_template="treatment.j2",
            ctx=shared_ctx,
        )

    async def analyze_medical_record_from_dict(self, record_data: Dict[str, Any]) -> dict:
        """
        Two-agent pipeline for a plain dict (used by Celery batch tasks).
        """
        v = record_data.get("vital_signs", {})

        shared_ctx = dict(
            age=record_data.get("age", "Unknown"),
            gender=record_data.get("gender", "Unknown"),
            weight=record_data.get("weight", "Unknown"),
            height=record_data.get("height", "Unknown"),
            medical_history=record_data.get("medical_history") or [],
            allergies=record_data.get("allergies") or [],
            current_medications=record_data.get("current_medications") or [],
            primary_symptoms=record_data.get("primary_symptoms") or [],
            secondary_symptoms=record_data.get("secondary_symptoms") or [],
            duration=record_data.get("symptom_duration"),
            severity=record_data.get("severity"),
            temperature=v.get("temperature"),
            blood_pressure=v.get("blood_pressure"),
            heart_rate=v.get("heart_rate"),
            respiratory_rate=v.get("respiratory_rate"),
            oxygen_saturation=v.get("oxygen_saturation"),
            lab_results=record_data.get("lab_results") or {},
            additional_notes=record_data.get("additional_notes"),
        )

        return await self._run_pipeline(
            diagnosis_template="dict_diagnosis.j2",
            treatment_template="dict_treatment.j2",
            ctx=shared_ctx,
        )

    # ------------------------------------------------------------------
    # Pipeline Orchestration
    # ------------------------------------------------------------------

    async def _run_pipeline(
        self,
        diagnosis_template: str,
        treatment_template: str,
        ctx: dict,
    ) -> dict:
        """
        Runs the two-agent pipeline and merges results into the
        AnalysisResult-compatible shape.
        """
        # Severity-based model escalation: Critical cases use gpt-4o for higher accuracy
        severity = (ctx.get("severity") or "").lower()
        model = "gpt-4o" if severity == "critical" else self.model
        if model == "gpt-4o":
            logger.info("[Pipeline] Critical severity detected — escalating to gpt-4o")

        system_prompt = render_template("base_system.j2")

        # ── Agent 1: Diagnosis ──────────────────────────────────────────
        logger.info("[Agent 1 - Diagnosis] Building prompt from template")
        diagnosis_prompt = render_template(diagnosis_template, **ctx)
        agent1 = await self._call_openai(system_prompt, diagnosis_prompt, agent="Agent 1 - Diagnosis", model=model)

        # Validate Agent 1 has the fields we need
        suspected_conditions = agent1.get("suspected_conditions", [])
        risk_factors = agent1.get("risk_factors", [])
        confidence_level = agent1.get("confidence_level", "medium")
        clinical_reasoning = agent1.get("clinical_reasoning", "")

        logger.info(f"[Agent 1] Found {len(suspected_conditions)} condition(s): {suspected_conditions}")

        # ── Agent 2: Treatment ──────────────────────────────────────────
        logger.info("[Agent 2 - Treatment] Building prompt from template")
        treatment_prompt = render_template(
            treatment_template,
            **ctx,
            suspected_conditions=suspected_conditions,
            risk_factors=risk_factors,
            confidence_level=confidence_level,
            clinical_reasoning=clinical_reasoning,
        )
        agent2 = await self._call_openai(system_prompt, treatment_prompt, agent="Agent 2 - Treatment", model=model)

        # ── Merge into AnalysisResult shape ────────────────────────────
        return {
            "suspected_conditions": suspected_conditions,
            "risk_factors": risk_factors,
            "confidence_level": confidence_level,
            "recommended_medications": agent2.get("recommended_medications", []),
            "additional_tests": agent2.get("additional_tests", []),
            "treatment_notes": agent2.get("treatment_notes", ""),
        }

    # ------------------------------------------------------------------
    # Low-level OpenAI Call
    # ------------------------------------------------------------------

    async def _call_openai(self, system_prompt: str, user_prompt: str, agent: str = "Agent", model: str = None) -> dict:
        """Send a single chat completion request and return parsed JSON."""
        model_to_use = model or self.model
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json={
                        "model": model_to_use,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user",   "content": user_prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 4096,
                        "response_format": {"type": "json_object"},  # Structured output
                    },
                    timeout=60.0,
                )
                response.raise_for_status()
                result = response.json()

                raw_content = result["choices"][0]["message"]["content"]
                logger.info(f"[{agent}] Raw AI response length: {len(raw_content)}")
                logger.info(f"[{agent}] Response preview: {raw_content[:200]}...")

                parsed = self._parse_ai_response(raw_content)
                logger.info(f"[{agent}] Successfully parsed response")
                return parsed

        except httpx.HTTPStatusError as e:
            logger.error(f"[{agent}] HTTP error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except httpx.RequestError as e:
            logger.error(f"[{agent}] Request error: {e}")
            raise HTTPException(status_code=500, detail="Error connecting to OpenAI API")
        except json.JSONDecodeError as e:
            logger.error(f"[{agent}] JSON decode error: {e}")
            raise HTTPException(status_code=500, detail=f"Invalid JSON from AI: {str(e)}")
        except Exception as e:
            logger.error(f"[{agent}] Unexpected error: {e}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    # ------------------------------------------------------------------
    # Response Parsing
    # ------------------------------------------------------------------

    def _parse_ai_response(self, raw_content: str) -> dict:
        """Parse AI response string into a dict. Handles markdown-wrapped JSON."""
        if not raw_content or raw_content.strip() == "":
            raise ValueError("Empty AI response")

        # Direct JSON (gpt-4o-mini with response_format=json_object always does this)
        try:
            return json.loads(raw_content)
        except json.JSONDecodeError:
            pass

        # Fallback: strip markdown code fences
        json_match = re.search(r'```json\s*(.*?)\s*```', raw_content, re.DOTALL | re.IGNORECASE)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Fallback: find first {...} block
        json_matches = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_content, re.DOTALL)
        for match in json_matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue

        logger.warning("Could not parse AI response as JSON — returning fallback")
        return self._create_fallback_response(raw_content)

    def _create_fallback_response(self, raw_content: str) -> dict:
        """Last-resort fallback when all parsing attempts fail."""
        return {
            "suspected_conditions": ["Medical evaluation required"],
            "risk_factors": ["Unable to assess from current data"],
            "confidence_level": "low",
            "clinical_reasoning": "AI response could not be parsed.",
            "recommended_medications": [{
                "medication_name": "Immediate Medical Consultation Required",
                "dosage": "N/A",
                "frequency": "Immediate",
                "duration": "Until properly evaluated",
                "instructions": "Seek immediate medical attention.",
                "contraindications": [],
                "side_effects": [],
                "confidence_score": 0.0,
            }],
            "additional_tests": ["Complete medical evaluation"],
            "treatment_notes": (
                f"AI response parsing failed. Professional evaluation is essential. "
                f"Response preview: {raw_content[:200]}..."
            ),
        }


api_key = os.getenv("OPENAI_API_KEY")
openai_client = OpenAIClient(api_key=api_key)