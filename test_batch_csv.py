import httpx
import time
import json
import sys

def test_batch_csv():
    base_url = "http://localhost:8000"
    upload_url = f"{base_url}/api/v1/upload-analyze-csv"
    
    print("📤 Uploading CSV for batch analysis...")
    files = {'file': ('test_subset.csv', open('test_subset.csv', 'rb'), 'text/csv')}
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(upload_url, files=files)
            
        if response.status_code != 200:
            print(f"❌ Upload failed: {response.status_code}")
            print(response.text)
            return

        batch_id = response.json()["batch_id"]
        print(f"✅ Upload successful. Batch ID: {batch_id}")
        
        status_url = f"{base_url}/api/v1/batch-analysis-status/{batch_id}"
        results_url = f"{base_url}/api/v1/batch-results/{batch_id}"
        
        print("⏳ Polling for status...")
        while True:
            with httpx.Client() as client:
                res = client.get(status_url)
                status_data = res.json()
                status = status_data["status"]
                processed = status_data["processed_records"]
                total = status_data["total_records"]
                
                print(f"   Status: {status} ({processed}/{total})")
                
                if status == "completed":
                    print("🎉 Batch processing completed!")
                    break
                elif status == "failed":
                    print("❌ Batch processing failed.")
                    print(json.dumps(status_data["errors"], indent=2))
                    return
                
                time.sleep(2)
        
        print("📊 Fetching detailed results...")
        with httpx.Client() as client:
            res = client.get(results_url)
            results = res.json()
            
        print(f"\n--- Batch Analysis: {batch_id} ---")
        print(f"Total Records: {results['total_records']}")
        print(f"Successful: {results['successful_analyses']}")
        print(f"Failed: {results['failed_analyses']}")
        
        print("\nRecent Results:")
        for r in results["results"][:5]:
            print(f"- Record {r['record_id']}: {', '.join(r['conditions'])} (Confidence: {r['confidence']})")

        print(f"\n✅ All tests passed for batch: {batch_id}")

    except Exception as e:
        print(f"💥 Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_batch_csv()
