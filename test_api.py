import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_api():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    base_url = "https://openrouter.ai/api/v1"
    model = "deepseek/deepseek-r1-0528:free"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": "Hello, just a test"
                        }
                    ],
                    "max_tokens": 50
                },
                timeout=30.0
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            response.raise_for_status()
            print("✅ API connection successful!")
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error: {e.response.status_code}")
        print(f"Response: {e.response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
