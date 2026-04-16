# Ifeakandum AI Medical Records Analysis System

A FastAPI-based medical records analysis system with a React frontend. It uses the OpenAI API to analyze patient medical records and generate medication recommendations and diagnostic insights.

## Overview

This system provides AI-powered medical record analysis for educational and research purposes. It processes patient data including demographics, symptoms, vital signs, and medical history to generate:

- Potential medical condition diagnoses
- Medication recommendations with contraindications
- Recommended diagnostic tests
- Risk factor assessments
- Professional doctor reports

**DISCLAIMER**: This system is designed for educational and research purposes only. It is NOT intended for actual medical diagnosis or treatment decisions. Always consult qualified healthcare professionals for medical advice.

## Key Features

- **Single Record Analysis** - Analyze individual patient records with detailed AI-powered insights
- **Batch CSV Processing** - Process multiple medical records from CSV files with statistical summaries
- **Doctor Report Generation** - Create professional medical reports for healthcare providers
- **WHO Data Upload** - Support for WHO health data formats (CSV/Excel)
- **Comprehensive Logging** - Request tracking and analysis logging with rotation
- **Async Processing** - Non-blocking operations for efficient batch processing
- **RESTful API** - Clean, well-documented API endpoints

## Technology Stack

- **Framework**: FastAPI 0.116.0
- **Server**: Uvicorn 0.35.0
- **Frontend**: React 19 + Vite 7
- **AI Model**: OpenAI GPT models
- **Data Processing**: Pandas 2.3.1, NumPy 2.3.1
- **HTTP Client**: httpx 0.28.1
- **Configuration**: python-dotenv 1.1.1
- **Queueing (optional)**: Celery + Redis

## Quick Start

### Prerequisites

- Python 3.8+
- OpenAI API key
- Node.js 18+ and npm if you want to run the frontend

### What a Windows User Needs

For the default local setup on Windows, a user only needs:

- Python 3.8+
- An OpenAI API key
- Node.js and npm for the frontend

Redis is not required for the default local setup.

The current batch CSV flow runs through FastAPI background tasks, so Windows users can run the app without separately starting Celery or Redis. Celery and Redis are available in the codebase as an optional advanced setup for queue-based background workers.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Ifeakandum-AI-integration

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Windows Installation

```powershell
git clone <repository-url>
cd Ifeakandum-AI-integration
py -m pip install -r requirements.txt
copy .env.example .env
```

Then open `.env` and set:

```env
OPENAI_API_KEY=your_api_key_here
```

### Running the Application

```bash
# Start the server
python src/main.py

# Or use uvicorn directly
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Running on Windows

```powershell
py -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will typically be available at `http://localhost:5173`

### Optional: Redis and Celery

You only need this if you want queue-based background workers.

```bash
# Start Redis first, then run a Celery worker
celery -A src.celery_backend.celery_app worker --loglevel=info
```

By default, the application can still process CSV batch uploads without Celery because the current batch endpoint uses FastAPI background tasks.

## Documentation

- [Installation Guide](docs/INSTALLATION.md) - Detailed setup instructions
- [API Documentation](docs/API.md) - Complete API endpoint reference
- [Architecture](docs/ARCHITECTURE.md) - System design and architecture
- [Usage Guide](docs/USAGE.md) - Examples and usage patterns

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check endpoint |
| POST | `/api/v1/analyze-record` | Analyze single patient medical record |
| GET | `/api/v1/analysis-result/{patient_id}` | Retrieve stored analysis result |
| POST | `/api/v1/doctor-report` | Generate professional doctor report |
| POST | `/api/v1/upload-who-data` | Upload WHO health data (CSV/Excel) |
| POST | `/api/v1/upload-analyze-csv` | Batch analyze medical records from CSV |

## Project Structure

```
Ifeakandum-AI-integration/
├── src/
│   ├── main.py                 # FastAPI application and endpoints
│   ├── database.py             # SQLite database configuration
│   ├── logger.py               # Logging configuration
│   ├── middleware.py           # Custom middleware (request logging)
│   ├── tasks.py                # Optional Celery task definitions
│   ├── celery_backend.py       # Optional Celery app configuration
│   ├── schema/
│   │   ├── patient_schema.py   # Pydantic data models
│   │   └── __init__.py
│   └── services/
│       ├── patient_service.py  # OpenAI integration
│       ├── batch_analysis.py   # Batch processing logic
│       └── __init__.py
├── frontend/                   # React + Vite frontend
├── logs/                       # Application logs (auto-generated)
├── docs/                       # Documentation
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables (not in git)
├── .env.example               # Environment template
└── README.md                  # This file
```

## Example Usage

### Analyze Single Patient Record

```python
import httpx

patient_data = {
    "patient_info": {
        "patient_id": "P001",
        "age": 45,
        "gender": "Male",
        "medical_history": "Hypertension, Type 2 Diabetes"
    },
    "symptoms": {
        "primary_symptoms": "Chest pain, shortness of breath",
        "secondary_symptoms": "Fatigue, dizziness",
        "symptom_duration": "2 days",
        "symptom_severity": "Moderate to severe"
    },
    "vital_signs": {
        "temperature": 98.6,
        "blood_pressure": "150/95",
        "heart_rate": 95,
        "respiratory_rate": 20,
        "oxygen_saturation": 96
    }
}

response = httpx.post(
    "http://localhost:8000/api/v1/analyze-record",
    json=patient_data
)
print(response.json())
```

## Security Considerations

- API authentication via HTTPBearer (configure in production)
- CORS middleware enabled for cross-origin requests
- Environment variables for sensitive data
- Input validation via Pydantic models

## Current Limitations

1. **SQLite Default Storage** - Local storage is file-based and suitable for development, not production scale
2. **No Rate Limiting** - API calls are not rate-limited
3. **Single AI Provider** - Dependent on OpenAI API availability
4. **No User Management** - Authentication is defined but not fully implemented
5. **Educational Use Only** - Not certified for clinical use

## Future Improvements

- [ ] Implement persistent database (PostgreSQL/MongoDB)
- [ ] Add comprehensive test suite
- [ ] Implement rate limiting
- [ ] Add user authentication and authorization
- [ ] Support multiple AI providers with fallback
- [ ] Add request caching to reduce API calls
- [ ] Implement monitoring and observability
- [ ] Add data export functionality
- [ ] Create web UI for easier interaction

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[Specify your license here]

## Contact

[Your contact information]

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Frontend built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Powered by the [OpenAI API](https://platform.openai.com/)
