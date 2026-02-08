import json
import re
from fastapi import HTTPException
import httpx
import os
from dotenv import load_dotenv
from src.schema.patient_schema import AnalysisResult, MedicalRecords
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

class DeepSeekClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "deepseek/deepseek-r1-0528:free" 

        if not self.api_key:
            raise ValueError("API key is required for DeepSeekClient")

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def analyze_medical_record(self, medical_record: MedicalRecords):
        """
        Analyze the medical record using DeepSeek's AI model.
        :param medical_record: The medical record data to analyze.
        :return: Analysis result from DeepSeek.
        """
        prompt = self._create_analysis_prompt(medical_record)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": f"{self._get_system_prompt()}"
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.1,
                        "max_tokens": 3000,  # Increased token limit
                    },
                    timeout=60.0  # Increased timeout
                )
                response.raise_for_status()
                result = response.json()

                # Enhanced Debugging 
                raw_content = result["choices"][0]["message"]["content"]
                logger.info(f"Raw AI response length: {len(raw_content)}")
                logger.info(f"Raw AI response preview: {raw_content[:200]}...")
                
                # Parse the AI response
                parsed_response = self._parse_ai_response(raw_content)
                logger.info(f"Successfully parsed AI response")
                
                return parsed_response
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except httpx.RequestError as e:
            logger.error(f"Request error occurred: {e}")
            raise HTTPException(status_code=500, detail="Error connecting to DeepSeek API")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise HTTPException(status_code=500, detail=f"Invalid JSON response from AI: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    def _parse_ai_response(self, raw_content: str) -> dict:
        """
        Parse the AI response string into a structured dictionary.
        The DeepSeek R1 model often returns reasoning + final answer, so we need to extract the JSON.
        """
        if not raw_content or raw_content.strip() == "":
            logger.error("Received empty AI response")
            raise ValueError("Empty AI response")

        try:
            # First, try to parse as direct JSON
            return json.loads(raw_content)
        except json.JSONDecodeError:
            logger.info("Direct JSON parsing failed, trying to extract JSON from response")
            
            # Try different extraction methods
            extracted_json = None
            
            # Method 1: Look for JSON block in markdown
            json_match = re.search(r'```json\s*(.*?)\s*```', raw_content, re.DOTALL | re.IGNORECASE)
            if json_match:
                try:
                    extracted_json = json.loads(json_match.group(1).strip())
                    logger.info("Successfully extracted JSON from markdown block")
                except json.JSONDecodeError:
                    pass
            
            # Method 2: Look for JSON object in the text (between curly braces)
            if not extracted_json:
                json_matches = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_content, re.DOTALL)
                for match in json_matches:
                    try:
                        extracted_json = json.loads(match)
                        logger.info("Successfully extracted JSON object from text")
                        break
                    except json.JSONDecodeError:
                        continue
            
            # Method 3: Try to construct JSON from the structured text
            if not extracted_json:
                extracted_json = self._extract_structured_data(raw_content)
                if extracted_json:
                    logger.info("Successfully constructed JSON from structured text")
            
            # If all methods fail, return fallback
            if not extracted_json:
                logger.warning("Could not extract JSON, creating fallback response")
                return self._create_fallback_response(raw_content)
            
            return extracted_json

    def _extract_structured_data(self, content: str) -> dict:
        """
        Extract structured data from the AI response text and construct a JSON object.
        This handles cases where the AI provides structured information but not in JSON format.
        """
        try:
            # Initialize the response structure
            response = {
                "suspected_conditions": [],
                "recommended_medications": [],
                "additional_tests": [],
                "risk_factors": [],
                "treatment_notes": "",
                "confidence_level": "medium"
            }
            
            # Extract suspected conditions
            conditions_match = re.search(r'Suspected Conditions[:\s]*(.+?)(?=Recommended|Additional|Risk|Treatment|$)', content, re.DOTALL | re.IGNORECASE)
            if conditions_match:
                conditions_text = conditions_match.group(1)
                # Extract numbered or bulleted items
                conditions = re.findall(r'(?:\d+\.\s*\*?\*?|[-•]\s*\*?\*?)([^\n\r]+)', conditions_text)
                response["suspected_conditions"] = [cond.strip('*').strip() for cond in conditions if cond.strip()]
            
            # Extract medications from reasoning or structured text
            # Look for medication names in the reasoning
            medication_pattern = r'medication_name[:\s]*[\'"]([^\'"]+)[\'"]'
            med_names = re.findall(medication_pattern, content, re.IGNORECASE)
            
            dosage_pattern = r'dosage[:\s]*[\'"]([^\'"]+)[\'"]'
            dosages = re.findall(dosage_pattern, content, re.IGNORECASE)
            
            frequency_pattern = r'frequency[:\s]*[\'"]([^\'"]+)[\'"]'
            frequencies = re.findall(frequency_pattern, content, re.IGNORECASE)
            
            # Construct medication objects
            for i, med_name in enumerate(med_names):
                medication = {
                    "medication_name": med_name,
                    "dosage": dosages[i] if i < len(dosages) else "As prescribed",
                    "frequency": frequencies[i] if i < len(frequencies) else "As directed",
                    "duration": "As prescribed",
                    "instructions": "Follow healthcare provider instructions",
                    "contraindications": [],
                    "side_effects": [],
                    "confidence_score": 0.7
                }
                response["recommended_medications"].append(medication)
            
            # If no medications found in structured format, extract from text
            if not response["recommended_medications"]:
                # Look for common medication names mentioned in the text
                common_meds = ["nitroglycerin", "labetalol", "metoprolol", "lisinopril", "amlodipine", "atenolol"]
                found_meds = []
                for med in common_meds:
                    if med.lower() in content.lower():
                        found_meds.append(med.title())
                
                for med in found_meds:
                    medication = {
                        "medication_name": med,
                        "dosage": "As prescribed by healthcare provider",
                        "frequency": "As directed",
                        "duration": "As prescribed",
                        "instructions": "Consult healthcare professional for proper dosing",
                        "contraindications": ["Consult healthcare provider"],
                        "side_effects": ["Monitor for adverse effects"],
                        "confidence_score": 0.6
                    }
                    response["recommended_medications"].append(medication)
            
            # Extract additional tests
            tests_keywords = ["ECG", "blood test", "cardiac enzymes", "troponin", "CT scan", "MRI", "chest X-ray"]
            for test in tests_keywords:
                if test.lower() in content.lower():
                    response["additional_tests"].append(test)
            
            # Extract risk factors
            risk_keywords = ["hypertension", "diabetes", "age", "gender", "smoking", "obesity"]
            for risk in risk_keywords:
                if risk.lower() in content.lower():
                    response["risk_factors"].append(risk.title())
            
            # Extract treatment notes (use first paragraph or summary)
            notes_match = re.search(r'(?:Treatment|Notes?|Summary)[:\s]*(.+?)(?:\n\n|\n[A-Z]|$)', content, re.DOTALL | re.IGNORECASE)
            if notes_match:
                response["treatment_notes"] = notes_match.group(1).strip()[:500]  # Limit length
            else:
                response["treatment_notes"] = "Comprehensive medical evaluation recommended. Follow healthcare provider guidance."
            
            # Determine confidence level based on content
            if "high" in content.lower() and "confidence" in content.lower():
                response["confidence_level"] = "high"
            elif "low" in content.lower() and "confidence" in content.lower():
                response["confidence_level"] = "low"
            
            # Only return if we found meaningful data
            if response["suspected_conditions"] or response["recommended_medications"]:
                return response
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting structured data: {e}")
            return None

    def _create_fallback_response(self, raw_content: str) -> dict:
        """
        Create a fallback response structure in case of parsing errors.
        """
        # Try to extract at least some basic information
        conditions = ["Medical evaluation required"]
        
        # Look for any obvious medical conditions mentioned
        if "hypertension" in raw_content.lower():
            conditions.append("Hypertension")
        if "emergency" in raw_content.lower():
            conditions.append("Medical emergency - immediate attention required")
        
        return {
            "suspected_conditions": conditions,
            "recommended_medications": [{
                "medication_name": "Immediate Medical Consultation Required",
                "dosage": "N/A",
                "frequency": "Immediate",
                "duration": "Until properly evaluated",
                "instructions": "Seek immediate medical attention. This system encountered an error parsing the AI response, so professional medical evaluation is essential.",
                "contraindications": [],
                "side_effects": [],
                "confidence_score": 0.0
            }],
            "additional_tests": ["Complete medical evaluation", "Professional medical assessment"],
            "risk_factors": ["Unable to assess from current data"],
            "treatment_notes": f"AI response parsing failed but medical attention is advised. Response preview: {raw_content[:200]}...",
            "confidence_level": "low"
        }

    def _get_system_prompt(self) -> str:
        return """You are a medical AI assistant. You MUST respond with ONLY a valid JSON object in the exact format specified below. Do not include any markdown formatting, explanations, or additional text.

CRITICAL: Your response must be ONLY valid JSON that can be parsed directly. No markdown, no explanations, no reasoning - just the JSON object.

Required JSON format:
{
    "suspected_conditions": ["condition1", "condition2"],
    "recommended_medications": [
        {
            "medication_name": "medication name",
            "dosage": "dosage amount",
            "frequency": "frequency",
            "duration": "duration",
            "instructions": "instructions",
            "contraindications": ["contraindication1", "contraindication2"],
            "side_effects": ["side_effect1", "side_effect2"],
            "confidence_score": 0.85
        }
    ],
    "additional_tests": ["test1", "test2"],
    "risk_factors": ["risk1", "risk2"],
    "treatment_notes": "detailed treatment notes",
    "confidence_level": "high"
}

IMPORTANT DISCLAIMERS TO INCLUDE IN TREATMENT NOTES:
- This is for educational/research purposes only
- Not for actual medical diagnosis or treatment
- Always recommend consulting healthcare professionals
- Base recommendations on medical guidelines

Respond with ONLY the JSON object, nothing else."""

    def _create_analysis_prompt(self, record: MedicalRecords) -> str:
        return f"""Analyze this patient medical record and respond with ONLY valid JSON:

Patient: {record.patient_info.age}yr {record.patient_info.gender}
Weight: {record.patient_info.weight}kg
Medical History: {', '.join(record.patient_info.medical_history) if record.patient_info.medical_history else 'None'}
Allergies: {', '.join(record.patient_info.allergies) if record.patient_info.allergies else 'None'}
Current Medications: {', '.join(record.patient_info.current_medications) if record.patient_info.current_medications else 'None'}

Symptoms:
Primary: {', '.join(record.symptoms.primary_symptoms)}
Secondary: {', '.join(record.symptoms.secondary_symptoms or [])}
Duration: {record.symptoms.symptom_duration or 'Not specified'}
Severity: {record.symptoms.severity or 'Not specified'}

Vital Signs:
{f"BP: {record.vital_signs.blood_pressure}" if record.vital_signs and record.vital_signs.blood_pressure else "BP: Not recorded"}
{f"HR: {record.vital_signs.heart_rate} bpm" if record.vital_signs and record.vital_signs.heart_rate else "HR: Not recorded"}
{f"Temp: {record.vital_signs.temperature}°C" if record.vital_signs and record.vital_signs.temperature else "Temp: Not recorded"}

Lab Results: {record.lab_results if record.lab_results else 'None'}

Respond with ONLY the JSON object - no other text, explanations, or formatting."""


api_key = os.getenv("DEEPSEEK_API_KEY")
deepseek_client = DeepSeekClient(api_key=api_key)